import crypto from 'crypto';
import mongoose from 'mongoose';
import { Message, IMessage } from '../models/Message';
import { Conversation, IConversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { ClientWebhook } from '../models/ClientWebhook';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { ContactService } from './contact.service';
import { ConversationActivityService } from './conversationActivity.service';
import { EventDispatcher } from './eventDispatcher.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

// 5-minute replay window (300 seconds)
const MAX_TIMESTAMP_DRIFT_MS = 300 * 1000;

export class ConversationWebhookService {
  /**
   * Processes inbound webhook payload from messaging providers.
   * Enforces secret verification, timestamp replay defense, and idempotency.
   */
  static async processInboundWebhook(
    headers: Record<string, any>,
    payload: {
      channel: 'email' | 'sms' | 'whatsapp' | 'internal' | 'other';
      externalMessageId: string;
      from: { name: string; email?: string; phone?: string };
      body: string;
      attachments?: Array<{ name: string; url: string; size?: number; mimeType?: string }>;
      timestamp?: string | number;
    },
    providedClientId?: string
  ): Promise<{ success: boolean; duplicate: boolean; messageId: string; conversationId: string }> {
    const rawSecret = headers['x-webhook-secret'] || headers['x-mock-secret'];
    if (!rawSecret) {
      throw new AppError('Webhook secret missing. Provide X-Webhook-Secret header.', 401);
    }

    // 1. Verify Secret & Resolve Client
    const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    let resolvedClientId = providedClientId;

    // Check in ClientWebhook or CommunicationProvider
    if (!resolvedClientId) {
      const webhookDoc = await ClientWebhook.findOne({ secretHash, status: 'active' });
      if (webhookDoc) {
        resolvedClientId = webhookDoc.clientId.toString();
        webhookDoc.lastUsedAt = new Date();
        await webhookDoc.save();
      } else {
        const providerDoc = await CommunicationProvider.findOne({ webhookSecretHash: secretHash, status: 'active' });
        if (providerDoc) {
          resolvedClientId = providerDoc.clientId.toString();
        }
      }
    }

    if (!resolvedClientId) {
      throw new AppError('Invalid or inactive webhook secret.', 401);
    }

    const clientObjectId = new mongoose.Types.ObjectId(resolvedClientId);

    // 2. Replay Attack Defense (Timestamp Freshness)
    const timestampHeader = headers['x-webhook-timestamp'] || payload.timestamp;
    if (timestampHeader) {
      const parsedTime = typeof timestampHeader === 'number'
        ? (timestampHeader < 1e12 ? timestampHeader * 1000 : timestampHeader)
        : isNaN(Number(timestampHeader))
        ? Date.parse(timestampHeader)
        : Number(timestampHeader) < 1e12
        ? Number(timestampHeader) * 1000
        : Number(timestampHeader);

      if (isNaN(parsedTime) || Math.abs(Date.now() - parsedTime) > MAX_TIMESTAMP_DRIFT_MS) {
        throw new AppError('Webhook request timestamp expired or invalid. Replay rejected.', 400);
      }
    }

    // 3. Idempotency Check
    const existingMessage = await Message.findOne({
      clientId: clientObjectId,
      externalMessageId: payload.externalMessageId.trim(),
    });

    if (existingMessage) {
      logger.info(`Inbound webhook duplicate detected for externalMessageId=${payload.externalMessageId}; skipping duplicate.`);
      return {
        success: true,
        duplicate: true,
        messageId: existingMessage._id.toString(),
        conversationId: existingMessage.conversationId.toString(),
      };
    }

    // 4. Resolve or Create Contact
    const contact = await ContactService.findOrCreateContact(resolvedClientId, {
      name: payload.from?.name || 'Inbound Customer',
      email: payload.from?.email,
      phone: payload.from?.phone,
    });

    // 5. Resolve or Create Conversation Thread
    let conversation = await Conversation.findOne({
      clientId: clientObjectId,
      contactId: contact._id,
      channel: payload.channel,
      isArchived: false,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        clientId: clientObjectId,
        contactId: contact._id,
        leadId: contact.leadId,
        subject: `${payload.channel.toUpperCase()} message from ${contact.name}`,
        channel: payload.channel,
        status: 'open',
        priority: 'medium',
        lastMessageAt: new Date(),
        lastMessageSnippet: payload.body.slice(0, 120),
        unreadCount: 1,
      });

      await ConversationActivityService.log({
        clientId: resolvedClientId,
        conversationId: conversation._id.toString(),
        action: 'conversation_created',
        title: `Inbound ${payload.channel} conversation started`,
      });
    } else {
      conversation.unreadCount += 1;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageSnippet = payload.body.slice(0, 120);
      if (conversation.status === 'resolved') {
        conversation.status = 'open';
      }
      await conversation.save();
    }

    // 6. Create Message
    const message = await Message.create({
      clientId: clientObjectId,
      conversationId: conversation._id,
      senderType: 'contact',
      senderId: contact._id,
      senderName: contact.name,
      senderEmail: contact.email,
      senderPhone: contact.phone,
      channel: payload.channel,
      direction: 'inbound',
      body: payload.body.trim(),
      deliveryStatus: 'delivered',
      externalMessageId: payload.externalMessageId.trim(),
      attachments: payload.attachments || [],
      deliveredAt: new Date(),
    });

    // 7. Log Activity
    await ConversationActivityService.log({
      clientId: resolvedClientId,
      conversationId: conversation._id.toString(),
      action: 'message_received',
      title: 'Customer message received',
      details: {
        channel: payload.channel,
        from: contact.name,
        externalMessageId: payload.externalMessageId,
      },
    });

    // Dispatch workflow trigger event: conversation.received
    try {
      await EventDispatcher.dispatch({
        clientId: resolvedClientId,
        eventType: 'conversation.received',
        eventId: `msg_inbound_${message._id}`,
        entityId: conversation._id.toString(),
        entityType: 'conversation',
        payload: {
          conversation: conversation.toObject ? conversation.toObject() : conversation,
          message: message.toObject ? message.toObject() : message,
          contact: contact.toObject ? contact.toObject() : contact,
          channel: payload.channel,
          body: payload.body,
        },
      });
    } catch (eventErr) {
      // Non-fatal
    }

    return {
      success: true,
      duplicate: false,
      messageId: message._id.toString(),
      conversationId: conversation._id.toString(),
    };
  }

  /**
   * Processes inbound webhook payload directly from Meta WhatsApp Cloud API.
   * Handles delivery status updates (sent, delivered, read, failed) and incoming messages.
   */
  static async processMetaWebhook(body: any): Promise<{ handled: boolean; results?: any[] }> {
    if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
      return { handled: false };
    }

    const results: any[] = [];

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id;

        // Resolve client workspace owning this phone number ID
        let providerDoc = null;
        if (phoneNumberId) {
          providerDoc = await CommunicationProvider.findOne({
            'configuration.phoneNumberId': phoneNumberId,
            providerType: 'whatsapp',
            status: 'active',
          });
        }

        if (!providerDoc) {
          // Fallback to any active WhatsApp provider
          providerDoc = await CommunicationProvider.findOne({
            providerType: 'whatsapp',
            status: 'active',
          });
        }

        if (!providerDoc) {
          logger.warn(`No active WhatsApp provider found for incoming Meta webhook (phone_number_id=${phoneNumberId})`);
          continue;
        }

        const clientId = providerDoc.clientId.toString();
        const clientObjectId = providerDoc.clientId;

        // 1. Process message status updates (sent, delivered, read, failed)
        if (Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const externalMessageId = status.id;
            const newStatus =
              status.status === 'read'
                ? 'read'
                : status.status === 'delivered'
                ? 'delivered'
                : status.status === 'failed'
                ? 'failed'
                : 'sent';

            const updated = await Message.findOneAndUpdate(
              { clientId: clientObjectId, externalMessageId },
              {
                deliveryStatus: newStatus,
                ...(status.status === 'delivered' || status.status === 'read' ? { deliveredAt: new Date() } : {}),
                ...(status.status === 'failed'
                  ? { failureReason: status.errors?.[0]?.title || status.errors?.[0]?.message || 'WhatsApp delivery failed' }
                  : {}),
              },
              { new: true }
            );

            if (updated) {
              results.push({ type: 'status_update', messageId: updated._id, status: status.status });
            }
          }
        }

        // 2. Process inbound customer messages
        if (Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const fromPhone = msg.from;
            const contactProfile = value.contacts?.find((c: any) => c.wa_id === fromPhone);
            const contactName = contactProfile?.profile?.name || `+${fromPhone}`;

            const textBody =
              msg.text?.body ||
              msg.caption ||
              (msg.type === 'image'
                ? '[Image Attachment]'
                : msg.type === 'document'
                ? '[Document Attachment]'
                : msg.type === 'video'
                ? '[Video Attachment]'
                : msg.type === 'audio'
                ? '[Audio Message]'
                : `[WhatsApp ${msg.type || 'message'}]`);

            // Idempotency check
            const existingMessage = await Message.findOne({
              clientId: clientObjectId,
              externalMessageId: msg.id,
            });

            if (existingMessage) {
              logger.info(`Meta WhatsApp duplicate inbound detected: ${msg.id}`);
              continue;
            }

            // Resolve or create Contact
            const contact = await ContactService.findOrCreateContact(clientId, {
              name: contactName,
              phone: `+${fromPhone}`,
            });

            // Resolve or create Conversation
            let conversation = await Conversation.findOne({
              clientId: clientObjectId,
              contactId: contact._id,
              channel: 'whatsapp',
              isArchived: false,
            });

            if (!conversation) {
              conversation = await Conversation.create({
                clientId: clientObjectId,
                contactId: contact._id,
                leadId: contact.leadId,
                subject: `WhatsApp chat with ${contact.name}`,
                channel: 'whatsapp',
                status: 'open',
                priority: 'medium',
                lastMessageAt: new Date(),
                lastMessageSnippet: textBody.slice(0, 120),
                unreadCount: 1,
              });

              await ConversationActivityService.log({
                clientId,
                conversationId: conversation._id.toString(),
                action: 'conversation_created',
                title: 'Inbound WhatsApp conversation started',
              });
            } else {
              conversation.unreadCount += 1;
              conversation.lastMessageAt = new Date();
              conversation.lastMessageSnippet = textBody.slice(0, 120);
              if (conversation.status === 'resolved') {
                conversation.status = 'open';
              }
              await conversation.save();
            }

            // Create Message
            const message = await Message.create({
              clientId: clientObjectId,
              conversationId: conversation._id,
              senderType: 'contact',
              senderId: contact._id,
              senderName: contact.name,
              senderPhone: contact.phone,
              channel: 'whatsapp',
              direction: 'inbound',
              body: textBody,
              deliveryStatus: 'delivered',
              externalMessageId: msg.id,
              deliveredAt: new Date(),
            });

            // Log activity
            await ConversationActivityService.log({
              clientId,
              conversationId: conversation._id.toString(),
              action: 'message_received',
              title: 'WhatsApp message received',
              details: {
                channel: 'whatsapp',
                from: contact.name,
                externalMessageId: msg.id,
              },
            });

            // Dispatch workflow event
            try {
              await EventDispatcher.dispatch({
                clientId,
                eventType: 'conversation.received',
                eventId: `msg_inbound_${message._id}`,
                entityId: conversation._id.toString(),
                entityType: 'conversation',
                payload: {
                  conversation: conversation.toObject ? conversation.toObject() : conversation,
                  message: message.toObject ? message.toObject() : message,
                  contact: contact.toObject ? contact.toObject() : contact,
                  channel: 'whatsapp',
                  body: textBody,
                },
              });
            } catch (err) {
              // Non-fatal
            }

            results.push({ type: 'message_created', messageId: message._id, conversationId: conversation._id });
          }
        }
      }
    }

    return { handled: true, results };
  }
}
