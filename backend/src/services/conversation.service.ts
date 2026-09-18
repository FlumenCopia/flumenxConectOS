import mongoose from 'mongoose';
import { Conversation, IConversation, ConversationChannel, ConversationPriority, ConversationStatus } from '../models/Conversation';
import { Message } from '../models/Message';
import { ContactService } from './contact.service';
import { ConversationActivityService } from './conversationActivity.service';
import { MessageService } from './message.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export interface ConversationFilters {
  status?: ConversationStatus | 'all';
  priority?: ConversationPriority | 'all';
  channel?: ConversationChannel | 'all';
  assignedTo?: string | 'all';
  search?: string;
  unreadOnly?: boolean;
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

export class ConversationService {
  static async getConversations(
    clientId: string,
    filters: ConversationFilters = {}
  ): Promise<{
    conversations: IConversation[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
    counts: { all: number; unread: number; open: number; resolved: number };
  }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 25));
    const skip = (page - 1) * limit;

    const baseQuery: Record<string, any> = {
      clientId: clientObjectId,
      isArchived: filters.isArchived === true,
    };

    if (filters.status && filters.status !== 'all') {
      baseQuery.status = filters.status;
    }
    if (filters.priority && filters.priority !== 'all') {
      baseQuery.priority = filters.priority;
    }
    if (filters.channel && filters.channel !== 'all') {
      baseQuery.channel = filters.channel;
    }
    if (filters.assignedTo && filters.assignedTo !== 'all') {
      if (filters.assignedTo === 'unassigned') {
        baseQuery.assignedTo = { $exists: false };
      } else {
        baseQuery.assignedTo = new mongoose.Types.ObjectId(filters.assignedTo);
      }
    }
    if (filters.unreadOnly) {
      baseQuery.unreadCount = { $gt: 0 };
    }

    if (filters.search && filters.search.trim()) {
      const searchRegex = new RegExp(filters.search.trim(), 'i');
      baseQuery.$or = [
        { subject: searchRegex },
        { lastMessageSnippet: searchRegex },
        { tags: searchRegex },
      ];
    }

    const [conversations, total, totalUnread, totalOpen, totalResolved] = await Promise.all([
      Conversation.find(baseQuery)
        .populate('contactId', 'name email phone avatarUrl leadId')
        .populate('assignedTo', 'name email avatarUrl')
        .populate('leadId', 'stage leadScore source company')
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(baseQuery),
      Conversation.countDocuments({ clientId: clientObjectId, isArchived: false, unreadCount: { $gt: 0 } }),
      Conversation.countDocuments({ clientId: clientObjectId, isArchived: false, status: 'open' }),
      Conversation.countDocuments({ clientId: clientObjectId, isArchived: false, status: 'resolved' }),
    ]);

    return {
      conversations,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      counts: {
        all: total,
        unread: totalUnread,
        open: totalOpen,
        resolved: totalResolved,
      },
    };
  }

  static async getConversationById(clientId: string, conversationId: string): Promise<IConversation> {
    const conversation = await Conversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    })
      .populate('contactId')
      .populate('assignedTo', 'name email avatarUrl')
      .populate('leadId');

    if (!conversation) {
      throw new AppError('Conversation not found in this workspace', 404);
    }

    return conversation;
  }

  static async createConversation(
    clientId: string,
    userId: string,
    data: {
      contactId?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      leadId?: string;
      subject?: string;
      channel: ConversationChannel;
      priority?: ConversationPriority;
      tags?: string[];
      assignedTo?: string;
      initialMessage?: string;
    }
  ): Promise<IConversation> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    // 1. Resolve or create contact
    let contact;
    if (data.contactId) {
      contact = await ContactService.getContactById(clientId, data.contactId);
    } else if (data.contactName) {
      contact = await ContactService.findOrCreateContact(clientId, {
        name: data.contactName,
        email: data.contactEmail,
        phone: data.contactPhone,
        leadId: data.leadId,
      });
    } else {
      throw new AppError('Contact details must be specified', 400);
    }

    // 2. Create conversation
    const conversation = await Conversation.create({
      clientId: clientObjectId,
      contactId: contact._id,
      leadId: data.leadId ? new mongoose.Types.ObjectId(data.leadId) : contact.leadId,
      subject: data.subject?.trim() || `Conversation with ${contact.name}`,
      channel: data.channel || 'whatsapp',
      priority: data.priority || 'medium',
      assignedTo: data.assignedTo ? new mongoose.Types.ObjectId(data.assignedTo) : undefined,
      tags: data.tags || [],
      lastMessageSnippet: data.initialMessage?.slice(0, 120) || 'Conversation initiated',
      lastMessageAt: new Date(),
      status: 'open',
    });

    // 3. Log activity
    await ConversationActivityService.log({
      clientId,
      conversationId: conversation._id.toString(),
      userId,
      action: 'conversation_created',
      title: 'Conversation started',
      details: {
        channel: conversation.channel,
        contactName: contact.name,
      },
    });

    // 4. Dispatch initial message if provided
    if (data.initialMessage && data.initialMessage.trim()) {
      try {
        await MessageService.sendMessage(clientId, conversation._id.toString(), userId, {
          body: data.initialMessage.trim(),
          channel: conversation.channel,
        });
      } catch (msgErr) {
        logger.error('Failed to dispatch initial message upon conversation creation:', msgErr);
      }
    }

    return this.getConversationById(clientId, conversation._id.toString());
  }

  static async updateStatus(
    clientId: string,
    conversationId: string,
    userId: string,
    status: ConversationStatus
  ): Promise<IConversation> {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      {
        $set: {
          status,
          ...(status === 'archived' ? { isArchived: true } : {}),
        },
      },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: 'status_changed',
      title: `Status changed to ${status}`,
      details: { newStatus: status },
    });

    return conversation;
  }

  static async updatePriority(
    clientId: string,
    conversationId: string,
    userId: string,
    priority: ConversationPriority
  ): Promise<IConversation> {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { priority } },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: 'priority_changed',
      title: `Priority changed to ${priority}`,
      details: { priority },
    });

    return conversation;
  }

  static async assignConversation(
    clientId: string,
    conversationId: string,
    userId: string,
    assignedTo: string | null
  ): Promise<IConversation> {
    const update = assignedTo
      ? { assignedTo: new mongoose.Types.ObjectId(assignedTo) }
      : { $unset: { assignedTo: 1 } };

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      update,
      { new: true }
    ).populate('assignedTo', 'name email avatarUrl');

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: 'assigned',
      title: assignedTo ? 'Conversation reassigned' : 'Conversation unassigned',
      details: { assignedTo },
    });

    return conversation;
  }

  static async updateTags(
    clientId: string,
    conversationId: string,
    userId: string,
    tags: string[]
  ): Promise<IConversation> {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { tags: tags.map((t) => t.trim()).filter(Boolean) } },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: 'tags_updated',
      title: 'Tags updated',
      details: { tags },
    });

    return conversation;
  }

  static async markAsRead(clientId: string, conversationId: string): Promise<IConversation> {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { unreadCount: 0 } },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    // Mark unread inbound messages as read
    await Message.updateMany(
      {
        clientId: new mongoose.Types.ObjectId(clientId),
        conversationId: new mongoose.Types.ObjectId(conversationId),
        direction: 'inbound',
        deliveryStatus: { $ne: 'read' },
      },
      {
        $set: { deliveryStatus: 'read', readAt: new Date() },
      }
    );

    return conversation;
  }

  static async archiveConversation(
    clientId: string,
    conversationId: string,
    userId: string
  ): Promise<IConversation> {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { isArchived: true, status: 'archived' } },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: 'archived',
      title: 'Conversation archived',
    });

    return conversation;
  }

  static async reopenConversation(
    clientId: string,
    conversationId: string,
    userId: string
  ): Promise<IConversation> {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { isArchived: false, status: 'open' } },
      { new: true }
    );

    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: 'reopened',
      title: 'Conversation reopened',
    });

    return conversation;
  }
}
