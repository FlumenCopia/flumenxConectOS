import { Router, Request, Response, NextFunction } from 'express';
import { handleInboundWebhook, verifyWebhookChallenge } from '../controllers/conversationWebhookController';
import { webhookRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { inboundWebhookSchema } from '../validators/conversationValidators';

const router = Router();

// GET: Meta Webhook challenge verification (hub.mode, hub.challenge, hub.verify_token)
router.get('/', verifyWebhookChallenge);
router.get('/whatsapp', verifyWebhookChallenge);

// Conditional validation: Meta WhatsApp payloads bypass internal schema
const conditionalValidate = (req: Request, res: Response, next: NextFunction) => {
  if (req.body?.object === 'whatsapp_business_account') {
    return next();
  }
  return validate(inboundWebhookSchema)(req, res, next);
};

// POST: Inbound webhook ingestion with rate limit
router.post('/', webhookRateLimiter, conditionalValidate, handleInboundWebhook);
router.post('/whatsapp', webhookRateLimiter, conditionalValidate, handleInboundWebhook);

export default router;
