import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { ClientMembership } from '../models/ClientMembership';
import { Client } from '../models/Client';
import { sendSuccess, sendPaginated } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class NotificationController {
  /**
   * Resolves target clientId and verifies tenant membership authorization.
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

  /**
   * GET /api/v1/notifications
   */
  public static async listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await NotificationController.resolveScopeClientId(req);
      const userId = req.user!._id.toString();
      const unreadOnly = req.query.unreadOnly === 'true';
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await NotificationService.listNotifications(clientId, userId, {
        unreadOnly,
        page,
        limit,
      });

      sendPaginated(
        res,
        result.notifications,
        { total: result.total, page: result.page, limit },
        'Notifications retrieved successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   */
  public static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await NotificationController.resolveScopeClientId(req);
      const userId = req.user!._id.toString();
      const unreadCount = await NotificationService.getUnreadCount(clientId, userId);
      sendSuccess(res, { unreadCount }, 'Unread count retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   */
  public static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await NotificationController.resolveScopeClientId(req);
      const userId = req.user!._id.toString();
      const notification = await NotificationService.markAsRead(clientId, userId, req.params.id);
      sendSuccess(res, notification, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/mark-all-read
   */
  public static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await NotificationController.resolveScopeClientId(req);
      const userId = req.user!._id.toString();
      const result = await NotificationService.markAllAsRead(clientId, userId);
      sendSuccess(res, result, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }
}
