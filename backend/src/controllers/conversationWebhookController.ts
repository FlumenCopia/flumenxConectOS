import { Request, Response, NextFunction } from 'express';
import { ConversationWebhookService } from '../services/conversationWebhook.service';
import { sendSuccess } from '../utils/response';
import { logger } from '../config/logger';

/**
 * Handles GET verification handshake from Meta (hub.mode, hub.challenge, hub.verify_token)
 */
export const verifyWebhookChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && challenge) {
      logger.info(`[Webhook] Meta verification handshake succeeded with verify_token=${token}`);
      // Meta strictly expects plain-text response containing the exact challenge value
      return res.status(200).send(challenge);
    }

    return res.status(200).json({
      status: 'active',
      message: 'FlumenX ConectOS Messaging Webhook Endpoint is online and listening',
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Handles POST notifications: supports both Meta Cloud API webhook format and custom JSON
 */
export const handleInboundWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Check if Meta WhatsApp Cloud API webhook format
    if (req.body?.object === 'whatsapp_business_account') {
      const metaResult = await ConversationWebhookService.processMetaWebhook(req.body);
      return res.status(200).json({
        success: true,
        message: 'Meta WhatsApp webhook acknowledged and processed',
        data: metaResult,
      });
    }

    // 2. Standard internal / custom webhook format
    const result = await ConversationWebhookService.processInboundWebhook(
      req.headers,
      req.body,
      req.query.clientId as string | undefined
    );

    return sendSuccess(
      res,
      result,
      result.duplicate ? 'Webhook event acknowledged (duplicate)' : 'Inbound message processed successfully',
      result.duplicate ? 200 : 201
    );
  } catch (error) {
    return next(error);
  }
};
