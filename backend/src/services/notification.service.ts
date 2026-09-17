import mongoose from 'mongoose';
import { Notification, INotification, NotificationSeverity, NotificationSourceType } from '../models/Notification';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export interface ICreateNotificationParams {
  clientId: string | mongoose.Types.ObjectId;
  recipientUserId: string | mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  sourceType?: NotificationSourceType;
  sourceId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export class NotificationService {
  /**
   * Creates an internal in-app notification with idempotency protection.
   */
  public static async createNotification(
    params: ICreateNotificationParams
  ): Promise<INotification> {
    const clientObjectId = new mongoose.Types.ObjectId(params.clientId);
    const userObjectId = new mongoose.Types.ObjectId(params.recipientUserId);

    // Idempotency check for workflow actions: prevent duplicate alerts for the same workflow step
    if (params.metadata?.workflowRunId && params.metadata?.actionId) {
      const existing = await Notification.findOne({
        clientId: clientObjectId,
        recipientUserId: userObjectId,
        'metadata.workflowRunId': params.metadata.workflowRunId,
        'metadata.actionId': params.metadata.actionId,
      });
      if (existing) {
        logger.info(`Notification already created for workflow run ${params.metadata.workflowRunId} action ${params.metadata.actionId}; returning existing.`);
        return existing;
      }
    }

    const notification = await Notification.create({
      clientId: clientObjectId,
      recipientUserId: userObjectId,
      type: params.type || 'workflow_alert',
      title: params.title.trim().slice(0, 200),
      message: params.message.trim().slice(0, 2000),
      severity: params.severity || 'info',
      sourceType: params.sourceType || 'system',
      sourceId: params.sourceId,
      metadata: params.metadata || {},
      readAt: null,
    });

    return notification;
  }

  /**
   * Lists notifications for an authenticated user in a client workspace.
   */
  public static async listNotifications(
    clientId: string,
    userId: string,
    query: {
      unreadOnly?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    notifications: INotification[];
    total: number;
    unreadCount: number;
    page: number;
    totalPages: number;
  }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const filter: Record<string, any> = {
      clientId: clientObjectId,
      recipientUserId: userObjectId,
    };

    if (query.unreadOnly) {
      filter.readAt = null;
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        clientId: clientObjectId,
        recipientUserId: userObjectId,
        readAt: null,
      }),
    ]);

    return {
      notifications: (notifications as unknown) as INotification[],
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves unread notification count for an authenticated user in a workspace.
   */
  public static async getUnreadCount(clientId: string, userId: string): Promise<number> {
    return Notification.countDocuments({
      clientId: new mongoose.Types.ObjectId(clientId),
      recipientUserId: new mongoose.Types.ObjectId(userId),
      readAt: null,
    });
  }

  /**
   * Marks a single notification as read.
   */
  public static async markAsRead(
    clientId: string,
    userId: string,
    notificationId: string
  ): Promise<INotification> {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new AppError('Invalid notification ID format', 400);
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(notificationId),
        clientId: new mongoose.Types.ObjectId(clientId),
        recipientUserId: new mongoose.Types.ObjectId(userId),
      },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found or access denied', 404);
    }

    return notification;
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  public static async markAllAsRead(
    clientId: string,
    userId: string
  ): Promise<{ modifiedCount: number }> {
    const result = await Notification.updateMany(
      {
        clientId: new mongoose.Types.ObjectId(clientId),
        recipientUserId: new mongoose.Types.ObjectId(userId),
        readAt: null,
      },
      { $set: { readAt: new Date() } }
    );

    return { modifiedCount: result.modifiedCount };
  }
}
