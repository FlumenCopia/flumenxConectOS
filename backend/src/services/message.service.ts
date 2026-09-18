import mongoose from 'mongoose';
import { Message, IMessage, MessageChannel } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';
import { Contact } from '../models/Contact';
import { ProviderManager } from './providers/provider.manager';
import { ConversationActivityService } from './conversationActivity.service';
import { EventDispatcher } from './eventDispatcher.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

// HTML / Script Sanitizer to prevent Stored XSS
const sanitizeContent = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
};

export class MessageService {
  static async getMessages(
    clientId: string,
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ messages: IMessage[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const conversationObjectId = new mongoose.Types.ObjectId(conversationId);
    const skip = (Math.max(1, page) - 1) * limit;

    const query = {
      clientId: clientObjectId,
      conversationId: conversationObjectId,
    };

    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments(query),
    ]);

    return {
      messages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async sendMessage(
    clientId: string,
    conversationId: string,
    userId: string,
    data: {
      body: string;
      channel?: MessageChannel;
      attachments?: Array<{ name: string; url: string; size?: number; mimeType?: string }>;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<IMessage> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const conversationObjectId = new mongoose.Types.ObjectId(conversationId);

    // 1. Verify conversation
    const conversation = await Conversation.findOne({
      _id: conversationObjectId,
      clientId: clientObjectId,
    });
    if (!conversation) {
      throw new AppError('Conversation not found in this workspace', 404);
    }

    // 2. Check Idempotency
    if (data.idempotencyKey && data.idempotencyKey.trim()) {
      const existingMessage = await Message.findOne({
        clientId: clientObjectId,
        idempotencyKey: data.idempotencyKey.trim(),
      });
      if (existingMessage) {
        logger.info(`Idempotency key matched existing message ${existingMessage._id}; returning existing.`);
        return existingMessage;
      }
    }

    // 3. Sender profile
    const sender = await User.findById(userId);
    const senderName = sender ? sender.name : 'FlumenX Team Rep';
    const channel = data.channel || conversation.channel;
    const sanitizedBody = sanitizeContent(data.body);

    // 4. Resolve recipient contact
    const contact = await Contact.findById(conversation.contactId);
    const recipientTarget =
      channel === 'email'
        ? contact?.email || 'customer@example.com'
        : contact?.phone || 'customer-phone';

    // 5. Create Message in pending state
    const message = await Message.create({
      clientId: clientObjectId,
      conversationId: conversationObjectId,
      senderType: 'user',
      senderId: new mongoose.Types.ObjectId(userId),
      senderName,
      senderEmail: sender?.email,
      channel,
      direction: 'outbound',
      body: sanitizedBody,
      deliveryStatus: 'pending',
      attachments: data.attachments || [],
      idempotencyKey: data.idempotencyKey?.trim() || undefined,
      metadata: data.metadata,
      sentAt: new Date(),
    });

    // 6. Dispatch through Provider Manager
    const provider = await ProviderManager.getProvider(clientId, channel);
    try {
      const sendResult = await provider.sendMessage({
        to: recipientTarget,
        channel,
        body: sanitizedBody,
        attachments: data.attachments,
        idempotencyKey: data.idempotencyKey,
        metadata: data.metadata,
      });

      if (sendResult.success) {
        message.deliveryStatus = sendResult.deliveryStatus;
        message.externalMessageId = sendResult.externalMessageId;
        message.deliveredAt = new Date();
      } else {
        message.deliveryStatus = 'failed';
        message.failureReason = sendResult.failureReason || 'Failed to dispatch via carrier';
      }
    } catch (err: any) {
      logger.error('Provider dispatch error:', err);
      message.deliveryStatus = 'failed';
      message.failureReason = err.message || 'Carrier timeout';
    }

    await message.save();

    // 7. Update conversation metadata
    conversation.lastMessageAt = new Date();
    conversation.lastMessageSnippet = sanitizedBody.slice(0, 120);
    if (conversation.status === 'resolved' || conversation.status === 'archived') {
      conversation.status = 'open';
      conversation.isArchived = false;
    }
    await conversation.save();

    // 8. Log activity
    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: message.deliveryStatus === 'failed' ? 'message_failed' : 'message_sent',
      title: message.deliveryStatus === 'failed' ? 'Outbound message failed' : 'Message dispatched',
      details: {
        channel,
        deliveryStatus: message.deliveryStatus,
        failureReason: message.failureReason,
        messageId: message._id.toString(),
      },
    });

    // Dispatch workflow trigger event: conversation.replied
    try {
      await EventDispatcher.dispatch({
        clientId,
        eventType: 'conversation.replied',
        eventId: `msg_replied_${message._id}`,
        entityId: conversationId,
        entityType: 'conversation',
        payload: {
          conversation: conversation.toObject ? conversation.toObject() : conversation,
          message: message.toObject ? message.toObject() : message,
          channel,
          body: sanitizedBody,
        },
        actor: { id: userId, name: senderName, email: sender?.email },
      });
    } catch (eventErr) {
      // Non-fatal
    }

    return message;
  }

  static async retryMessage(
    clientId: string,
    conversationId: string,
    messageId: string,
    userId: string
  ): Promise<IMessage> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const conversationObjectId = new mongoose.Types.ObjectId(conversationId);
    const messageObjectId = new mongoose.Types.ObjectId(messageId);

    const message = await Message.findOne({
      _id: messageObjectId,
      conversationId: conversationObjectId,
      clientId: clientObjectId,
    });

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    if (message.deliveryStatus !== 'failed') {
      throw new AppError('Only failed messages can be retried', 400);
    }

    const conversation = await Conversation.findById(conversationObjectId);
    const contact = await Contact.findById(conversation?.contactId);
    const recipientTarget =
      message.channel === 'email'
        ? contact?.email || 'customer@example.com'
        : contact?.phone || 'customer-phone';

    // Retry sending via provider
    const provider = await ProviderManager.getProvider(clientId, message.channel);
    message.retryCount += 1;

    try {
      const sendResult = await provider.sendMessage({
        to: recipientTarget,
        channel: message.channel,
        body: message.body,
        attachments: message.attachments,
        idempotencyKey: `retry_${message.retryCount}_${message.idempotencyKey || message._id.toString()}`,
      });

      if (sendResult.success) {
        message.deliveryStatus = sendResult.deliveryStatus;
        message.externalMessageId = sendResult.externalMessageId;
        message.failureReason = undefined;
        message.deliveredAt = new Date();
      } else {
        message.deliveryStatus = 'failed';
        message.failureReason = sendResult.failureReason || 'Retry dispatch failed';
      }
    } catch (err: any) {
      message.deliveryStatus = 'failed';
      message.failureReason = err.message || 'Retry dispatch exception';
    }

    await message.save();

    await ConversationActivityService.log({
      clientId,
      conversationId,
      userId,
      action: message.deliveryStatus === 'failed' ? 'message_failed' : 'message_sent',
      title: message.deliveryStatus === 'failed' ? 'Message retry failed' : 'Message retry delivered',
      details: {
        retryCount: message.retryCount,
        deliveryStatus: message.deliveryStatus,
        failureReason: message.failureReason,
      },
    });

    return message;
  }
}
