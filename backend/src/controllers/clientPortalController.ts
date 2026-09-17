import { Request, Response, NextFunction } from 'express';
import { ClientPortalManagementService } from '../services/clientPortalManagement.service';
import { ClientMembership } from '../models/ClientMembership';
import { Client } from '../models/Client';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';
import {
  inviteCustomerSchema,
  updateCustomerRequestStaffSchema,
  staffRequestMessageSchema,
} from '../validators/portalValidators';

export class ClientPortalController {
  /**
   * Resolves target clientId and verifies tenant membership authorization.
   */
  public static async resolveScopeClientId(req: Request): Promise<string> {
    const rawId =
      req.resolvedClientId ||
      (req.headers['x-client-id'] as string) ||
      (req.query.clientId as string) ||
      (req.body?.clientId as string) ||
      (req.auth as any)?.activeClientId;

    if (req.user!.isSuperAdmin) {
      if (rawId) return rawId.toString().trim();
      const membership = await ClientMembership.findOne({
        userId: req.user!._id,
        status: 'active',
      });
      if (membership) return membership.clientId.toString();
      const defaultClient = await Client.findOne({ status: 'active', isArchived: { $ne: true } });
      if (defaultClient) return defaultClient._id.toString();
      throw new AppError('Client ID context is required. Pass x-client-id header or clientId parameter.', 400);
    }

    if (rawId) {
      const trimmed = rawId.toString().trim();
      const membership = await ClientMembership.findOne({
        userId: req.user!._id,
        clientId: trimmed,
        status: 'active',
      });
      if (!membership) {
        throw new AppError('Access denied: You are not authorized for this client workspace.', 403);
      }
      return trimmed;
    }

    const membership = await ClientMembership.findOne({
      userId: req.user!._id,
      status: 'active',
    });
    if (!membership) {
      throw new AppError('No active client membership found for user.', 403);
    }
    return membership.clientId.toString();
  }

  /**
   * POST /api/v1/client/portal/invitations
   * Staff invites a customer to the portal
   */
  public static async inviteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const validated = inviteCustomerSchema.parse(req.body);

      const result = await ClientPortalManagementService.inviteCustomer(
        clientId,
        validated,
        {
          id: req.user?._id?.toString(),
          name: req.user?.name,
          email: req.user?.email,
        },
        req.ip,
        req.get('user-agent')
      );

      sendSuccess(res, result, 'Invitation sent successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/client/portal/users
   * List customer portal users
   */
  public static async listPortalUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const result = await ClientPortalManagementService.listPortalUsers(clientId, {
        status: req.query.status as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/client/portal/invitations
   * List customer portal invitations
   */
  public static async listInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const result = await ClientPortalManagementService.listInvitations(clientId, {
        status: req.query.status as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/client/portal/invitations/:id/revoke
   * Revoke a pending invitation
   */
  public static async revokeInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const invitation = await ClientPortalManagementService.revokeInvitation(
        clientId,
        req.params.id,
        {
          id: req.user?._id?.toString(),
          email: req.user?.email,
        }
      );

      sendSuccess(res, { invitation, message: 'Invitation revoked successfully' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/client/portal/users/:id/status
   * Suspend or activate a portal user
   */
  public static async updatePortalUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const { status } = req.body;
      if (status !== 'active' && status !== 'suspended') {
        throw new AppError('Status must be active or suspended', 400);
      }

      const user = await ClientPortalManagementService.updatePortalUserStatus(
        clientId,
        req.params.id,
        status,
        {
          id: req.user?._id?.toString(),
          email: req.user?.email,
        }
      );

      sendSuccess(res, { user, message: `Customer portal user ${status} successfully` });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/client/portal/requests
   * Staff view of all customer requests in workspace
   */
  public static async listStaffCustomerRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const result = await ClientPortalManagementService.listStaffCustomerRequests(clientId, {
        status: req.query.status as string,
        category: req.query.category as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/client/portal/requests/:id
   * Staff updates request status, priority, or assignment
   */
  public static async updateCustomerRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const validated = updateCustomerRequestStaffSchema.parse(req.body);

      const request = await ClientPortalManagementService.updateCustomerRequest(
        clientId,
        req.params.id,
        validated,
        {
          id: req.user?._id?.toString(),
          name: req.user?.name,
          email: req.user?.email,
        }
      );

      sendSuccess(res, { request }, 'Customer request updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/client/portal/requests/:id/messages
   * Staff replies to customer request (public or internal note)
   */
  public static async addStaffRequestMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const validated = staffRequestMessageSchema.parse(req.body);

      const request = await ClientPortalManagementService.addStaffRequestMessage(
        clientId,
        req.params.id,
        validated,
        {
          id: req.user?._id?.toString(),
          name: req.user?.name,
          email: req.user?.email,
        }
      );

      sendSuccess(res, { request }, 'Message added to request successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Staff downloads attachment from request (gated by malware scanner)
   */
  public static async downloadAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = await ClientPortalController.resolveScopeClientId(req);
      const attachment = await ClientPortalManagementService.getStaffAttachmentDownload(
        clientId,
        req.params.id,
        req.params.attachmentId
      );

      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.name)}"`);
      res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      sendSuccess(res, attachment, 'Attachment authorized for download');
    } catch (err) {
      next(err);
    }
  }
}

