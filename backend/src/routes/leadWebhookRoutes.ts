import { Router } from 'express';
import { LeadWebhookController } from '../controllers/leadWebhookController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { requireClientAccess } from '../middleware/clientAccessMiddleware';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import {
  createWebhookSchema,
  updateWebhookStatusSchema,
  webhookIntakePayloadSchema,
} from '../validators/leadValidators';

const router = Router();

// =============================================================
// Public Webhook Intake Endpoint
// Rate-limited with sliding-window protection & schema validation
// =============================================================
router.post(
  '/client/webhooks/leads',
  authLimiter,
  validate(webhookIntakePayloadSchema),
  LeadWebhookController.handleWebhookIntake
);

// =============================================================
// Webhook Credential Administration
// Strictly protected by user session, tenant isolation, and RBAC
// =============================================================
router.get(
  '/admin/clients/:clientId/webhooks',
  requireAuth,
  requireClientAccess,
  requirePermission('leads.manage_webhooks'),
  LeadWebhookController.listWebhooks
);

router.post(
  '/admin/clients/:clientId/webhooks',
  requireAuth,
  requireClientAccess,
  requirePermission('leads.manage_webhooks'),
  validate(createWebhookSchema),
  LeadWebhookController.createWebhook
);

router.patch(
  '/admin/clients/:clientId/webhooks/:webhookId/rotate',
  requireAuth,
  requireClientAccess,
  requirePermission('leads.manage_webhooks'),
  LeadWebhookController.rotateWebhook
);

router.patch(
  '/admin/clients/:clientId/webhooks/:webhookId/status',
  requireAuth,
  requireClientAccess,
  requirePermission('leads.manage_webhooks'),
  validate(updateWebhookStatusSchema),
  LeadWebhookController.updateWebhookStatus
);

router.delete(
  '/admin/clients/:clientId/webhooks/:webhookId',
  requireAuth,
  requireClientAccess,
  requirePermission('leads.manage_webhooks'),
  LeadWebhookController.deleteWebhook
);

export default router;
