import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../middleware/errorHandler';
import { ClientMembership } from '../models/ClientMembership';
import { Client } from '../models/Client';
import { ReportingService } from '../services/reporting.service';
import {
  reportFilterSchema,
  exportReportSchema,
  createSavedReportSchema,
  updateSavedReportSchema,
} from '../validators/reportValidators';

export class ReportController {
  /**
   * Securely resolves the target clientId.
   * Validates user membership for non-super-admins to prevent unauthorized multi-tenant data access.
   */
  public static async resolveScopeClientId(req: Request): Promise<string> {
    const rawId =
      req.resolvedClientId ||
      (req.headers['x-client-id'] as string) ||
      (req.query.clientId as string) ||
      (req.body?.clientId as string) ||
      (req.auth as any)?.activeClientId;

    if (req.user!.isSuperAdmin) {
      if (rawId) {
        const trimmed = rawId.toString().trim();
        if (!mongoose.Types.ObjectId.isValid(trimmed)) {
          throw new AppError('Invalid clientId format', 400);
        }
        const client = await Client.findById(trimmed);
        if (!client) {
          throw new AppError('Client workspace not found', 404);
        }
        return trimmed;
      }
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
      if (!mongoose.Types.ObjectId.isValid(trimmed)) {
        throw new AppError('Invalid clientId format', 400);
      }
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
      throw new AppError('No active workspace membership found for this user.', 403);
    }
    return membership.clientId.toString();
  }

  /**
   * Helper to verify if actor has reports.view_financial permission in the target client workspace.
   */
  public static async hasFinancialAccess(req: Request, clientId: string): Promise<boolean> {
    if (req.user?.isSuperAdmin) return true;
    const membership = await ClientMembership.findOne({
      userId: req.user!._id,
      clientId,
      status: 'active',
    }).populate('roleId', 'permissionCodes');

    if (!membership) return false;
    const role = membership.roleId as any;
    const effectivePermissions = new Set([
      ...(role?.permissionCodes || []),
      ...(membership.customPermissions || []),
    ]);
    return effectivePermissions.has('reports.view_financial');
  }

  // =========================================================================
  // 1. OVERVIEW KPIS
  // =========================================================================

  public static async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = reportFilterSchema.parse(req.query);
      const hasFinancial = await ReportController.hasFinancialAccess(req, clientId);

      const data = await ReportingService.getOverviewKpis(clientId, {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        compare: parsed.compare,
        hasFinancialAccess: hasFinancial,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 2. LEAD ANALYTICS
  // =========================================================================

  public static async getLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = reportFilterSchema.parse(req.query);
      const hasFinancial = await ReportController.hasFinancialAccess(req, clientId);

      const data = await ReportingService.getLeadAnalytics(clientId, {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        source: parsed.source,
        stage: parsed.stage,
        hasFinancialAccess: hasFinancial,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 3. CAMPAIGN ANALYTICS
  // =========================================================================

  public static async getCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = reportFilterSchema.parse(req.query);
      const hasFinancial = await ReportController.hasFinancialAccess(req, clientId);

      const data = await ReportingService.getCampaignAnalytics(clientId, {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        campaignId: parsed.campaignId,
        hasFinancialAccess: hasFinancial,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 4. FORM ANALYTICS
  // =========================================================================

  public static async getForms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = reportFilterSchema.parse(req.query);

      const data = await ReportingService.getFormAnalytics(clientId, {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        formId: parsed.formId,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 5. TASK & SLA ANALYTICS
  // =========================================================================

  public static async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = reportFilterSchema.parse(req.query);

      const data = await ReportingService.getTaskAndSlaAnalytics(clientId, {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        priority: parsed.priority,
        taskStatus: parsed.taskStatus,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 6. TEAM PRODUCTIVITY (reports.view_team)
  // =========================================================================

  public static async getTeamProductivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = reportFilterSchema.parse(req.query);

      const data = await ReportingService.getTeamProductivity(clientId, {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 7. CONVERSATION ANALYTICS
  // =========================================================================

  public static async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = reportFilterSchema.parse(req.query);

      const data = await ReportingService.getConversationAnalytics(clientId, {
        preset: parsed.preset,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        channel: parsed.channel,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 8. CSV EXPORT (reports.export)
  // =========================================================================

  public static async exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = exportReportSchema.parse(req.query);
      const hasFinancial = await ReportController.hasFinancialAccess(req, clientId);

      const csvContent = await ReportingService.exportReportCsv(
        clientId,
        {
          reportType: parsed.reportType,
          preset: parsed.preset,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          limit: parsed.limit,
          hasFinancialAccess: hasFinancial,
        },
        {
          id: req.user!._id?.toString(),
          name: req.user!.name,
          email: req.user!.email,
        }
      );

      const filename = `flumenx-${parsed.reportType}-report-${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // 9. SAVED REPORTS CRUD (reports.view & reports.manage_saved)
  // =========================================================================

  public static async listSavedReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const reports = await ReportingService.listSavedReports(clientId, req.user!._id.toString());

      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async createSavedReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = createSavedReportSchema.parse(req.body);

      const saved = await ReportingService.createSavedReport(
        clientId,
        req.user!._id.toString(),
        parsed
      );

      res.status(201).json({
        success: true,
        data: saved,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSavedReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const saved = await ReportingService.getSavedReport(
        clientId,
        req.params.id,
        req.user!._id.toString()
      );

      res.status(200).json({
        success: true,
        data: saved,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateSavedReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      const parsed = updateSavedReportSchema.parse(req.body);

      const saved = await ReportingService.updateSavedReport(
        clientId,
        req.params.id,
        req.user!._id.toString(),
        parsed
      );

      res.status(200).json({
        success: true,
        data: saved,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteSavedReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ReportController.resolveScopeClientId(req);
      await ReportingService.deleteSavedReport(
        clientId,
        req.params.id,
        req.user!._id.toString()
      );

      res.status(200).json({
        success: true,
        message: 'Saved report deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
