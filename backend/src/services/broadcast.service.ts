import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { BroadcastCampaign, IBroadcastCampaign, BroadcastChannel, IBroadcastAttachment } from '../models/BroadcastCampaign';
import { ContactService } from './contact.service';
import { ConversationService } from './conversation.service';
import { MessageService } from './message.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export interface CreateBroadcastInput {
  name: string;
  channel: BroadcastChannel;
  messageBody: string;
  attachment?: IBroadcastAttachment;
  recipients: Array<{
    name: string;
    phone: string;
    email?: string;
    customFields?: Record<string, string>;
  }>;
}

export class BroadcastService {
  /**
   * Replaces template tags such as {{name}}, {{phone}}, {{company}} with recipient values.
   */
  private static personalizeMessage(
    template: string,
    recipient: { name: string; phone: string; email?: string; customFields?: Record<string, string> }
  ): string {
    let result = template;
    const replacements: Record<string, string> = {
      name: recipient.name || 'Valued Customer',
      Name: recipient.name || 'Valued Customer',
      phone: recipient.phone || '',
      Phone: recipient.phone || '',
      email: recipient.email || '',
      Email: recipient.email || '',
      ...(recipient.customFields || {}),
    };

    for (const [key, val] of Object.entries(replacements)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      result = result.replace(regex, val);
    }
    return result;
  }

  /**
   * Creates and dispatches a multi-recipient broadcast blast with optional media attachment.
   */
  static async createAndDispatchBroadcast(
    clientId: string,
    userId: string,
    data: CreateBroadcastInput
  ): Promise<IBroadcastCampaign> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    if (!data.name || !data.name.trim()) {
      throw new AppError('Broadcast campaign name is required', 400);
    }
    if (!data.messageBody || !data.messageBody.trim()) {
      throw new AppError('Message body text is required for the broadcast', 400);
    }
    if (!data.recipients || data.recipients.length === 0) {
      throw new AppError('At least one recipient must be provided for broadcasting', 400);
    }

    // Sanitize recipients
    const validRecipients = data.recipients
      .filter((r) => r.phone && r.phone.trim().length >= 7)
      .map((r) => ({
        name: r.name ? r.name.trim() : 'Customer',
        phone: r.phone.trim().replace(/\s+/g, ''),
        email: r.email ? r.email.trim() : undefined,
        customFields: r.customFields || {},
      }));

    if (validRecipients.length === 0) {
      throw new AppError('No valid recipient phone numbers found in the uploaded list', 400);
    }

    // 1. Create campaign document
    const campaign = await BroadcastCampaign.create({
      clientId: clientObjectId,
      name: data.name.trim(),
      channel: data.channel || 'whatsapp',
      messageBody: data.messageBody.trim(),
      attachment: data.attachment,
      totalRecipients: validRecipients.length,
      sentCount: 0,
      failedCount: 0,
      status: 'sending',
      recipients: validRecipients.map((r) => ({
        name: r.name,
        phone: r.phone,
        email: r.email,
        customFields: r.customFields,
        status: 'pending',
      })),
      createdBy: new mongoose.Types.ObjectId(userId),
      startedAt: new Date(),
    });

    let sentCount = 0;
    let failedCount = 0;

    // 2. Dispatch messages to recipients in controlled batches
    for (let i = 0; i < campaign.recipients.length; i++) {
      const rec = campaign.recipients[i];
      try {
        const personalizedBody = this.personalizeMessage(campaign.messageBody, rec);

        // Find or create contact
        const contact = await ContactService.findOrCreateContact(clientId, {
          name: rec.name,
          phone: rec.phone,
          email: rec.email,
        });

        // Find or create active conversation
        const conversation = await ConversationService.createConversation(clientId, userId, {
          contactId: contact._id.toString(),
          contactName: rec.name,
          contactPhone: rec.phone,
          contactEmail: rec.email,
          channel: campaign.channel,
          subject: `Broadcast: ${campaign.name}`,
        });

        // Dispatch outbound message
        const message = await MessageService.sendMessage(
          clientId,
          conversation._id.toString(),
          userId,
          {
            body: personalizedBody,
            channel: campaign.channel,
            attachments: campaign.attachment ? [campaign.attachment] : undefined,
            idempotencyKey: `broadcast_${campaign._id}_${rec.phone}_${Date.now()}`,
          }
        );

        if (message.deliveryStatus === 'failed') {
          rec.status = 'failed';
          rec.error = message.failureReason || 'Failed to dispatch via provider';
          failedCount++;
        } else {
          rec.status = 'sent';
          rec.messageId = message._id.toString();
          rec.sentAt = new Date();
          sentCount++;
        }
      } catch (err: any) {
        logger.error(`Broadcast message failed for recipient ${rec.phone}:`, err);
        rec.status = 'failed';
        rec.error = err.message || 'Error executing message delivery';
        failedCount++;
      }
    }

    // 3. Update campaign totals
    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    campaign.status =
      failedCount === 0
        ? 'completed'
        : sentCount === 0
        ? 'failed'
        : 'partial_failure';
    campaign.completedAt = new Date();

    await campaign.save();
    return campaign;
  }

  /**
   * Lists campaigns for client workspace.
   */
  static async getBroadcasts(
    clientId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    broadcasts: IBroadcastCampaign[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const skip = (Math.max(1, page) - 1) * limit;

    const [broadcasts, total] = await Promise.all([
      BroadcastCampaign.find({ clientId: clientObjectId })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BroadcastCampaign.countDocuments({ clientId: clientObjectId }),
    ]);

    return {
      broadcasts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single broadcast campaign with delivery logs.
   */
  static async getBroadcastById(clientId: string, broadcastId: string): Promise<IBroadcastCampaign> {
    const campaign = await BroadcastCampaign.findOne({
      _id: new mongoose.Types.ObjectId(broadcastId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).populate('createdBy', 'name email');

    if (!campaign) {
      throw new AppError('Broadcast campaign not found', 404);
    }
    return campaign;
  }

  /**
   * Saves an uploaded media file (image, PDF, document) for broadcasting.
   */
  static async saveUploadedAttachment(
    fileName: string,
    base64Data: string,
    mimeType: string
  ): Promise<IBroadcastAttachment> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'broadcasts');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate safe unique filename
    const ext = path.extname(fileName) || (mimeType.includes('pdf') ? '.pdf' : '.png');
    const safeName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(uploadsDir, safeName);

    // Strip data URI prefix if present
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/broadcasts/${safeName}`;

    return {
      name: fileName || safeName,
      url: publicUrl,
      mimeType,
      size: buffer.length,
    };
  }
}
