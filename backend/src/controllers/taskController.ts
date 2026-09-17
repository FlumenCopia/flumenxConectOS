import { Request, Response, NextFunction } from 'express';
import { TaskService } from '../services/task.service';
import { TaskAssignmentService } from '../services/taskAssignment.service';
import { TaskDispositionService } from '../services/taskDisposition.service';
import { TaskAutoFollowupService } from '../services/taskAutoFollowup.service';
import { SlaService } from '../services/sla.service';
import { ClientMembership } from '../models/ClientMembership';
import { Client } from '../models/Client';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class TaskController {
  public static async resolveScopeClientId(req: Request): Promise<string> {
    const rawId =
      req.resolvedClientId ||
      (req.headers['x-client-id'] as string) ||
      (req.query.clientId as string) ||
      (req.body?.clientId as string) ||
      (req.auth as any)?.activeClientId;

    if (req.user!.isSuperAdmin) {
      if (rawId) return rawId.toString().trim();
      const membership = await ClientMembership.findOne({
        userId: req.user!._id,
        status: 'active',
      });
      if (membership) return membership.clientId.toString();
      const defaultClient = await Client.findOne({ status: 'active', isArchived: { $ne: true } });
      if (defaultClient) return defaultClient._id.toString();
      throw new AppError('Client ID context is required. Pass x-client-id header or clientId parameter.', 400);
    }

    if (rawId) {
      const trimmed = rawId.toString().trim();
      const membership = await ClientMembership.findOne({
        userId: req.user!._id,
        clientId: trimmed,
        status: 'active',
      });
      if (!membership) {
        throw new AppError('Access denied: You are not authorized for this client workspace.', 403);
      }
      return trimmed;
    }

    const membership = await ClientMembership.findOne({
      userId: req.user!._id,
      status: 'active',
    });
    if (!membership) {
      throw new AppError('No active client workspace membership found.', 403);
    }
    return membership.clientId.toString();
  }

  private static getActor(req: Request) {
    return {
      id: req.user?._id?.toString(),
      name: req.user?.name,
      email: req.user?.email,
    };
  }

  /**
   * GET /api/v1/tasks
   */
  public static async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const result = await TaskService.listTasks(clientId, req.query as any);
      sendPaginated(res, result.tasks, {
        total: result.total,
        page: result.page,
        limit: Number(req.query.limit) || 20,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/kpis
   */
  public static async getTaskKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const kpis = await TaskService.getTaskKpis(clientId);
      sendSuccess(res, kpis, 'Task KPIs retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/agenda
   */
  public static async getAgenda(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const agenda = await TaskService.getAgenda(clientId);
      sendSuccess(res, agenda, 'Daily follow-up agenda retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/overdue
   */
  public static async getOverdueTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const now = new Date();
      const result = await TaskService.listTasks(clientId, {
        dueTo: now.toISOString(),
        status: 'open',
        limit: 50,
      });
      sendSuccess(res, result.tasks, 'Overdue tasks retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/sla-breached
   */
  public static async getSlaBreachedTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const result = await TaskService.listTasks(clientId, {
        slaBreached: 'true',
        limit: 50,
      });
      sendSuccess(res, result.tasks, 'SLA breached tasks retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/dispositions
   */
  public static async listDispositions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const dispositions = await TaskDispositionService.listDispositions(clientId);
      sendSuccess(res, dispositions, 'Task outcome dispositions retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/sla-policies
   */
  public static async listSlaPolicies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const policies = await SlaService.listPolicies(clientId);
      sendSuccess(res, policies, 'SLA policies retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/tasks/sla-policies/:id
   */
  public static async updateSlaPolicy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const policy = await SlaService.updatePolicy(clientId, req.params.id, req.body);
      sendSuccess(res, policy, 'SLA policy updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tasks
   */
  public static async createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.createTask(clientId, req.body, actor);
      sendSuccess(res, task, 'Task created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/:id
   */
  public static async getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const task = await TaskService.getTaskById(clientId, req.params.id);
      sendSuccess(res, task, 'Task retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/tasks/:id
   */
  public static async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.updateTask(clientId, req.params.id, req.body, actor);
      sendSuccess(res, task, 'Task updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/tasks/:id/assign
   */
  public static async assignTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskAssignmentService.assignTask(
        clientId,
        req.params.id,
        req.body.assignedTo,
        actor,
        req.body.reason
      );
      sendSuccess(res, task, 'Task assigned successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/tasks/:id/priority
   */
  public static async updatePriority(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.updateTask(
        clientId,
        req.params.id,
        { priority: req.body.priority },
        actor
      );
      sendSuccess(res, task, 'Task priority updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/tasks/:id/due-date
   */
  public static async updateDueDate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.updateTask(
        clientId,
        req.params.id,
        { dueAt: req.body.dueAt },
        actor
      );
      sendSuccess(res, task, 'Task due date updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tasks/:id/start
   */
  public static async startTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.startTask(clientId, req.params.id, actor);
      sendSuccess(res, task, 'Task marked in progress');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tasks/:id/complete
   */
  public static async completeTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.completeTask(
        clientId,
        req.params.id,
        req.body.completionNotes,
        actor
      );
      sendSuccess(res, task, 'Task completed successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tasks/:id/cancel
   */
  public static async cancelTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.cancelTask(clientId, req.params.id, req.body.reason, actor);
      sendSuccess(res, task, 'Task cancelled successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tasks/:id/snooze
   */
  public static async snoozeTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskService.snoozeTask(
        clientId,
        req.params.id,
        req.body.snoozedUntil,
        req.body.reason,
        actor
      );
      sendSuccess(res, task, 'Task snoozed successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tasks/:id/disposition
   */
  public static async applyDisposition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const result = await TaskDispositionService.applyDisposition(
        clientId,
        req.params.id,
        req.body,
        actor
      );
      sendSuccess(res, result, 'Disposition applied and task completed successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/tasks/:id/events
   */
  public static async getTaskEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const events = await TaskService.getTaskEvents(clientId, req.params.id);
      sendSuccess(res, events, 'Task timeline events retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/tasks/generate-lead-followup
   */
  public static async generateLeadFollowup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await TaskController.resolveScopeClientId(req);
      const actor = TaskController.getActor(req);
      const task = await TaskAutoFollowupService.generateLeadFollowUpTask({
        ...req.body,
        clientId,
        actorId: actor.id,
      });
      sendSuccess(res, task, 'Lead follow-up task resolved successfully', 201);
    } catch (err) {
      next(err);
    }
  }
}
