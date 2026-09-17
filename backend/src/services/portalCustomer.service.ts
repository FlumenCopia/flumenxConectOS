import mongoose from 'mongoose';
import { PortalUser, IPortalUser } from '../models/PortalUser';
import { CustomerRequest, ICustomerRequest, RequestCategory } from '../models/CustomerRequest';
import { Conversation } from '../models/Conversation';
import { Message, IMessage } from '../models/Message';
import { Task, ITask } from '../models/Task';
import { TaskEvent } from '../models/TaskEvent';
import { Contact } from '../models/Contact';
import { Client } from '../models/Client';
import { Notification } from '../models/Notification';
import { PortalAttachmentService, IValidatedAttachment } from './portalAttachment.service';
import { MalwareScannerService } from './malwareScanner.service';
import { TaskService } from './task.service';
import { EventDispatcher } from './eventDispatcher.service';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/errorHandler';

// HTML / Script Sanitizer to prevent Stored XSS
const sanitizeContent = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
};

export class PortalCustomerService {
  /**
   * Retrieves profile for authenticated portal user.
   */
  public static async getProfile(portalUser: IPortalUser) {
    const [freshUser, client, contact] = await Promise.all([
      PortalUser.findById(portalUser._id),
      Client.findById(portalUser.clientId).select('name slug branding status'),
      Contact.findById(portalUser.contactId).select('name email phone avatarUrl metadata'),
    ]);

    if (!freshUser) {
      throw new AppError('Customer profile not found', 404);
    }

    return {
      id: freshUser._id.toString(),
      clientId: freshUser.clientId.toString(),
      clientName: client?.name || 'Workspace',
      contactId: freshUser.contactId.toString(),
      leadId: freshUser.leadId?.toString(),
      name: freshUser.name,
      email: freshUser.email,
      phone: freshUser.phone || contact?.phone || '',
      avatarUrl: freshUser.avatarUrl || contact?.avatarUrl || '',
      status: freshUser.status,
      communicationPreferences: freshUser.communicationPreferences,
      consentGiven: freshUser.consentGiven,
      consentGivenAt: freshUser.consentGivenAt,
      lastLoginAt: freshUser.lastLoginAt,
      createdAt: freshUser.createdAt,
    };
  }

  /**
   * Updates only allowlisted profile fields (name, phone, communicationPreferences, consentGiven).
   */
  public static async updateProfile(
    portalUser: IPortalUser,
    data: {
      name?: string;
      phone?: string;
      communicationPreferences?: {
        email?: boolean;
        sms?: boolean;
        whatsapp?: boolean;
        marketing?: boolean;
      };
      consentGiven?: boolean;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const updates: Record<string, any> = {};

    if (data.name !== undefined) {
      updates.name = data.name.trim();
    }
    if (data.phone !== undefined) {
      updates.phone = data.phone.trim();
    }
    if (data.communicationPreferences) {
      updates.communicationPreferences = {
        ...portalUser.communicationPreferences,
        ...data.communicationPreferences,
      };
    }
    if (data.consentGiven !== undefined) {
      updates.consentGiven = Boolean(data.consentGiven);
      updates.consentGivenAt = new Date();
    }

    const updated = await PortalUser.findByIdAndUpdate(
      portalUser._id,
      { $set: updates },
      { new: true }
    );

    // Sync to Contact record if name or phone changed
    if (updates.name || updates.phone) {
      await Contact.updateOne(
        { _id: portalUser.contactId, clientId: portalUser.clientId },
        {
          $set: {
            ...(updates.name ? { name: updates.name } : {}),
            ...(updates.phone ? { phone: updates.phone } : {}),
          },
        }
      );
    }

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: data.consentGiven !== undefined ? 'portal.consent.update' : 'portal.profile.update',
      resourceType: 'portal_user',
      resourceId: portalUser._id.toString(),
      ipAddress,
      userAgent,
      success: true,
      metadata: { changedFields: Object.keys(updates) },
    });

    return this.getProfile(updated!);
  }

  /**
   * Submits a change request for sensitive profile fields that require staff approval.
   */
  public static async requestProfileChange(
    portalUser: IPortalUser,
    data: {
      fieldName: string;
      requestedValue: string;
      reason?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ) {
    const idempotencyKey = `pcr_${portalUser._id}_${data.fieldName}_${Date.now()}`;
    return this.createCustomerRequest(
      portalUser,
      {
        subject: `Profile Change Request: ${data.fieldName}`,
        description: `Requested change for field "${data.fieldName}" to: "${data.requestedValue}".\nReason: ${data.reason || 'None provided'}`,
        category: 'profile_change',
        priority: 'normal',
        idempotencyKey,
      },
      ipAddress,
      userAgent
    );
  }

  /**
   * Submits a service/support request with scoped idempotency and task linking.
   */
  public static async createCustomerRequest(
    portalUser: IPortalUser,
    data: {
      subject: string;
      description: string;
      category: RequestCategory;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      idempotencyKey: string;
      attachments?: any[];
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ request: ICustomerRequest; reused: boolean }> {
    const idempotencyKey = data.idempotencyKey.trim();

    const cleanSubject = sanitizeContent(data.subject.trim());
    const cleanDescription = sanitizeContent(data.description.trim());

    // 1. Scoped Idempotency Check: (clientId + portalUserId + idempotencyKey)
    const existing = await CustomerRequest.findOne({
      clientId: portalUser.clientId,
      portalUserId: portalUser._id,
      idempotencyKey,
    });

    if (existing) {
      // If conflicting payload under identical idempotency key, reject with 409
      if (existing.subject !== cleanSubject || existing.category !== data.category) {
        throw new AppError('Idempotency conflict: A request with this key already exists with different parameters.', 409);
      }
      return { request: existing, reused: true };
    }

    // 2. Validate Attachments & Isolate into Quarantine
    const validatedAttachments = PortalAttachmentService.validateAttachments(data.attachments);
    const requestId = new mongoose.Types.ObjectId();
    const quarantinedAttachments = validatedAttachments.map((att) =>
      MalwareScannerService.initQuarantineMetadata(portalUser.clientId.toString(), requestId.toString(), att)
    );

    // 3. Generate Request Number
    const count = await CustomerRequest.countDocuments({ clientId: portalUser.clientId });
    const requestNumber = `REQ-${(count + 1).toString().padStart(4, '0')}`;

    // 4. Create Request with Race-Safe Concurrency Handling
    let request: ICustomerRequest;
    try {
      request = await CustomerRequest.create({
        _id: requestId,
        clientId: portalUser.clientId,
        portalUserId: portalUser._id,
        contactId: portalUser.contactId,
        leadId: portalUser.leadId,
        requestNumber,
        subject: cleanSubject,
        description: cleanDescription,
        category: data.category,
        priority: data.priority || 'normal',
        status: 'submitted',
        idempotencyKey,
        attachments: quarantinedAttachments,
        messages: [
          {
            id: `msg_${Date.now()}_1`,
            authorType: 'customer',
            authorId: portalUser._id,
            authorName: portalUser.name,
            body: cleanDescription,
            isCustomerVisible: true,
            attachments: quarantinedAttachments,
            createdAt: new Date(),
          },
        ],
        statusHistory: [
          {
            status: 'submitted',
            changedBy: portalUser._id,
            changedByType: 'customer',
            comment: 'Request submitted by customer via portal',
            changedAt: new Date(),
          },
        ],
      });
    } catch (createErr: any) {
      if (createErr.code === 11000) {
        // Concurrent duplicate claim detected: retrieve and return the existing record
        const duplicate = await CustomerRequest.findOne({
          clientId: portalUser.clientId,
          portalUserId: portalUser._id,
          idempotencyKey,
        });
        if (duplicate) {
          return { request: duplicate, reused: true };
        }
      }
      throw createErr;
    }

    // 5. Create Internal Linked Task for Staff (with customer visibility enabled)
    try {
      const task = await TaskService.createTask(
        portalUser.clientId.toString(),
        {
          title: `[Customer Request] ${requestNumber}: ${cleanSubject}`,
          description: cleanDescription,
          taskType: 'other',
          priority: data.priority || 'normal',
          dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          contactId: portalUser.contactId.toString(),
          leadId: portalUser.leadId?.toString(),
          isCustomerVisible: true,
          customerActionRequired: false,
          isAutoGenerated: true,
          idempotencyKey: `task_req_${request._id}`,
          metadata: {
            customerRequestId: request._id.toString(),
            category: data.category,
          },
        },
        {
          id: portalUser._id.toString(),
          name: portalUser.name,
        }
      );

      request.linkedTaskId = task._id;
      await request.save();
    } catch (taskErr) {
      // Non-fatal if task creation errors
    }

    // 6. Notify Workspace Staff
    try {
      await Notification.create({
        clientId: portalUser.clientId,
        recipientUserId: portalUser._id, // placeholder user ref
        recipientType: 'user',
        type: 'customer_request_created',
        title: `New Customer Request: ${requestNumber}`,
        message: `${portalUser.name} submitted request '${cleanSubject}'`,
        severity: 'info',
        sourceType: 'system',
        sourceId: request._id.toString(),
        metadata: { customerRequestId: request._id.toString(), portalUserId: portalUser._id.toString() },
      });
    } catch (err) {
      // Non-fatal
    }

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.request.create',
      resourceType: 'customer_request',
      resourceId: request._id.toString(),
      ipAddress,
      userAgent,
      success: true,
      metadata: { requestNumber, category: data.category },
    });

    return { request, reused: false };
  }

  /**
   * Lists customer requests strictly isolated to authenticated portal user.
   */
  public static async listCustomerRequests(
    portalUser: IPortalUser,
    query: { status?: string; category?: string; page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {
      clientId: portalUser.clientId,
      portalUserId: portalUser._id,
    };

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.category && query.category !== 'all') {
      filter.category = query.category;
    }

    const [requests, total] = await Promise.all([
      CustomerRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-messages'), // exclude heavy thread in list view
      CustomerRequest.countDocuments(filter),
    ]);

    return {
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single request details, strictly verifying ownership and filtering messages.
   */
  public static async getCustomerRequest(portalUser: IPortalUser, requestId: string): Promise<ICustomerRequest> {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new AppError('Customer request not found', 404);
    }

    const request = await CustomerRequest.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      clientId: portalUser.clientId,
      portalUserId: portalUser._id,
    });

    if (!request) {
      throw new AppError('Customer request not found', 404);
    }

    // Filter messages: customer only sees customer-visible messages (internal staff notes stripped)
    // Internal status or channel overrides visibility; missing/legacy fields default to non-visible
    request.messages = request.messages
      .filter((m) => m.isCustomerVisible === true && !(m as any).isInternal && (m as any).channel !== 'internal')
      .slice(-100);

    return request;
  }

  /**
   * Appends follow-up message to customer request.
   */
  public static async addRequestMessage(
    portalUser: IPortalUser,
    requestId: string,
    data: { body: string; attachments?: any[]; idempotencyKey?: string },
    ipAddress?: string,
    userAgent?: string
  ): Promise<ICustomerRequest> {
    const request = await this.getCustomerRequest(portalUser, requestId);

    if (request.status === 'closed') {
      throw new AppError('Cannot add message to a closed request. Please open a new request.', 400);
    }

    // Idempotency check for request message
    if (data.idempotencyKey) {
      const exists = request.messages.some((m) => m.idempotencyKey === data.idempotencyKey);
      if (exists) {
        return request;
      }
    }

    const validatedAttachments = PortalAttachmentService.validateAttachments(data.attachments);
    const cleanBody = sanitizeContent(data.body.trim());
    const quarantinedAttachments = validatedAttachments.map((att) =>
      MalwareScannerService.initQuarantineMetadata(portalUser.clientId.toString(), requestId, att)
    );

    const newMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      authorType: 'customer' as const,
      authorId: portalUser._id,
      authorName: portalUser.name,
      body: cleanBody,
      isCustomerVisible: true,
      attachments: quarantinedAttachments,
      idempotencyKey: data.idempotencyKey,
      createdAt: new Date(),
    };

    request.messages.push(newMessage);

    // If request was completed, re-open to in_progress
    if (request.status === 'completed') {
      request.status = 'in_progress';
      request.statusHistory.push({
        status: 'in_progress',
        changedBy: portalUser._id,
        changedByType: 'customer',
        comment: 'Re-opened by customer follow-up message',
        changedAt: new Date(),
      });
    }

    await request.save();

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.message.send',
      resourceType: 'customer_request',
      resourceId: request._id.toString(),
      ipAddress,
      userAgent,
      success: true,
      metadata: { requestNumber: request.requestNumber },
    });

    request.messages = request.messages.filter((m) => m.isCustomerVisible !== false);
    return request;
  }

  /**
   * Authorizes and retrieves customer attachment download metadata.
   * Enforces strict workspace, contact, and customer-visible message boundaries.
   */
  public static async getCustomerAttachmentDownload(
    portalUser: IPortalUser,
    requestId: string,
    attachmentId: string
  ): Promise<{ name: string; url: string; mimeType: string; size: number }> {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      throw new AppError('Customer request not found', 404);
    }

    const request = await CustomerRequest.findOne({
      _id: new mongoose.Types.ObjectId(requestId),
      clientId: portalUser.clientId,
      contactId: portalUser.contactId,
    });

    if (!request) {
      throw new AppError('Customer request not found', 404);
    }

    // 1. Check primary request attachments
    let targetAttachment = request.attachments?.find((att) => att.id === attachmentId);

    // 2. Check customer-visible thread messages
    if (!targetAttachment) {
      for (const msg of request.messages || []) {
        // Enforce safe default & internal overrides
        if (msg.isCustomerVisible === true && !(msg as any).isInternal && (msg as any).channel !== 'internal') {
          const match = msg.attachments?.find((att) => att.id === attachmentId);
          if (match) {
            targetAttachment = match;
            break;
          }
        }
      }
    }

    if (!targetAttachment) {
      throw new AppError('Attachment not found or access denied', 404);
    }

    // 3. Enforce production malware scanning gate before generating authorized download
    return MalwareScannerService.getAuthorizedDownloadPayload(targetAttachment);
  }

  /**
   * Lists customer conversations strictly scoped to contactId.
   */
  public static async listCustomerConversations(portalUser: IPortalUser) {
    const conversations = await Conversation.find({
      clientId: portalUser.clientId,
      contactId: portalUser.contactId,
      isArchived: false,
    })
      .sort({ lastMessageAt: -1 })
      .select('subject channel status priority lastMessageAt lastMessageSnippet unreadCount createdAt');

    return conversations;
  }

  /**
   * Gets customer-safe conversation messages (internal notes strictly stripped).
   */
  public static async getCustomerConversationMessages(
    portalUser: IPortalUser,
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ conversation: any; messages: IMessage[]; total: number }> {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError('Conversation not found', 404);
    }

    const conversation = await Conversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: portalUser.clientId,
      contactId: portalUser.contactId,
      isArchived: false,
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const skip = (Math.max(1, page) - 1) * limit;

    // Strict Filter: Never return internal notes (channel=internal or isInternal=true or isCustomerVisible !== true)
    // Missing or legacy visibility fields strictly default to internal/non-visible
    const query = {
      clientId: portalUser.clientId,
      conversationId: conversation._id,
      channel: { $ne: 'internal' },
      isInternal: false,
      isCustomerVisible: true,
    };

    const [messages, total] = await Promise.all([
      Message.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit),
      Message.countDocuments(query),
    ]);

    return {
      conversation: {
        id: conversation._id.toString(),
        subject: conversation.subject,
        channel: conversation.channel,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
      },
      messages,
      total,
    };
  }

  /**
   * Sends customer message into conversation.
   */
  public static async sendCustomerConversationMessage(
    portalUser: IPortalUser,
    conversationId: string,
    data: { body: string; attachments?: any[]; idempotencyKey?: string },
    ipAddress?: string,
    userAgent?: string
  ): Promise<IMessage> {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AppError('Conversation not found', 404);
    }

    const conversation = await Conversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: portalUser.clientId,
      contactId: portalUser.contactId,
      isArchived: false,
    });

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Idempotency check
    if (data.idempotencyKey) {
      const existing = await Message.findOne({
        clientId: portalUser.clientId,
        conversationId: conversation._id,
        idempotencyKey: data.idempotencyKey,
      });
      if (existing) {
        return existing;
      }
    }

    const cleanBody = sanitizeContent(data.body.trim());
    const validatedAttachments = PortalAttachmentService.validateAttachments(data.attachments);

    const message = await Message.create({
      clientId: portalUser.clientId,
      conversationId: conversation._id,
      senderType: 'contact',
      senderId: portalUser.contactId,
      senderName: portalUser.name,
      senderEmail: portalUser.email,
      senderPhone: portalUser.phone,
      channel: conversation.channel,
      direction: 'inbound',
      body: cleanBody,
      deliveryStatus: 'delivered',
      isCustomerVisible: true,
      isInternal: false,
      attachments: validatedAttachments,
      idempotencyKey: data.idempotencyKey,
      sentAt: new Date(),
      deliveredAt: new Date(),
    });

    // Update conversation metadata
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSnippet = cleanBody.slice(0, 100);
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    await conversation.save();

    // Trigger workflow event without duplicating loop
    try {
      await EventDispatcher.dispatch({
        clientId: portalUser.clientId.toString(),
        eventType: 'conversation.received',
        eventId: `msg_evt_${message._id}`,
        entityId: conversation._id.toString(),
        entityType: 'conversation',
        payload: {
          conversation: conversation.toObject(),
          message: message.toObject(),
        },
        actor: { id: portalUser._id.toString(), name: portalUser.name },
      });
    } catch (err) {
      // Non-fatal
    }

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.message.send',
      resourceType: 'conversation',
      resourceId: conversation._id.toString(),
      ipAddress,
      userAgent,
      success: true,
      metadata: { messageId: message._id.toString() },
    });

    return message;
  }

  /**
   * Lists customer-visible tasks (internal priorities, assignees, and notes stripped).
   */
  public static async listCustomerTasks(portalUser: IPortalUser) {
    const filter: Record<string, any> = {
      clientId: portalUser.clientId,
      $or: [{ contactId: portalUser.contactId }, { leadId: portalUser.leadId }],
      isCustomerVisible: true,
    };

    const tasks = await Task.find(filter)
      .sort({ dueAt: 1 })
      .select('title description taskType status dueAt customerActionRequired customerCompletedAt createdAt');

    return tasks;
  }

  /**
   * Gets customer-visible task details.
   */
  public static async getCustomerTask(portalUser: IPortalUser, taskId: string) {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw new AppError('Task not found', 404);
    }

    const task = await Task.findOne({
      _id: new mongoose.Types.ObjectId(taskId),
      clientId: portalUser.clientId,
      $or: [{ contactId: portalUser.contactId }, { leadId: portalUser.leadId }],
      isCustomerVisible: true,
    }).select('title description taskType status dueAt customerActionRequired customerCompletedAt createdAt');

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    return task;
  }

  /**
   * Completes a customer action item with strict atomic constraints.
   */
  public static async completeCustomerTaskAction(
    portalUser: IPortalUser,
    taskId: string,
    notes?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ITask> {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      throw new AppError('Task not found', 404);
    }

    // Atomic update: only succeeds if task belongs to customer, isCustomerVisible, customerActionRequired, and not completed
    const task = await Task.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(taskId),
        clientId: portalUser.clientId,
        $or: [{ contactId: portalUser.contactId }, { leadId: portalUser.leadId }],
        isCustomerVisible: true,
        customerActionRequired: true,
        status: { $nin: ['completed', 'cancelled'] },
      },
      {
        $set: {
          status: 'completed',
          customerActionRequired: false,
          customerCompletedAt: new Date(),
          completedAt: new Date(),
          completionNotes: notes ? sanitizeContent(notes) : 'Completed by customer via portal',
        },
      },
      { new: true }
    );

    if (!task) {
      throw new AppError('Task not found, already completed, or does not allow customer completion.', 400);
    }

    // Log TaskEvent
    await TaskEvent.create({
      clientId: portalUser.clientId,
      taskId: task._id,
      eventType: 'status_changed',
      description: `Task action completed by customer ${portalUser.name}`,
      newValue: { status: 'completed', customerCompletedAt: task.customerCompletedAt },
    });

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.task.complete',
      resourceType: 'task',
      resourceId: task._id.toString(),
      ipAddress,
      userAgent,
      success: true,
      metadata: { taskTitle: task.title },
    });

    return task;
  }

  /**
   * Adds customer comment to task.
   */
  public static async addCustomerTaskComment(
    portalUser: IPortalUser,
    taskId: string,
    comment: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const task = await this.getCustomerTask(portalUser, taskId);

    const cleanComment = sanitizeContent(comment.trim());

    await TaskEvent.create({
      clientId: portalUser.clientId,
      taskId: task._id,
      eventType: 'customer_comment',
      description: `Customer Comment: ${cleanComment}`,
      newValue: { comment: cleanComment, author: portalUser.name },
    });

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.task.comment',
      resourceType: 'task',
      resourceId: task._id.toString(),
      ipAddress,
      userAgent,
      success: true,
    });

    return { message: 'Comment recorded successfully' };
  }
}
