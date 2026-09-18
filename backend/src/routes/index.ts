import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/response';
import authRoutes from './authRoutes';
import { requireAuth, requireSuperAdmin } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { requireClientAccess } from '../middleware/clientAccessMiddleware';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  return sendSuccess(
    res,
    {
      status: 'healthy',
      platform: 'flumenxConectOS',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    'Service is online and healthy'
  );
});

import { env } from '../config/env';
import clientRoutes from './clientRoutes';
import clientSettingsRoutes from './clientSettingsRoutes';
import auditLogRoutes from './auditLogRoutes';
import leadRoutes from './leadRoutes';
import leadWebhookRoutes from './leadWebhookRoutes';

// Mount Authentication routes
router.use('/auth', authRoutes);

// Mount Release 3 Super Admin & Client Workspace routes
router.use('/admin/clients', clientRoutes);
router.use('/admin/audit-logs', auditLogRoutes);
router.use('/client/workspace', clientSettingsRoutes);

import roleRoutes from './roleRoutes';
import adminUserRoutes from './adminUserRoutes';

// Mount RBAC Role Management & Staff User Directory routes
router.use('/admin/roles', roleRoutes);
router.use('/admin/users', adminUserRoutes);

// Mount Release 4 Lead CRM & Webhook Intake routes
router.use('/leads', leadRoutes);
router.use('/', leadWebhookRoutes);

import conversationRoutes from './conversationRoutes';
import contactRoutes from './contactRoutes';
import conversationWebhookRoutes from './conversationWebhookRoutes';

// Mount Release 5 Conversations & Unified Inbox routes
router.use('/conversations/webhook', conversationWebhookRoutes);
router.use('/conversations/webhooks', conversationWebhookRoutes);
router.use('/client/webhooks/conversations', conversationWebhookRoutes);
router.use('/conversations', conversationRoutes);
router.use('/contacts', contactRoutes);

import formRoutes from './formRoutes';
import publicFormRoutes from './publicFormRoutes';

// Mount Release 6 Website Forms & Lead Intake Engine routes
router.use('/forms', formRoutes);
router.use('/public/forms', publicFormRoutes);

import adRoutes from './adRoutes';
import taskRoutes from './taskRoutes';
import reportRoutes from './reportRoutes';
import workflowRoutes from './workflowRoutes';
import notificationRoutes from './notificationRoutes';

// Mount Release 7 Campaigns & Ad Platform Integrations routes
router.use('/ads', adRoutes);

// Mount Release 8 Tasks & Lead Follow-ups routes
router.use('/tasks', taskRoutes);

// Mount Release 9 Reporting & Analytics routes
router.use('/reports', reportRoutes);

// Mount Release 10 Workflow Automation & Notifications routes
router.use('/workflows', workflowRoutes);
router.use('/notifications', notificationRoutes);

import portalRoutes from './portalRoutes';
import clientPortalRoutes from './clientPortalRoutes';
import broadcastRoutes from './broadcastRoutes';

// Mount Release 11 Customer Portal & Self-Service routes
router.use('/portal', portalRoutes);
router.use('/client/portal', clientPortalRoutes);

// Mount Broadcasting & Mass Campaign Blasts routes
router.use('/broadcasts', broadcastRoutes);

// Protected Verification Endpoints (RESTRICTED: mounted strictly in non-production environments for verification/tests)
if (env.NODE_ENV !== 'production') {
  router.get('/test/protected', requireAuth, (req: Request, res: Response) => {
    sendSuccess(res, { user: req.user }, 'Authenticated route accessed successfully');
  });

  router.get('/test/super-admin', requireAuth, requireSuperAdmin, (req: Request, res: Response) => {
    sendSuccess(res, { isSuperAdmin: true }, 'Super Admin privilege confirmed');
  });

  router.get(
    '/test/client/:clientId',
    requireAuth,
    requireClientAccess,
    (req: Request, res: Response) => {
      sendSuccess(
        res,
        {
          clientId: req.resolvedClientId,
          membership: req.clientMembership,
        },
        'Client workspace access verified'
      );
    }
  );

  router.get(
    '/test/permission/:permissionCode',
    requireAuth,
    (req: Request, res: Response, next) => {
      requirePermission(req.params.permissionCode)(req, res, next);
    },
    (req: Request, res: Response) => {
      sendSuccess(
        res,
        { permission: req.params.permissionCode },
        `Permission '${req.params.permissionCode}' verified`
      );
    }
  );
}

export default router;

