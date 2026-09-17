import { Request, Response, NextFunction } from 'express';
import { LeadService, ServiceActor } from '../services/lead.service';
import { LeadActivityService } from '../services/leadActivity.service';
import { ClientMembership } from '../models/ClientMembership';
import { sendSuccess, sendError } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class LeadController {
  private static getActor(req: Request): ServiceActor {
    return {
      id: req.user!._id.toString(),
      email: req.user!.email,
      name: req.user!.name,
      isSuperAdmin: req.user!.isSuperAdmin,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  public static async resolveScopeClientId(req: Request): Promise<string | null> {
    const rawId =
      req.resolvedClientId ||
      (req.headers['x-client-id'] as string) ||
      (req.query.clientId as string) ||
      (req.body?.clientId as string) ||
      (req.auth as any)?.activeClientId;

    if (req.user!.isSuperAdmin) {
      return rawId ? rawId.toString().trim() : null;
    }

    // Regular client user: MUST be authenticated in this client
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

    // Default to user's active membership
    const membership = await ClientMembership.findOne({
      userId: req.user!._id,
      status: 'active',
    });
    if (!membership) {
      throw new AppError('No active client workspace membership found.', 403);
    }
    return membership.clientId.toString();
  }

  /**
   * GET /api/v1/leads
   */
  public static async getLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const data = await LeadService.getLeads(scopeClientId, req.query, actor);
      sendSuccess(res, data, 'Leads retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/leads
   */
  public static async createLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      if (!scopeClientId) {
        throw new AppError('Target client workspace must be specified.', 400);
      }
      const actor = LeadController.getActor(req);
      const lead = await LeadService.createLead(scopeClientId, req.body, actor);
      sendSuccess(res, lead, 'Lead created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/leads/pipeline-summary
   */
  public static async getPipelineSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const summary = await LeadService.getPipelineSummary(scopeClientId, actor);
      sendSuccess(res, summary, 'Pipeline summary retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/leads/export
   */
  public static async exportLeadsCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const csvData = await LeadService.exportLeadsCsv(scopeClientId, req.query, actor);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="leads_export_${Date.now()}.csv"`
      );
      res.status(200).send(csvData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/leads/:leadId
   */
  public static async getLeadById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const lead = await LeadService.getLeadById(req.params.leadId, scopeClientId, actor);
      sendSuccess(res, lead, 'Lead details retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/leads/:leadId
   */
  public static async updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const updated = await LeadService.updateLead(req.params.leadId, scopeClientId, req.body, actor);
      sendSuccess(res, updated, 'Lead updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/leads/:leadId/stage
   */
  public static async updateStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const updated = await LeadService.updateStage(req.params.leadId, scopeClientId, req.body, actor);
      sendSuccess(res, updated, `Lead transitioned to ${updated.stage}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/leads/:leadId/assign
   */
  public static async assignLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const updated = await LeadService.assignLead(req.params.leadId, scopeClientId, req.body, actor);
      sendSuccess(res, updated, 'Lead assignment updated');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/leads/:leadId/score
   */
  public static async updateScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const updated = await LeadService.updateScore(req.params.leadId, scopeClientId, req.body, actor);
      sendSuccess(res, updated, `Lead score updated to ${updated.leadScore}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/leads/:leadId
   */
  public static async deleteLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const archived = await LeadService.deleteLead(req.params.leadId, scopeClientId, actor);
      sendSuccess(res, archived, 'Lead archived successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/leads/:leadId/activity
   */
  public static async getLeadActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      // Validate access to lead first
      await LeadService.getLeadById(req.params.leadId, scopeClientId, actor);

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const data = await LeadActivityService.getLeadActivities(req.params.leadId, scopeClientId, page, limit);
      sendSuccess(res, data, 'Lead activity timeline retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/leads/:leadId/activity
   */
  public static async addLeadActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const scopeClientId = await LeadController.resolveScopeClientId(req);
      const actor = LeadController.getActor(req);
      const lead = await LeadService.getLeadById(req.params.leadId, scopeClientId, actor);

      const activity = await LeadActivityService.log({
        leadId: lead._id,
        clientId: lead.clientId._id || lead.clientId,
        userId: actor.id,
        activityType: req.body.activityType,
        description: req.body.description,
        metadata: req.body.metadata,
        ipAddress: actor.ip,
        userAgent: actor.userAgent,
      });

      sendSuccess(res, activity, 'Activity recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
