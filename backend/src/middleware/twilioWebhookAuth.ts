import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { logger } from '../config/logger';
import {
  buildTwilioWebhookUrl,
  resolveTwilioWebhookBaseUrl,
  verifyTwilioRequestSignature,
} from '../utils/crypto';
import { ConversationWebhookService } from '../services/conversationWebhook.service';

const isTwilioWebhookRequest = (req: Request): boolean => {
  const hasTwilioPayload = Boolean(req.body?.AccountSid && req.body?.MessageSid);
  const hasTwilioHeader = req.headers['x-twilio-signature'] !== undefined;
  return hasTwilioPayload || hasTwilioHeader;
};

/**
 * Authenticates incoming Twilio Programmable Messaging webhooks against X-Twilio-Signature
 * using the candidate workspace's decrypted Twilio Auth Token and canonical configured public URL.
 * Non-Twilio requests (Meta webhooks, generic client webhooks) pass through untouched.
 */
export const requireValidTwilioWebhookSignature = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!isTwilioWebhookRequest(req)) {
      next();
      return;
    }

    const baseResolution = resolveTwilioWebhookBaseUrl();
    if (!baseResolution.valid || !baseResolution.baseUrl) {
      logger.error(
        `[TwilioWebhookAuth] Rejected Twilio webhook (${baseResolution.reason || 'unconfigured_url'}) for path ${req.path}`
      );
      next(new AppError('Twilio webhook verification is not configured', 503));
      return;
    }

    const signatureHeader = req.headers['x-twilio-signature'];
    if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) {
      logger.warn(`[TwilioWebhookAuth] Rejected Twilio webhook (missing_signature) for path ${req.path}`);
      next(new AppError('Invalid or missing Twilio webhook signature', 401));
      return;
    }

    const providerResolution = await ConversationWebhookService.resolveTwilioProviderCandidate(req.body);
    if (providerResolution.status !== 'matched' || !providerResolution.authToken) {
      logger.warn(
        `[TwilioWebhookAuth] Rejected Twilio webhook (${providerResolution.status}) for path ${req.path}`
      );
      next(new AppError('Unauthorized Twilio webhook request', 401));
      return;
    }

    const expectedUrl = buildTwilioWebhookUrl(baseResolution.baseUrl, req.originalUrl);
    const verification = verifyTwilioRequestSignature({
      url: expectedUrl,
      signatureHeader,
      authToken: providerResolution.authToken,
      contentType: req.headers['content-type'],
      body: req.body,
      rawBody: req.rawBody,
    });

    if (!verification.valid) {
      logger.warn(
        `[TwilioWebhookAuth] Rejected Twilio webhook (${verification.reason || 'invalid_signature'}) for path ${req.path}`
      );
      next(new AppError('Invalid Twilio webhook signature', 401));
      return;
    }

    req.verifiedTwilioProvider = providerResolution.providerDoc;
    next();
  } catch {
    logger.error(`[TwilioWebhookAuth] Unexpected verification error for path ${req.path}`);
    next(new AppError('Twilio webhook verification failed', 401));
  }
};

