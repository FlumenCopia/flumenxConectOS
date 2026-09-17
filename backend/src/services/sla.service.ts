import mongoose from 'mongoose';
import { SlaPolicy, ISlaPolicy } from '../models/SlaPolicy';
import { Task, ITask } from '../models/Task';
import { TaskEvent } from '../models/TaskEvent';
import { EventDispatcher } from './eventDispatcher.service';
import { AppError } from '../middleware/errorHandler';

export interface SlaEvaluationResult {
  slaDeadline?: Date;
  slaBreached: boolean;
  slaBreachedAt?: Date;
  timeRemainingMinutes?: number;
  responseDurationMinutes?: number;
  isPaused: boolean;
}

export class SlaService {
  /**
   * Retrieves or provisions the default SLA policy for a workspace.
   */
  static async getOrCreateDefaultPolicy(clientId: string): Promise<ISlaPolicy> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    let policy = await SlaPolicy.findOne({
      clientId: clientObjectId,
      isDefault: true,
    });

    if (!policy) {
      policy = await SlaPolicy.create({
        clientId: clientObjectId,
        name: 'Standard Response SLA',
        isDefault: true,
        urgentTargetMinutes: 15,
        highTargetMinutes: 60,
        normalTargetMinutes: 240,
        lowTargetMinutes: 1440,
        businessHoursOnly: false,
      });
    }

    return policy;
  }

  /**
   * Calculates the SLA deadline for a given priority and start timestamp.
   */
  static async calculateSlaDeadline(
    clientId: string,
    priority: 'low' | 'normal' | 'high' | 'urgent',
    fromDate: Date = new Date(),
    customPolicyId?: string
  ): Promise<{ deadline: Date; policyId: mongoose.Types.ObjectId; targetMinutes: number }> {
    let policy: ISlaPolicy | null = null;

    if (customPolicyId && mongoose.Types.ObjectId.isValid(customPolicyId)) {
      policy = await SlaPolicy.findOne({
        _id: new mongoose.Types.ObjectId(customPolicyId),
        clientId: new mongoose.Types.ObjectId(clientId),
      });
    }

    if (!policy) {
      policy = await this.getOrCreateDefaultPolicy(clientId);
    }

    let targetMinutes = 240; // Default: normal (4 hours)
    switch (priority) {
      case 'urgent':
        targetMinutes = policy.urgentTargetMinutes || 15;
        break;
      case 'high':
        targetMinutes = policy.highTargetMinutes || 60;
        break;
      case 'normal':
        targetMinutes = policy.normalTargetMinutes || 240;
        break;
      case 'low':
        targetMinutes = policy.lowTargetMinutes || 1440;
        break;
    }

    const deadline = new Date(fromDate.getTime() + targetMinutes * 60 * 1000);
    return {
      deadline,
      policyId: policy._id,
      targetMinutes,
    };
  }

  /**
   * Evaluates the current SLA status of a task document synchronously.
   * Freezes SLA state for completed or cancelled tasks.
   */
  static calculateTaskSla(task: any): SlaEvaluationResult {
    const now = new Date();
    const isTerminal = task.status === 'completed' || task.status === 'cancelled';
    const createdAt = task.createdAt ? new Date(task.createdAt) : now;
    const slaDeadline = task.slaDeadline ? new Date(task.slaDeadline) : undefined;

    if (isTerminal) {
      const responseTime = task.completedAt
        ? new Date(task.completedAt)
        : task.updatedAt
        ? new Date(task.updatedAt)
        : now;
      const responseDurationMinutes = Math.max(
        0,
        Math.round((responseTime.getTime() - createdAt.getTime()) / 60000)
      );

      const breached = slaDeadline ? responseTime > slaDeadline : false;

      return {
        slaDeadline,
        slaBreached: task.slaBreached || breached,
        slaBreachedAt: task.slaBreachedAt,
        responseDurationMinutes,
        isPaused: true,
      };
    }

    // Active task (open, in_progress, snoozed)
    if (!slaDeadline) {
      return {
        slaBreached: false,
        isPaused: false,
      };
    }

    const isPastDeadline = now > slaDeadline;
    const timeRemainingMinutes = Math.max(
      0,
      Math.round((slaDeadline.getTime() - now.getTime()) / 60000)
    );

    return {
      slaDeadline,
      slaBreached: task.slaBreached || isPastDeadline,
      slaBreachedAt: isPastDeadline ? task.slaBreachedAt || slaDeadline : undefined,
      timeRemainingMinutes,
      isPaused: false,
    };
  }

  /**
   * Evaluates the current SLA status of a task on-demand (accepts task object or string ID).
   * Persists breach if task is active and past deadline.
   */
  static async evaluateTaskSla(taskOrId: ITask | string): Promise<SlaEvaluationResult> {
    let task: any = taskOrId;
    if (typeof taskOrId === 'string') {
      task = await Task.findById(taskOrId);
      if (!task) throw new AppError('Task not found', 404);
    }

    const result = this.calculateTaskSla(task);
    if (result.slaBreached && !task.slaBreached && typeof task.save === 'function') {
      task.slaBreached = true;
      task.slaBreachedAt = result.slaBreachedAt || new Date();
      await task.save();
    }

    return result;
  }

  /**
   * Scans and updates SLA breach flags for open tasks in a workspace.
   */
  static async checkAndMarkBreaches(clientId: string): Promise<number> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const now = new Date();

    const breachingTasks = await Task.find({
      clientId: clientObjectId,
      status: { $in: ['open', 'in_progress', 'snoozed'] },
      slaDeadline: { $lt: now },
      slaBreached: false,
    });

    for (const task of breachingTasks) {
      task.slaBreached = true;
      task.slaBreachedAt = task.slaDeadline || now;
      await task.save();

      await TaskEvent.create({
        clientId: clientObjectId,
        taskId: task._id,
        eventType: 'sla_breached',
        description: `SLA response deadline (${task.slaDeadline?.toISOString()}) breached for ${task.priority.toUpperCase()} priority task.`,
        metadata: {
          priority: task.priority,
          deadline: task.slaDeadline,
          breachedAt: task.slaBreachedAt,
        },
      });

      // Dispatch workflow trigger event: task.sla_breached
      try {
        await EventDispatcher.dispatch({
          clientId: task.clientId.toString(),
          eventType: 'task.sla_breached',
          eventId: `task_sla_breached_${task._id}`,
          entityId: task._id.toString(),
          entityType: 'task',
          payload: {
            task: task.toObject ? task.toObject() : task,
            priority: task.priority,
            deadline: task.slaDeadline,
            breachedAt: task.slaBreachedAt,
          },
        });
      } catch (eventErr) {
        // Non-fatal
      }
    }

    return breachingTasks.length;
  }

  /**
   * Lists SLA policies for a client workspace.
   */
  static async listPolicies(clientId: string): Promise<ISlaPolicy[]> {
    await this.getOrCreateDefaultPolicy(clientId); // ensure at least default exists
    return SlaPolicy.find({ clientId: new mongoose.Types.ObjectId(clientId) }).sort({ isDefault: -1, name: 1 });
  }

  /**
   * Updates an SLA policy.
   */
  static async updatePolicy(
    clientId: string,
    policyId: string,
    data: Partial<{
      name: string;
      urgentTargetMinutes: number;
      highTargetMinutes: number;
      normalTargetMinutes: number;
      lowTargetMinutes: number;
      businessHoursOnly: boolean;
      escalationEmail: string;
    }>
  ): Promise<ISlaPolicy> {
    const policy = await SlaPolicy.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(policyId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: data },
      { new: true }
    );

    if (!policy) {
      throw new AppError('SLA policy not found', 404);
    }

    return policy;
  }
}
