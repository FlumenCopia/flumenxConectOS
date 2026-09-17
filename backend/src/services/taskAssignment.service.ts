import mongoose from 'mongoose';
import { Task, ITask } from '../models/Task';
import { TaskEvent } from '../models/TaskEvent';
import { ClientMembership } from '../models/ClientMembership';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';

export type AssignmentStrategy = 'explicit' | 'round_robin' | 'least_open_tasks' | 'unassigned';

export class TaskAssignmentService {
  /**
   * Validates that an assigned user exists, is active in the system,
   * and possesses an active membership within the target client workspace.
   */
  static async validateActiveAssignee(clientId: string, userId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid assignee user ID format', 400);
    }

    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const user = await User.findById(userObjectId);
    if (!user) {
      throw new AppError('Assignee user not found', 404);
    }

    if (user.status !== 'active') {
      throw new AppError('Cannot assign tasks to an inactive or suspended user', 400);
    }

    // Ensure the user has an active membership in this client workspace
    const membership = await ClientMembership.findOne({
      clientId: clientObjectId,
      userId: userObjectId,
      status: 'active',
    });

    if (!membership && !user.isSuperAdmin) {
      throw new AppError('User is not an active member of this client workspace', 400);
    }

    return user;
  }

  /**
   * Assigns or reassigns a task to an active user (or unassigns if null).
   * Records a detailed TaskEvent audit record.
   */
  static async assignTask(
    clientId: string,
    taskId: string,
    newAssigneeId: string | null | undefined,
    actor?: { id?: string; name?: string },
    reason?: string
  ): Promise<ITask> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const taskObjectId = new mongoose.Types.ObjectId(taskId);

    const task = await Task.findOne({
      _id: taskObjectId,
      clientId: clientObjectId,
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const previousAssigneeId = task.assignedTo ? task.assignedTo.toString() : null;

    if (!newAssigneeId) {
      // Unassign task
      task.assignedTo = undefined;
      task.updatedBy = actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined;
      await task.save();

      await TaskEvent.create({
        clientId: clientObjectId,
        taskId: task._id,
        eventType: 'reassigned',
        description: `Task unassigned by ${actor?.name || 'System'}${reason ? `: ${reason}` : ''}`,
        previousValue: { assignedTo: previousAssigneeId },
        newValue: { assignedTo: null },
        actorId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
        actorName: actor?.name,
      });

      return task;
    }

    // Validate user is active in this client
    const targetUser = await this.validateActiveAssignee(clientId, newAssigneeId);

    task.assignedTo = targetUser._id;
    task.updatedBy = actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined;
    await task.save();

    const eventType = previousAssigneeId ? 'reassigned' : 'assigned';
    await TaskEvent.create({
      clientId: clientObjectId,
      taskId: task._id,
      eventType,
      description: `Task ${eventType} to ${targetUser.name} by ${actor?.name || 'System'}${reason ? `: ${reason}` : ''}`,
      previousValue: { assignedTo: previousAssigneeId },
      newValue: { assignedTo: targetUser._id.toString(), assigneeName: targetUser.name },
      actorId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
      actorName: actor?.name,
    });

    await task.populate('assignedTo', 'name email avatarUrl');
    return task;
  }

  /**
   * Helper to determine assignee ID string using team routing strategy.
   */
  static async determineAssignee(
    clientId: string,
    options?: { strategy?: 'least_open' | 'least_open_tasks' | 'round_robin' | 'explicit' | 'unassigned'; explicitUserId?: string }
  ): Promise<string | undefined> {
    const strat = options?.strategy === 'least_open' ? 'least_open_tasks' : (options?.strategy || 'least_open_tasks');
    const res = await this.resolveAutoAssignee(clientId, strat, options?.explicitUserId);
    return res ? res.toString() : undefined;
  }

  /**
   * Automatically resolves an assignee for an auto-generated follow-up task.
   * Supports round_robin, least_open_tasks, explicit, and unassigned.
   */
  static async resolveAutoAssignee(
    clientId: string,
    strategy: AssignmentStrategy = 'least_open_tasks',
    explicitUserId?: string
  ): Promise<mongoose.Types.ObjectId | undefined> {
    if (strategy === 'unassigned') {
      return undefined;
    }

    if (strategy === 'explicit' && explicitUserId) {
      try {
        const user = await this.validateActiveAssignee(clientId, explicitUserId);
        return user._id;
      } catch {
        // Fallback to least open tasks if explicit user is unavailable
      }
    }

    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    // Retrieve active memberships with active user accounts
    const memberships = await ClientMembership.find({
      clientId: clientObjectId,
      status: 'active',
    }).populate('userId', 'name email status');

    const eligibleUsers = memberships
      .map((m) => m.userId as any)
      .filter((u) => u && u.status === 'active');

    if (eligibleUsers.length === 0) {
      return undefined;
    }

    if (eligibleUsers.length === 1) {
      return eligibleUsers[0]._id;
    }

    if (strategy === 'round_robin') {
      // Find the most recently assigned task to determine next user
      const lastAssignedTask = await Task.findOne({
        clientId: clientObjectId,
        assignedTo: { $exists: true, $ne: null },
      }).sort({ createdAt: -1 });

      if (!lastAssignedTask || !lastAssignedTask.assignedTo) {
        return eligibleUsers[0]._id;
      }

      const lastIndex = eligibleUsers.findIndex(
        (u) => u._id.toString() === lastAssignedTask.assignedTo!.toString()
      );
      const nextIndex = (lastIndex + 1) % eligibleUsers.length;
      return eligibleUsers[nextIndex]._id;
    }

    // Default: least_open_tasks
    // Count open tasks for each eligible user
    const openTaskCounts = await Task.aggregate([
      {
        $match: {
          clientId: clientObjectId,
          status: { $in: ['open', 'in_progress'] },
          assignedTo: { $in: eligibleUsers.map((u) => u._id) },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, number>();
    for (const item of openTaskCounts) {
      countMap.set(item._id.toString(), item.count);
    }

    let minUser = eligibleUsers[0];
    let minCount = countMap.get(eligibleUsers[0]._id.toString()) || 0;

    for (let i = 1; i < eligibleUsers.length; i++) {
      const user = eligibleUsers[i];
      const count = countMap.get(user._id.toString()) || 0;
      if (count < minCount) {
        minCount = count;
        minUser = user;
      }
    }

    return minUser._id;
  }
}
