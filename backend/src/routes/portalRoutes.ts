import { Router } from 'express';
import { PortalAuthController } from '../controllers/portalAuthController';
import { PortalCustomerController } from '../controllers/portalCustomerController';
import { requirePortalAuth, requirePortalCsrf } from '../middleware/portalAuthMiddleware';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimit';
import {
  portalLoginSchema,
  acceptInvitationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  portalChangePasswordSchema,
  updateProfileSchema,
  profileChangeRequestSchema,
  submitRequestSchema,
  requestMessageSchema,
  customerConversationMessageSchema,
  customerTaskCommentSchema,
} from '../validators/portalValidators';

const router = Router();

// ============================================================================
// 1. Customer Authentication Routes (Public / Rate-Limited)
// ============================================================================
router.post('/auth/login', authRateLimiter, validate(portalLoginSchema), PortalAuthController.login);
router.get('/auth/invitation/:token', authRateLimiter, PortalAuthController.getInvitation);
router.post('/auth/accept-invitation', authRateLimiter, validate(acceptInvitationSchema), PortalAuthController.acceptInvitation);
router.post('/auth/forgot-password', authRateLimiter, validate(forgotPasswordSchema), PortalAuthController.forgotPassword);
router.post('/auth/reset-password', authRateLimiter, validate(resetPasswordSchema), PortalAuthController.resetPassword);

// Protected Customer Session Routes
router.get('/auth/me', requirePortalAuth, PortalAuthController.getMe);
router.post('/auth/logout', requirePortalAuth, requirePortalCsrf, PortalAuthController.logout);
router.post(
  '/auth/change-password',
  requirePortalAuth,
  requirePortalCsrf,
  validate(portalChangePasswordSchema),
  PortalAuthController.changePassword
);

// ============================================================================
// 2. Customer Profile & Consent Management
// ============================================================================
router.get('/profile', requirePortalAuth, PortalCustomerController.getProfile);
router.patch('/profile', requirePortalAuth, requirePortalCsrf, validate(updateProfileSchema), PortalCustomerController.updateProfile);
router.post('/profile/change-request', requirePortalAuth, requirePortalCsrf, validate(profileChangeRequestSchema), PortalCustomerController.requestProfileChange);

// ============================================================================
// 3. Customer Requests & Ticket Management
// ============================================================================
router.get('/requests', requirePortalAuth, PortalCustomerController.listRequests);
router.post('/requests', requirePortalAuth, requirePortalCsrf, validate(submitRequestSchema), PortalCustomerController.createRequest);
router.get('/requests/:id', requirePortalAuth, PortalCustomerController.getRequest);
router.get('/requests/:id/attachments/:attachmentId/download', requirePortalAuth, PortalCustomerController.downloadAttachment);
router.post('/requests/:id/messages', requirePortalAuth, requirePortalCsrf, validate(requestMessageSchema), PortalCustomerController.addRequestMessage);

// ============================================================================
// 4. Customer Conversations & Inbound/Outbound Thread Tracking
// ============================================================================
router.get('/conversations', requirePortalAuth, PortalCustomerController.listConversations);
router.get('/conversations/:id/messages', requirePortalAuth, PortalCustomerController.getConversationMessages);
router.post('/conversations/:id/messages', requirePortalAuth, requirePortalCsrf, validate(customerConversationMessageSchema), PortalCustomerController.sendConversationMessage);

// ============================================================================
// 5. Customer Visible Tasks & Action Completion
// ============================================================================
router.get('/tasks', requirePortalAuth, PortalCustomerController.listTasks);
router.get('/tasks/:id', requirePortalAuth, PortalCustomerController.getTask);
router.post('/tasks/:id/complete', requirePortalAuth, requirePortalCsrf, PortalCustomerController.completeTaskAction);
router.post('/tasks/:id/comments', requirePortalAuth, requirePortalCsrf, validate(customerTaskCommentSchema), PortalCustomerController.addTaskComment);

// ============================================================================
// 6. Customer In-Portal Notifications
// ============================================================================
router.get('/notifications', requirePortalAuth, PortalCustomerController.listNotifications);
router.get('/notifications/unread-count', requirePortalAuth, PortalCustomerController.getUnreadCount);
router.patch('/notifications/:id/read', requirePortalAuth, requirePortalCsrf, PortalCustomerController.markNotificationRead);
router.post('/notifications/read-all', requirePortalAuth, requirePortalCsrf, PortalCustomerController.markAllNotificationsRead);

// ============================================================================
// 7. Security Scanner Webhook Gate
// ============================================================================
router.post('/webhooks/malware-scan', PortalCustomerController.handleScannerWebhook);

export default router;

