import { Request, Response, NextFunction } from 'express';
import { LeadWebhookService } from '../services/leadWebhook.service';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class LeadWebhookController {
  /**
   * POST /api/v1/client/webhooks/leads
   * Public webhook ingestion endpoint authenticated via webhook key & secret.
   */
  public static async handleWebhookIntake(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Extract Key ID
      const keyId =
        (req.headers['x-webhook-key'] as string) ||
        (req.query.keyId as string) ||
        req.body?.keyId;

      // 2. Extract Secret (Header or Bearer)
      let rawSecret = req.headers['x-webhook-secret'] as string;
      if (!rawSecret && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        rawSecret = req.headers.authorization.split(' ')[1];
      }
      if (!rawSecret && req.body?.secret) {
        rawSecret = req.body.secret;
      }

      const timestampHeader = req.headers['x-webhook-timestamp'] as string;

      if (!keyId || !rawSecret) {
        throw new AppError('Webhook authentication required: Provide X-Webhook-Key and X-Webhook-Secret.', 401);
      }

      const result = await LeadWebhookService.processWebhookIntake(
        keyId.toString().trim(),
        rawSecret.toString().trim(),
        req.body,
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestampHeader,
        }
      );

      sendSuccess(res, result, 'Lead ingested via webhook successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/clients/:clientId/webhooks
   */
  public static async listWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.clientId || req.resolvedClientId!;
      const webhooks = await LeadWebhookService.listWebhooks(clientId);
      sendSuccess(res, webhooks, 'Client webhook credentials retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/clients/:clientId/webhooks
   */
  public static async createWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.clientId || req.resolvedClientId!;
      const actor = {
        id: req.user!._id.toString(),
        email: req.user!.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await LeadWebhookService.createWebhook(clientId, req.body, actor);
      sendSuccess(
        res,
        result,
        'Webhook credential created successfully. Store the raw secret safely; it will not be displayed again.',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/webhooks/:webhookId/rotate
   */
  public static async rotateWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.clientId || req.resolvedClientId!;
      const { webhookId } = req.params;
      const actor = {
        id: req.user!._id.toString(),
        email: req.user!.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await LeadWebhookService.rotateWebhookSecret(clientId, webhookId, actor);
      sendSuccess(
        res,
        result,
        'Webhook secret rotated successfully. Store the raw secret safely; it will not be displayed again.'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/webhooks/:webhookId/status
   */
  public static async updateWebhookStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.clientId || req.resolvedClientId!;
      const { webhookId } = req.params;
      const { status } = req.body;
      const actor = {
        id: req.user!._id.toString(),
        email: req.user!.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      const result = await LeadWebhookService.updateWebhookStatus(clientId, webhookId, status, actor);
      sendSuccess(res, result, `Webhook status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/clients/:clientId/webhooks/:webhookId
   */
  public static async deleteWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.params.clientId || req.resolvedClientId!;
      const { webhookId } = req.params;
      const actor = {
        id: req.user!._id.toString(),
        email: req.user!.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      };

      await LeadWebhookService.deleteWebhook(clientId, webhookId, actor);
      sendSuccess(res, null, 'Webhook credential deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
