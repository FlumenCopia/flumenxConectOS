import { Router } from 'express';
import { ClientPortalController } from '../controllers/clientPortalController';
import { requireAuth } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissionMiddleware';
import { validate } from '../middleware/validate';
import {
  inviteCustomerSchema,
  updateCustomerRequestStaffSchema,
  staffRequestMessageSchema,
} from '../validators/portalValidators';

const router = Router();

// Base protection: require active internal staff authentication
router.use(requireAuth);

// 1. Portal Invitations
router.post(
  '/invitations',
  requirePermission('portal.manage'),
  validate(inviteCustomerSchema),
  ClientPortalController.inviteCustomer
);
router.get(
  '/invitations',
  requirePermission('portal.view'),
  ClientPortalController.listInvitations
);
router.post(
  '/invitations/:id/revoke',
  requirePermission('portal.manage'),
  ClientPortalController.revokeInvitation
);

// 2. Portal User Accounts & Status
router.get(
  '/users',
  requirePermission('portal.view'),
  ClientPortalController.listPortalUsers
);
router.patch(
  '/users/:id/status',
  requirePermission('portal.manage'),
  ClientPortalController.updatePortalUserStatus
);

// 3. Customer Requests (Staff Side)
router.get(
  '/requests',
  requirePermission('portal.view'),
  ClientPortalController.listStaffCustomerRequests
);
router.patch(
  '/requests/:id',
  requirePermission('portal.manage'),
  validate(updateCustomerRequestStaffSchema),
  ClientPortalController.updateCustomerRequest
);
router.post(
  '/requests/:id/messages',
  requirePermission('portal.manage'),
  validate(staffRequestMessageSchema),
  ClientPortalController.addStaffRequestMessage
);
router.get(
  '/requests/:id/attachments/:attachmentId/download',
  requirePermission('portal.view'),
  ClientPortalController.downloadAttachment
);

export default router;
