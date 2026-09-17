import { Request, Response, NextFunction } from 'express';
import { PortalCustomerService } from '../services/portalCustomer.service';
import { NotificationService } from '../services/notification.service';
import { MalwareScannerService } from '../services/malwareScanner.service';
import { AppError } from '../middleware/errorHandler';
import { sendSuccess, sendPaginated } from '../utils/response';

export class PortalCustomerController {
  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------
  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await PortalCustomerService.getProfile(req.portalUser!);
      sendSuccess(res, profile, 'Customer profile retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await PortalCustomerService.updateProfile(
        req.portalUser!,
        req.body,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, updated, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async requestProfileChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PortalCustomerService.requestProfileChange(
        req.portalUser!,
        req.body,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, result.request, 'Profile change request submitted', 201);
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Requests
  // -------------------------------------------------------------------------
  public static async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PortalCustomerService.createCustomerRequest(
        req.portalUser!,
        req.body,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, result.request, result.reused ? 'Existing request returned' : 'Request created successfully', result.reused ? 200 : 201);
    } catch (err) {
      next(err);
    }
  }

  public static async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { requests, total, page, totalPages } = await PortalCustomerService.listCustomerRequests(
        req.portalUser!,
        {
          status: req.query.status as string,
          category: req.query.category as string,
          page: Number(req.query.page) || 1,
          limit: Number(req.query.limit) || 10,
        }
      );

      sendPaginated(
        res,
        requests,
        { total, page, limit: Number(req.query.limit) || 10 },
        'Customer requests retrieved'
      );
    } catch (err) {
      next(err);
    }
  }

  public static async getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await PortalCustomerService.getCustomerRequest(req.portalUser!, req.params.id);
      sendSuccess(res, request, 'Customer request details retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async addRequestMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await PortalCustomerService.addRequestMessage(
        req.portalUser!,
        req.params.id,
        req.body,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, request, 'Message sent successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async downloadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const attachment = await PortalCustomerService.getCustomerAttachmentDownload(
        req.portalUser!,
        req.params.id,
        req.params.attachmentId
      );

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.name)}"`);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      sendSuccess(res, attachment, 'Attachment authorized for download');
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Malware Scanner Webhook Handler
  // -------------------------------------------------------------------------
  public static async handleScannerWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = (req.headers['x-scanner-signature'] || req.headers['x-signature']) as string;
      const timestamp = (req.headers['x-scanner-timestamp'] || req.headers['x-timestamp']) as string;

      if (!signature || !timestamp) {
        throw new AppError('Unauthorized: Missing scanner webhook authentication signature or timestamp headers', 401);
      }

      const isValid = MalwareScannerService.verifyWebhookSignature(req.body, signature, timestamp);
      if (!isValid) {
        throw new AppError('Unauthorized: Invalid or expired scanner webhook signature', 401);
      }

      const result = await MalwareScannerService.processScanCallback(req.body);
      sendSuccess(res, result, 'Scanner webhook processed successfully');
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------
  public static async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conversations = await PortalCustomerService.listCustomerConversations(req.portalUser!);
      sendSuccess(res, conversations, 'Conversations retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async getConversationMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversation, messages, total } = await PortalCustomerService.getCustomerConversationMessages(
        req.portalUser!,
        req.params.id,
        Number(req.query.page) || 1,
        Number(req.query.limit) || 50
      );

      sendSuccess(res, { conversation, messages, total }, 'Messages retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async sendConversationMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const message = await PortalCustomerService.sendCustomerConversationMessage(
        req.portalUser!,
        req.params.id,
        req.body,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, message, 'Message delivered', 201);
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------------------
  public static async listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tasks = await PortalCustomerService.listCustomerTasks(req.portalUser!);
      sendSuccess(res, tasks, 'Customer tasks retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await PortalCustomerService.getCustomerTask(req.portalUser!, req.params.id);
      sendSuccess(res, task, 'Customer task details retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async completeTaskAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await PortalCustomerService.completeCustomerTaskAction(
        req.portalUser!,
        req.params.id,
        req.body?.notes,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, task, 'Action completed successfully');
    } catch (err) {
      next(err);
    }
  }

  public static async addTaskComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PortalCustomerService.addCustomerTaskComment(
        req.portalUser!,
        req.params.id,
        req.body.comment,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  public static async listNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = Number(req.query.limit) || 20;
      const { notifications, total, page } = await NotificationService.listNotifications(
        req.portalUser!.clientId.toString(),
        req.portalUser!._id.toString(),
        {
          unreadOnly: req.query.unreadOnly === 'true',
          page: Number(req.query.page) || 1,
          limit,
        }
      );

      sendPaginated(
        res,
        notifications,
        { total, page, limit },
        'Portal notifications retrieved'
      );
    } catch (err) {
      next(err);
    }
  }

  public static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const unreadCount = await NotificationService.getUnreadCount(
        req.portalUser!.clientId.toString(),
        req.portalUser!._id.toString()
      );
      sendSuccess(res, { unreadCount }, 'Unread count retrieved');
    } catch (err) {
      next(err);
    }
  }

  public static async markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notification = await NotificationService.markAsRead(
        req.portalUser!.clientId.toString(),
        req.portalUser!._id.toString(),
        req.params.id
      );
      sendSuccess(res, notification, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  }

  public static async markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await NotificationService.markAllAsRead(
        req.portalUser!.clientId.toString(),
        req.portalUser!._id.toString()
      );
      sendSuccess(res, result, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }
}
