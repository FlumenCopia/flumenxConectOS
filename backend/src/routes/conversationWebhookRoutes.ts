import { Router } from 'express';
import { handleInboundWebhook } from '../controllers/conversationWebhookController';
import { webhookRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { inboundWebhookSchema } from '../validators/conversationValidators';

const router = Router();

// Inbound webhook ingestion with rate limit and validation
router.post(
  '/',
  webhookRateLimiter,
  validate(inboundWebhookSchema),
  handleInboundWebhook
);

export default router;
