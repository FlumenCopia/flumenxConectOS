import { Request, Response, NextFunction } from 'express';
import { WorkflowService } from '../services/workflow.service';
import { ClientMembership } from '../models/ClientMembership';
import { Client } from '../models/Client';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class WorkflowController {
  /**
   * Resolves target clientId and verifies tenant membership authorization.
   * Disallows trusting client-supplied headers without membership verification.
   */
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
   * GET /api/v1/workflows
   */
  public static async listWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const { workflows, total, page, totalPages } = await WorkflowService.listWorkflows(clientId, {
        status: req.query.status as string,
        eventType: req.query.eventType as string,
        search: req.query.search as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });

      sendPaginated(
        res,
        workflows,
        { total, page, limit: Number(req.query.limit) || 20 },
        'Workflows retrieved successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/workflows/:id
   */
  public static async getWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const workflow = await WorkflowService.getWorkflow(clientId, req.params.id);
      sendSuccess(res, workflow, 'Workflow retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/workflows
   */
  public static async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const actor = WorkflowController.getActor(req);
      const workflow = await WorkflowService.createWorkflow(clientId, req.body, actor);
      sendSuccess(res, workflow, 'Workflow created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/workflows/:id
   */
  public static async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const actor = WorkflowController.getActor(req);
      const workflow = await WorkflowService.updateWorkflow(clientId, req.params.id, req.body, actor);
      sendSuccess(res, workflow, 'Workflow updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/workflows/:id/status
   */
  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const actor = WorkflowController.getActor(req);
      const workflow = await WorkflowService.updateWorkflowStatus(clientId, req.params.id, req.body.status, actor);
      sendSuccess(res, workflow, `Workflow status changed to ${req.body.status}`);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/workflows/:id
   */
  public static async deleteWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const actor = WorkflowController.getActor(req);
      const result = await WorkflowService.deleteWorkflow(clientId, req.params.id, actor);
      sendSuccess(res, result, 'Workflow deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/workflows/:id/test-conditions
   */
  public static async testConditions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const result = await WorkflowService.testWorkflowConditions(clientId, req.params.id, req.body.payload || {});
      sendSuccess(res, result, 'Conditions tested successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/workflows/:id/execute
   */
  public static async executeWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const actor = WorkflowController.getActor(req);
      const run = await WorkflowService.executeManualWorkflow(
        clientId,
        req.params.id,
        req.body.payload || {},
        actor,
        req.body.eventId
      );
      sendSuccess(res, run, 'Workflow executed successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/workflows/runs (or /workflows/:id/runs)
   */
  public static async listRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const workflowId = req.params.id || (req.query.workflowId as string);

      const { runs, total, page, totalPages } = await WorkflowService.listWorkflowRuns(clientId, {
        workflowId,
        status: req.query.status as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      });

      sendPaginated(
        res,
        runs,
        { total, page, limit: Number(req.query.limit) || 20 },
        'Workflow runs retrieved successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/workflows/runs/:runId
   */
  public static async getRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await WorkflowController.resolveScopeClientId(req);
      const run = await WorkflowService.getWorkflowRun(clientId, req.params.runId);
      sendSuccess(res, run, 'Workflow run details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}
