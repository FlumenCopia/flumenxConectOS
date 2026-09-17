import mongoose from 'mongoose';
import { Task, ITask } from '../models/Task';
import { TaskEvent } from '../models/TaskEvent';
import { TaskDisposition, ITaskDisposition } from '../models/TaskDisposition';
import { Lead } from '../models/Lead';
import { SlaService } from './sla.service';
import { AppError } from '../middleware/errorHandler';

export interface ApplyDispositionParams {
  disposition: string;
  notes?: string;
  scheduleFollowUp?: boolean;
  followUpDueAt?: Date;
  followUpTitle?: string;
  followUpType?: 'call' | 'email' | 'meeting' | 'follow_up' | 'review' | 'other';
  updateLeadStage?: string;
}

export class TaskDispositionService {
  /**
   * Provisions standard dispositions for a client if none exist.
   */
  static async seedStandardDispositions(clientId: string): Promise<ITaskDisposition[]> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    const standard = [
      { code: 'contacted', label: 'Contacted', category: 'positive', requiresFollowup: false, order: 1 },
      { code: 'left_voicemail', label: 'Left Voicemail', category: 'neutral', requiresFollowup: true, order: 2 },
      { code: 'rescheduled', label: 'Rescheduled', category: 'followup_required', requiresFollowup: true, order: 3 },
      { code: 'qualified', label: 'Qualified', category: 'positive', requiresFollowup: false, order: 4 },
      { code: 'unqualified', label: 'Unqualified', category: 'negative', requiresFollowup: false, order: 5 },
      { code: 'not_interested', label: 'Not Interested', category: 'negative', requiresFollowup: false, order: 6 },
      { code: 'wrong_number', label: 'Wrong Number', category: 'negative', requiresFollowup: false, order: 7 },
      { code: 'no_response', label: 'No Response', category: 'neutral', requiresFollowup: true, order: 8 },
    ];

    for (const item of standard) {
      await TaskDisposition.findOneAndUpdate(
        { clientId: clientObjectId, code: item.code },
        { $set: { ...item, clientId: clientObjectId, isSystem: true, isActive: true } },
        { upsert: true }
      );
    }

    return TaskDisposition.find({ clientId: clientObjectId, isActive: true }).sort({ order: 1 });
  }

  /**
   * Lists active dispositions for a client workspace.
   */
  static async listDispositions(clientId: string): Promise<ITaskDisposition[]> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const existing = await TaskDisposition.find({ clientId: clientObjectId, isActive: true }).sort({ order: 1 });
    if (existing.length === 0) {
      return this.seedStandardDispositions(clientId);
    }
    return existing;
  }

  /**
   * Applies an outcome disposition to complete a task.
   * Optionally updates CRM Lead stage and schedules a subsequent follow-up task.
   */
  static async applyDisposition(
    clientId: string,
    taskId: string,
    data: ApplyDispositionParams,
    actor?: { id?: string; name?: string }
  ): Promise<{ task: ITask; nextTask?: ITask; followUpTask?: ITask }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const taskObjectId = new mongoose.Types.ObjectId(taskId);

    const task = await Task.findOne({
      _id: taskObjectId,
      clientId: clientObjectId,
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    if (task.status === 'completed') {
      throw new AppError('Task has already been completed', 400);
    }

    // 1. Mark task as completed with disposition details
    const now = new Date();
    task.disposition = data.disposition.toLowerCase().trim();
    task.status = 'completed';
    task.completedAt = now;
    task.completedBy = actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined;
    if (data.notes) {
      task.completionNotes = data.notes.trim();
    }
    task.updatedBy = actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined;

    // Evaluate SLA completion state
    if (task.slaDeadline && now > task.slaDeadline) {
      task.slaBreached = true;
      if (!task.slaBreachedAt) {
        task.slaBreachedAt = task.slaDeadline;
      }
    }
    await task.save();

    // 2. Log event
    await TaskEvent.create({
      clientId: clientObjectId,
      taskId: task._id,
      eventType: 'disposition_applied',
      description: `Task completed with disposition '${data.disposition}' by ${actor?.name || 'User'}`,
      newValue: {
        disposition: data.disposition,
        notes: data.notes,
        status: 'completed',
        completedAt: now,
      },
      actorId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
      actorName: actor?.name,
    });

    // 3. Update Lead stage if specified
    if (data.updateLeadStage && task.leadId) {
      try {
        await Lead.updateOne(
          { _id: task.leadId, clientId: clientObjectId },
          { $set: { stage: data.updateLeadStage } }
        );
      } catch (leadErr) {
        // Non-fatal
      }
    }

    // 4. Optionally schedule next follow-up task
    let nextTask: ITask | undefined;
    const shouldSchedule =
      data.scheduleFollowUp ||
      data.disposition.toLowerCase() === 'rescheduled' ||
      Boolean(data.followUpDueAt);

    if (shouldSchedule) {
      const followUpDueAt = data.followUpDueAt || new Date(now.getTime() + 24 * 60 * 60 * 1000); // default +24h
      const followUpPriority = task.priority;
      const { deadline, policyId, targetMinutes } = await SlaService.calculateSlaDeadline(
        clientId,
        followUpPriority,
        new Date()
      );

      nextTask = await Task.create({
        clientId: clientObjectId,
        title: data.followUpTitle || `Follow-up: ${task.title}`,
        description: data.notes ? `Follow-up from previous disposition (${data.disposition}): ${data.notes}` : undefined,
        taskType: data.followUpType || task.taskType || 'follow_up',
        status: 'open',
        priority: followUpPriority,
        assignedTo: task.assignedTo,
        dueAt: followUpDueAt,
        slaPolicyId: policyId,
        slaDeadline: deadline,
        slaTargetMinutes: targetMinutes,
        leadId: task.leadId,
        contactId: task.contactId,
        conversationId: task.conversationId,
        formSubmissionId: task.formSubmissionId,
        campaignId: task.campaignId,
        createdBy: actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
        metadata: {
          previousTaskId: task._id.toString(),
          previousDisposition: data.disposition,
        },
      });

      await TaskEvent.create({
        clientId: clientObjectId,
        taskId: nextTask._id,
        eventType: 'created',
        description: `Follow-up task scheduled from previous task ${task._id}`,
        newValue: { dueAt: followUpDueAt, priority: followUpPriority },
        actorId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
        actorName: actor?.name,
      });
    }

    return {
      task,
      nextTask,
      followUpTask: nextTask,
    };
  }
}
