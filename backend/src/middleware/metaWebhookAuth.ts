import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { logger } from '../config/logger';
import { resolveMetaWebhookAppSecret, verifyMetaHmacSignature } from '../utils/crypto';

const META_WEBHOOK_OBJECTS = new Set(['whatsapp_business_account', 'instagram', 'page']);

/**
 * Authenticates incoming Meta Cloud API POST webhooks (WhatsApp, Instagram, Messenger)
 * using the raw HTTP request Buffer and X-Hub-Signature-256 HMAC-SHA256 verification.
 * Non-Meta requests (Twilio SMS, custom webhooks) pass through unchanged.
 */
export const requireValidMetaWebhookSignature = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const metaObject = typeof req.body?.object === 'string' ? req.body.object : '';
  if (!META_WEBHOOK_OBJECTS.has(metaObject)) {
    next();
    return;
  }

  const appSecret = resolveMetaWebhookAppSecret(metaObject);
  if (!appSecret) {
    logger.error(
      `[MetaWebhookAuth] Rejected ${metaObject} webhook: platform Meta App Secret is not configured.`
    );
    next(new AppError('Meta webhook signature verification is not configured', 503));
    return;
  }

  const verification = verifyMetaHmacSignature(
    req.rawBody,
    req.headers['x-hub-signature-256'],
    appSecret
  );

  if (!verification.valid) {
    logger.warn(
      `[MetaWebhookAuth] Rejected ${metaObject} webhook (${verification.reason || 'invalid_signature'}) for ${req.originalUrl}`
    );
    next(new AppError('Invalid or missing Meta webhook signature', 401));
    return;
  }

  next();
};

