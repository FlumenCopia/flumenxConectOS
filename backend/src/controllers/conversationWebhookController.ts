import { Request, Response, NextFunction } from 'express';
import { ConversationWebhookService } from '../services/conversationWebhook.service';
import { sendError, sendSuccess } from '../utils/response';
import { logger } from '../config/logger';
import { verifyMetaVerifyToken } from '../utils/crypto';

/**
 * Handles GET verification handshake from Meta (hub.mode, hub.challenge, hub.verify_token)
 */
export const verifyWebhookChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configuredVerifyToken = (process.env.META_VERIFY_TOKEN || '').trim();
    if (!configuredVerifyToken) {
      logger.error('[Webhook] Meta verification handshake rejected: META_VERIFY_TOKEN is not configured.');
      return sendError(res, 'Meta webhook verification token is not configured', 503);
    }

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe') {
      logger.warn('[Webhook] Meta verification handshake rejected: invalid or missing hub.mode.');
      return sendError(res, 'Invalid Meta webhook verification mode', 400);
    }

    if (typeof challenge !== 'string' || challenge.length === 0) {
      logger.warn('[Webhook] Meta verification handshake rejected: missing hub.challenge.');
      return sendError(res, 'Missing Meta webhook challenge parameter', 400);
    }

    const tokenVerification = verifyMetaVerifyToken(token, configuredVerifyToken);
    if (!tokenVerification.valid) {
      logger.warn(`[Webhook] Meta verification handshake rejected (${tokenVerification.reason}).`);
      return sendError(res, 'Invalid or missing Meta webhook verify token', 403);
    }

    logger.info('[Webhook] Meta verification handshake succeeded.');
    // Meta strictly expects plain-text response containing the exact challenge value
    return res.status(200).type('text/plain').send(challenge);
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

    // 1b. Check if Meta Instagram Graph API webhook format
    if (req.body?.object === 'instagram') {
      const instagramResult = await ConversationWebhookService.processInstagramWebhook(req.body);
      return res.status(200).json({
        success: true,
        message: 'Meta Instagram webhook acknowledged and processed',
        data: instagramResult,
      });
    }

    // 1c. Check if Meta Facebook Messenger webhook format
    if (req.body?.object === 'page') {
      const messengerResult = await ConversationWebhookService.processMessengerWebhook(req.body);
      return res.status(200).json({
        success: true,
        message: 'Meta Messenger webhook acknowledged and processed',
        data: messengerResult,
      });
    }

    // 1d. Check if Twilio SMS webhook format (AccountSid & MessageSid present)
    if (req.body?.AccountSid && req.body?.MessageSid) {
      const twilioResult = await ConversationWebhookService.processTwilioWebhook(
        req.body,
        req.verifiedTwilioProvider
      );
      res.type('text/xml');
      return res.status(200).send('<Response></Response>');
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
