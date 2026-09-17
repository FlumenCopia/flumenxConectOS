import { Request, Response, NextFunction } from 'express';
import { AdConnectionService } from '../services/adConnection.service';
import { AdSyncService } from '../services/adSync.service';
import { AdReportingService } from '../services/adReporting.service';
import { AdAttributionService } from '../services/adAttribution.service';
import { ClientMembership } from '../models/ClientMembership';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class AdController {
  /**
   * Helper to resolve the active client ID for the request actor.
   */
  public static async resolveScopeClientId(req: Request): Promise<string> {
    const rawId =
      req.resolvedClientId ||
      (req.headers['x-client-id'] as string) ||
      (req.query.clientId as string) ||
      (req.body?.clientId as string);

    if (req.user!.isSuperAdmin) {
      if (rawId) return rawId.toString().trim();
      // If super admin didn't provide x-client-id, check user membership or error
      const membership = await ClientMembership.findOne({
        userId: req.user!._id,
        status: 'active',
      });
      if (membership) return membership.clientId.toString();
      throw new AppError('Client ID context is required. Pass x-client-id header or clientId query param.', 400);
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
   * GET /api/v1/ads/connections
   */
  public static async getConnections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const connections = await AdConnectionService.listConnections(clientId);
      sendSuccess(res, connections, 'Ad platform connections retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ads/connections
   */
  public static async createConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const connection = await AdConnectionService.createConnection(
        clientId,
        req.body,
        req.user?._id?.toString()
      );
      sendSuccess(res, connection, 'Ad platform connected successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/ads/connections/:id/status
   */
  public static async updateConnectionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const connection = await AdConnectionService.updateConnectionStatus(
        clientId,
        req.params.id,
        req.body.status
      );
      sendSuccess(res, connection, 'Connection status updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/ads/connections/:id
   */
  public static async revokeConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const result = await AdConnectionService.revokeConnection(
        clientId,
        req.params.id,
        req.user?._id?.toString()
      );
      sendSuccess(res, result, 'Connection revoked successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ads/connections/:id/sync
   */
  public static async syncConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const result = await AdSyncService.syncConnection(clientId, req.params.id);
      sendSuccess(
        res,
        result,
        result.status === 'success' ? 'Sync completed successfully' : 'Sync completed with warnings/errors'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/ads/sync-all
   */
  public static async syncAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const results = await AdSyncService.syncAllActiveConnections(clientId);
      sendSuccess(res, results, 'All active ad connections synced successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ads/reporting/summary
   */
  public static async getReportingSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const filter = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        platform: req.query.platform as 'meta' | 'google',
        campaignId: req.query.campaignId as string,
      };
      const summary = await AdReportingService.getExecutiveSummary(clientId, filter);
      sendSuccess(res, summary, 'Executive reporting summary retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ads/reporting/timeseries
   */
  public static async getTimeSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const filter = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        platform: req.query.platform as 'meta' | 'google',
        campaignId: req.query.campaignId as string,
      };
      const timeseries = await AdReportingService.getTimeSeries(clientId, filter);
      sendSuccess(res, timeseries, 'Reporting time-series retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ads/campaigns
   */
  public static async getCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const filter = {
        platform: req.query.platform as 'meta' | 'google',
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };
      const result = await AdReportingService.getCampaignsReport(clientId, filter);
      sendPaginated(res, result.campaigns, {
        total: result.total,
        page: result.page,
        limit: filter.limit,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ads/ad-sets
   */
  public static async getAdSets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const filter = {
        campaignId: req.query.campaignId as string,
        externalCampaignId: req.query.externalCampaignId as string,
        platform: req.query.platform as 'meta' | 'google',
      };
      const adSets = await AdReportingService.getAdSets(clientId, filter);
      sendSuccess(res, adSets, 'Ad sets retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ads/ad-creatives
   */
  public static async getAdCreatives(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const filter = {
        campaignId: req.query.campaignId as string,
        externalCampaignId: req.query.externalCampaignId as string,
        adSetId: req.query.adSetId as string,
        externalAdSetId: req.query.externalAdSetId as string,
        platform: req.query.platform as 'meta' | 'google',
      };
      const ads = await AdReportingService.getAds(clientId, filter);
      sendSuccess(res, ads, 'Ad creatives retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ads/attributions
   */
  public static async getAttributions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const filter = {
        leadId: req.query.leadId as string,
        touchType: req.query.touchType as any,
        platform: req.query.platform as any,
        campaignId: req.query.campaignId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };
      const result = await AdAttributionService.getLeadAttributions(clientId, filter);
      sendPaginated(res, result.attributions, {
        total: result.total,
        page: result.page,
        limit: filter.limit,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/ads/attributions/summary
   */
  public static async getAttributionSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await AdController.resolveScopeClientId(req);
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const summary = await AdAttributionService.getAttributionSummary(clientId, startDate, endDate);
      sendSuccess(res, summary, 'Attribution summary retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}
