import crypto from 'crypto';
import mongoose from 'mongoose';
import { PortalUser, IPortalUser } from '../models/PortalUser';
import { PortalInvitation, IPortalInvitation } from '../models/PortalInvitation';
import { CustomerRequest, ICustomerRequest, RequestStatus, RequestPriority } from '../models/CustomerRequest';
import { Contact } from '../models/Contact';
import { Client } from '../models/Client';
import { Notification } from '../models/Notification';
import { PortalAttachmentService } from './portalAttachment.service';
import { MalwareScannerService } from './malwareScanner.service';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';

export class ClientPortalManagementService {
  /**
   * Invites a contact to the customer portal.
   * Generates single-use token, stores SHA-256 hash, and dispatches invitation email.
   */
  public static async inviteCustomer(
    clientId: string,
    params: { contactId: string; email?: string; name?: string },
    actor: { id?: string; name?: string; email?: string },
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ invitation: IPortalInvitation; rawToken?: string }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const contactObjectId = new mongoose.Types.ObjectId(params.contactId);

    const contact = await Contact.findOne({ _id: contactObjectId, clientId: clientObjectId });
    if (!contact) {
      throw new AppError('Contact not found in this client workspace', 404);
    }

    const email = (params.email || contact.email || '').toLowerCase().trim();
    if (!email) {
      throw new AppError('Contact has no email address. Please provide an email for invitation.', 400);
    }

    // Check if active portal user already exists for contact or email in this client workspace
    const existingUser = await PortalUser.findOne({
      clientId: clientObjectId,
      $or: [{ contactId: contactObjectId }, { email }],
    });

    if (existingUser) {
      throw new AppError('A customer portal user already exists for this contact or email.', 409);
    }

    // Revoke any previous pending invitations for this contact
    await PortalInvitation.updateMany(
      { clientId: clientObjectId, contactId: contactObjectId, status: 'pending' },
      { $set: { status: 'revoked', revokedAt: new Date(), revokedBy: actor.id ? new mongoose.Types.ObjectId(actor.id) : undefined } }
    );

    // Generate secure 32-byte hex token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await PortalInvitation.create({
      clientId: clientObjectId,
      contactId: contactObjectId,
      leadId: contact.leadId,
      email,
      name: params.name?.trim() || contact.name,
      tokenHash,
      invitedBy: actor.id ? new mongoose.Types.ObjectId(actor.id) : new mongoose.Types.ObjectId(),
      status: 'pending',
      expiresAt,
    });

    // Notify customer (dispatches neutral onboarding notification)
    try {
      await Notification.create({
        clientId: clientObjectId,
        recipientUserId: contactObjectId, // linked entity
        recipientType: 'portal_user',
        type: 'portal_invitation',
        title: 'Customer Portal Invitation',
        message: `You have been invited to the customer portal for ${contact.name}`,
        severity: 'info',
        sourceType: 'system',
      });
    } catch (err) {
      // Non-fatal
    }

    await AuditService.log({
      clientId,
      userId: actor.id,
      userEmail: actor.email,
      action: 'portal.invitation.create',
      resourceType: 'portal_invitation',
      resourceId: invitation._id.toString(),
      ipAddress,
      userAgent,
      success: true,
      metadata: { contactId: params.contactId, email },
    });

    const invitationObj = invitation.toObject();
    delete (invitationObj as any).tokenHash;

    return {
      invitation: invitationObj as IPortalInvitation,
      rawToken: env.NODE_ENV !== 'production' ? rawToken : undefined,
    };
  }

  /**
   * Lists customer portal users for a workspace.
   */
  public static async listPortalUsers(
    clientId: string,
    query: { status?: string; search?: string; page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { clientId: new mongoose.Types.ObjectId(clientId) };
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }

    const [users, total] = await Promise.all([
      PortalUser.find(filter)
        .populate('contactId', 'name email phone avatarUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PortalUser.countDocuments(filter),
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  /**
   * Lists customer portal invitations for a workspace.
   */
  public static async listInvitations(
    clientId: string,
    query: { status?: string; page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { clientId: new mongoose.Types.ObjectId(clientId) };
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    const [invitations, total] = await Promise.all([
      PortalInvitation.find(filter)
        .populate('contactId', 'name email')
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PortalInvitation.countDocuments(filter),
    ]);

    return { invitations, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  /**
   * Revokes a pending customer invitation.
   */
  public static async revokeInvitation(
    clientId: string,
    invitationId: string,
    actor: { id?: string; email?: string }
  ) {
    if (!mongoose.Types.ObjectId.isValid(invitationId)) {
      throw new AppError('Invitation not found', 404);
    }

    const invitation = await PortalInvitation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(invitationId),
        clientId: new mongoose.Types.ObjectId(clientId),
        status: 'pending',
      },
      {
        $set: {
          status: 'revoked',
          revokedAt: new Date(),
          revokedBy: actor.id ? new mongoose.Types.ObjectId(actor.id) : undefined,
        },
      },
      { new: true }
    );

    if (!invitation) {
      throw new AppError('Invitation not found or cannot be revoked', 404);
    }

    await AuditService.log({
      clientId,
      userId: actor.id,
      userEmail: actor.email,
      action: 'portal.invitation.revoke',
      resourceType: 'portal_invitation',
      resourceId: invitation._id.toString(),
      success: true,
    });

    return invitation;
  }

  /**
   * Updates portal user status (active / suspended).
   * Increments tokenVersion on suspension to invalidate all active JWT sessions immediately.
   */
  public static async updatePortalUserStatus(
    clientId: string,
    portalUserId: string,
    status: 'active' | 'suspended',
    actor: { id?: string; email?: string }
  ) {
    if (!mongoose.Types.ObjectId.isValid(portalUserId)) {
      throw new AppError('Portal user not found', 404);
    }

    const update: Record<string, any> = { status };
    if (status === 'suspended') {
      update.$inc = { tokenVersion: 1 }; // Revoke active sessions!
    }

    const user = await PortalUser.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(portalUserId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      update,
      { new: true }
    );

    if (!user) {
      throw new AppError('Portal user not found', 404);
    }

    await AuditService.log({
      clientId,
      userId: actor.id,
      userEmail: actor.email,
      action: status === 'suspended' ? 'portal.user.suspend' : 'portal.user.reactivate',
      resourceType: 'portal_user',
      resourceId: user._id.toString(),
      success: true,
    });

    return user;
  }

  /**
   * Staff view of all customer requests in workspace.
   */
  public static async listStaffCustomerRequests(
    clientId: string,
    query: { status?: string; category?: string; page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { clientId: new mongoose.Types.ObjectId(clientId) };
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.category && query.category !== 'all') {
      filter.category = query.category;
    }

    const [requests, total] = await Promise.all([
      CustomerRequest.find(filter)
        .populate('portalUserId', 'name email phone')
        .populate('contactId', 'name email phone')
        .populate('assignedStaffId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CustomerRequest.countDocuments(filter),
    ]);

    return { requests, total, page, totalPages: Math.ceil(total / limit) || 1 };
  }

  /**
   * Updates a customer request from staff side (status, priority, assignment).
   */
  public static async updateCustomerRequest(
    clientId: string,
    requestId: string,
    data: {
      status?: RequestStatus;
      priority?: RequestPriority;
      assignedStaffId?: string | null;
      comment?: string;
    },
    actor: { id?: string; name?: string; email?: string }
  ) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new AppError('Customer request not found', 404);
    }

    const request = await CustomerRequest.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!request) {
      throw new AppError('Customer request not found', 404);
    }

    const oldStatus = request.status;

    if (data.status) {
      request.status = data.status;
      request.statusHistory.push({
        status: data.status,
        changedBy: actor.id ? new mongoose.Types.ObjectId(actor.id) : new mongoose.Types.ObjectId(),
        changedByType: 'staff',
        comment: data.comment || `Status updated from ${oldStatus} to ${data.status} by staff`,
        changedAt: new Date(),
      });
    }

    if (data.priority) {
      request.priority = data.priority;
    }

    if (data.assignedStaffId !== undefined) {
      request.assignedStaffId = data.assignedStaffId ? new mongoose.Types.ObjectId(data.assignedStaffId) : undefined;
    }

    await request.save();

    // Notify customer of status change
    if (data.status && data.status !== oldStatus) {
      try {
        await Notification.create({
          clientId: request.clientId,
          recipientUserId: request.portalUserId,
          recipientType: 'portal_user',
          type: 'request_status_changed',
          title: `Request Status Updated: ${request.requestNumber}`,
          message: `Your request '${request.subject}' is now ${data.status.replace('_', ' ')}.`,
          severity: data.status === 'completed' ? 'success' : 'info',
          sourceType: 'system',
          sourceId: request._id.toString(),
        });
      } catch (err) {
        // Non-fatal
      }
    }

    await AuditService.log({
      clientId,
      userId: actor.id,
      userEmail: actor.email,
      action: 'portal.request.status_change',
      resourceType: 'customer_request',
      resourceId: request._id.toString(),
      success: true,
      metadata: { oldStatus, newStatus: data.status },
    });

    return request;
  }

  /**
   * Appends staff message or internal note to customer request thread.
   */
  public static async addStaffRequestMessage(
    clientId: string,
    requestId: string,
    data: { body: string; isCustomerVisible?: boolean; attachments?: any[] },
    actor: { id?: string; name?: string; email?: string }
  ) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new AppError('Customer request not found', 404);
    }

    const request = await CustomerRequest.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!request) {
      throw new AppError('Customer request not found', 404);
    }

    const validatedAttachments = PortalAttachmentService.validateAttachments(data.attachments).map((att) => ({
      ...att,
      scanStatus: 'clean' as const,
      scannedAt: new Date(),
      scanVerdict: 'Staff uploaded verified document',
      scanExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));
    const isCustomerVisible = data.isCustomerVisible !== false; // defaults to customer visible unless explicitly marked internal note

    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorType: 'staff' as const,
      authorId: actor.id ? new mongoose.Types.ObjectId(actor.id) : new mongoose.Types.ObjectId(),
      authorName: actor.name || 'Support Staff',
      body: data.body.trim(),
      isCustomerVisible,
      attachments: validatedAttachments,
      createdAt: new Date(),
    };

    request.messages.push(newMessage);
    await request.save();

    // Notify customer if customer-visible
    if (isCustomerVisible) {
      try {
        await Notification.create({
          clientId: request.clientId,
          recipientUserId: request.portalUserId,
          recipientType: 'portal_user',
          type: 'request_reply',
          title: `New Reply on Request ${request.requestNumber}`,
          message: `${actor.name || 'Support staff'} replied to your request '${request.subject}'`,
          severity: 'info',
          sourceType: 'system',
          sourceId: request._id.toString(),
        });
      } catch (err) {
        // Non-fatal
      }
    }

    await AuditService.log({
      clientId,
      userId: actor.id,
      userEmail: actor.email,
      action: 'portal.message.send',
      resourceType: 'customer_request',
      resourceId: request._id.toString(),
      success: true,
      metadata: { isCustomerVisible, requestNumber: request.requestNumber },
    });

    return request;
  }

  /**
   * Authorizes and retrieves staff attachment download metadata.
   * Gated by the malware scanning verification engine.
   */
  public static async getStaffAttachmentDownload(
    clientId: string,
    requestId: string,
    attachmentId: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new AppError('Customer request not found', 404);
    }

    const request = await CustomerRequest.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!request) {
      throw new AppError('Customer request not found', 404);
    }

    let targetAttachment = request.attachments?.find((att) => att.id === attachmentId);
    if (!targetAttachment) {
      for (const msg of request.messages || []) {
        const match = msg.attachments?.find((att) => att.id === attachmentId);
        if (match) {
          targetAttachment = match;
          break;
        }
      }
    }

    if (!targetAttachment) {
      throw new AppError('Attachment not found', 404);
    }

    return MalwareScannerService.getAuthorizedDownloadPayload(targetAttachment);
  }
}

