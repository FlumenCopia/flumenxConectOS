import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { ConversationActivityService } from '../services/conversationActivity.service';
import { ClientMembership } from '../models/ClientMembership';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { QuickReply } from '../models/QuickReply';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

const resolveScopeClientId = async (req: Request): Promise<string> => {
  const rawId =
    req.resolvedClientId ||
    (req.headers['x-client-id'] as string) ||
    (req.query.clientId as string) ||
    (req.body?.clientId as string);

  if (req.user!.isSuperAdmin) {
    if (rawId) return rawId.toString().trim();
    const active = await ClientMembership.findOne({ status: 'active' });
    if (active) return active.clientId.toString();
  }

  if (rawId) {
    const trimmed = rawId.toString().trim();
    const membership = await ClientMembership.findOne({
      userId: req.user!._id,
      clientId: trimmed,
      status: 'active',
    });
    if (!membership && !req.user!.isSuperAdmin) {
      throw new AppError('Access denied: You are not authorized for this client workspace.', 403);
    }
    return trimmed;
  }

  const defaultMembership = await ClientMembership.findOne({
    userId: req.user!._id,
    status: 'active',
  });
  if (!defaultMembership) {
    throw new AppError('No active client workspace found for current user.', 403);
  }
  return defaultMembership.clientId.toString();
};

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { status, priority, channel, assignedTo, search, unreadOnly, page, limit, isArchived } = req.query;

    const result = await ConversationService.getConversations(clientId, {
      status: status as any,
      priority: priority as any,
      channel: channel as any,
      assignedTo: assignedTo as string,
      search: search as string,
      unreadOnly: unreadOnly === 'true',
      isArchived: isArchived === 'true',
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 25,
    });

    return sendSuccess(res, result, 'Conversations retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { conversationId } = req.params;

    const conversation = await ConversationService.getConversationById(clientId, conversationId);
    return sendSuccess(res, conversation, 'Conversation retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();

    const conversation = await ConversationService.createConversation(clientId, userId, req.body);
    return sendSuccess(res, conversation, 'Conversation created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId } = req.params;
    const { status } = req.body;

    const conversation = await ConversationService.updateStatus(clientId, conversationId, userId, status);
    return sendSuccess(res, conversation, 'Conversation status updated');
  } catch (error) {
    return next(error);
  }
};

export const updatePriority = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId } = req.params;
    const { priority } = req.body;

    const conversation = await ConversationService.updatePriority(clientId, conversationId, userId, priority);
    return sendSuccess(res, conversation, 'Conversation priority updated');
  } catch (error) {
    return next(error);
  }
};

export const assignConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId } = req.params;
    const { assignedTo } = req.body;

    const conversation = await ConversationService.assignConversation(clientId, conversationId, userId, assignedTo);
    return sendSuccess(res, conversation, 'Conversation assignment updated');
  } catch (error) {
    return next(error);
  }
};

export const updateTags = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId } = req.params;
    const { tags } = req.body;

    const conversation = await ConversationService.updateTags(clientId, conversationId, userId, tags);
    return sendSuccess(res, conversation, 'Conversation tags updated');
  } catch (error) {
    return next(error);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { conversationId } = req.params;

    const conversation = await ConversationService.markAsRead(clientId, conversationId);
    return sendSuccess(res, conversation, 'Conversation marked as read');
  } catch (error) {
    return next(error);
  }
};

export const archiveConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId } = req.params;

    const conversation = await ConversationService.archiveConversation(clientId, conversationId, userId);
    return sendSuccess(res, conversation, 'Conversation archived');
  } catch (error) {
    return next(error);
  }
};

export const reopenConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId } = req.params;

    const conversation = await ConversationService.reopenConversation(clientId, conversationId, userId);
    return sendSuccess(res, conversation, 'Conversation reopened');
  } catch (error) {
    return next(error);
  }
};

export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { conversationId } = req.params;
    const { page, limit } = req.query;

    const result = await MessageService.getMessages(
      clientId,
      conversationId,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 50
    );

    return sendSuccess(res, result, 'Messages retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId } = req.params;

    const message = await MessageService.sendMessage(clientId, conversationId, userId, req.body);
    return sendSuccess(res, message, 'Message dispatched', 201);
  } catch (error) {
    return next(error);
  }
};

export const retryMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id.toString();
    const { conversationId, messageId } = req.params;

    const message = await MessageService.retryMessage(clientId, conversationId, messageId, userId);
    return sendSuccess(res, message, 'Message retry dispatched');
  } catch (error) {
    return next(error);
  }
};

export const getActivities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { conversationId } = req.params;

    const activities = await ConversationActivityService.getByConversation(clientId, conversationId);
    return sendSuccess(res, activities, 'Conversation activity history retrieved');
  } catch (error) {
    return next(error);
  }
};

export const getCommunicationProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const providers = await CommunicationProvider.find({ clientId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    const sanitized = providers.map((p: any) => {
      const config = { ...(p.configuration || {}) };
      if (config.accessToken && typeof config.accessToken === 'string') {
        config.accessToken = config.accessToken.length > 8
          ? `${config.accessToken.substring(0, 4)}••••${config.accessToken.slice(-4)}`
          : '••••••••';
      }
      if (config.pageAccessToken && typeof config.pageAccessToken === 'string') {
        config.pageAccessToken = config.pageAccessToken.length > 8
          ? `${config.pageAccessToken.substring(0, 4)}••••${config.pageAccessToken.slice(-4)}`
          : '••••••••';
      }
      if (config.authToken && typeof config.authToken === 'string') {
        config.authToken = config.authToken.length > 8
          ? `${config.authToken.substring(0, 4)}••••${config.authToken.slice(-4)}`
          : '••••••••';
      }
      if (config.apiKey && typeof config.apiKey === 'string') {
        config.apiKey = config.apiKey.length > 8
          ? `${config.apiKey.substring(0, 4)}••••${config.apiKey.slice(-4)}`
          : '••••••••';
      }
      return {
        ...p,
        configuration: config,
      };
    });

    return sendSuccess(res, sanitized, 'Communication providers retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const saveCommunicationProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id;
    const { providerType, displayName, configuration, isDefault, status } = req.body;

    if (isDefault) {
      await CommunicationProvider.updateMany({ clientId }, { isDefault: false });
    }

    const existing = await CommunicationProvider.findOne({ clientId, providerType });
    let provider;
    if (existing) {
      if (displayName) existing.displayName = displayName;
      const updatedConfig = { ...existing.configuration };
      for (const [k, v] of Object.entries(configuration || {})) {
        if (typeof v === 'string' && v.includes('•')) {
          continue;
        }
        updatedConfig[k] = v;
      }
      existing.configuration = updatedConfig;
      if (typeof isDefault === 'boolean') existing.isDefault = isDefault;
      if (status) existing.status = status;
      provider = await existing.save();
    } else {
      provider = await CommunicationProvider.create({
        clientId,
        providerType,
        displayName: displayName || `${providerType.toUpperCase()} Provider`,
        configuration: configuration || {},
        isDefault: Boolean(isDefault),
        status: status || 'active',
        createdBy: userId,
      });
    }

    return sendSuccess(res, provider, 'Communication provider saved successfully', existing ? 200 : 201);
  } catch (error) {
    return next(error);
  }
};

export const deleteCommunicationProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { providerId } = req.params;

    const deleted = await CommunicationProvider.findOneAndDelete({
      _id: providerId,
      clientId,
    });

    if (!deleted) {
      throw new AppError('Provider not found or does not belong to this client workspace', 404);
    }

    return sendSuccess(res, { deletedId: providerId }, 'Communication provider removed successfully');
  } catch (error) {
    return next(error);
  }
};

export const testCommunicationProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { providerType, configuration } = req.body;

    switch (providerType) {
      case 'whatsapp': {
        let { phoneNumberId, accessToken } = configuration || {};
        if (!phoneNumberId) throw new AppError('WhatsApp Phone Number ID is required', 400);

        // If accessToken is masked (e.g. contains bullets •), load the real unmasked token from existing configuration
        if (!accessToken || accessToken.includes('•')) {
          const existingDoc = await CommunicationProvider.findOne({ clientId, providerType: 'whatsapp' });
          if (existingDoc?.configuration?.accessToken && !existingDoc.configuration.accessToken.includes('•')) {
            accessToken = existingDoc.configuration.accessToken;
          }
        }

        if (!accessToken || accessToken.includes('•')) {
          throw new AppError('WhatsApp Cloud API Access Token is required. Please paste your token.', 400);
        }

        try {
          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${phoneNumberId.trim()}?fields=verified_name,code_verification_status,display_phone_number,quality_rating`,
            {
              headers: {
                Authorization: `Bearer ${accessToken.trim()}`,
              },
            }
          );
          const metaData = (await metaRes.json()) as any;

          if (!metaRes.ok || metaData.error) {
            const err = metaData.error || {};
            throw new AppError(
              `Meta Cloud API verification failed (${err.code || metaRes.status}): ${err.message || 'Invalid credentials'}`,
              400
            );
          }

          return sendSuccess(
            res,
            {
              verified: true,
              providerType,
              phoneNumberId: phoneNumberId.trim(),
              displayPhoneNumber: metaData.display_phone_number,
              verifiedName: metaData.verified_name,
              qualityRating: metaData.quality_rating,
              status: 'ready',
            },
            `WhatsApp Cloud API verified successfully: ${metaData.display_phone_number || metaData.verified_name || phoneNumberId}`
          );
        } catch (fetchErr: any) {
          if (fetchErr instanceof AppError) throw fetchErr;
          throw new AppError(`Failed to reach Meta Graph API: ${fetchErr.message}`, 502);
        }
      }
      case 'meta_instagram': {
        const { instagramAccountId, pageAccessToken } = configuration || {};
        if (!instagramAccountId) throw new AppError('Instagram Business Account ID is required', 400);
        if (!pageAccessToken) throw new AppError('Page Access Token with instagram_manage_messages is required', 400);
        return sendSuccess(res, {
          verified: true,
          providerType,
          instagramAccountId,
          status: 'ready',
        }, 'Instagram Direct API connection parameters validated successfully');
      }
      case 'meta_messenger': {
        const { pageId, pageAccessToken } = configuration || {};
        if (!pageId) throw new AppError('Facebook Page ID is required', 400);
        if (!pageAccessToken) throw new AppError('Page Access Token with pages_messaging is required', 400);
        return sendSuccess(res, {
          verified: true,
          providerType,
          pageId,
          status: 'ready',
        }, 'Facebook Messenger API connection parameters validated successfully');
      }
      case 'twilio': {
        const { accountSid, authToken, fromNumber } = configuration || {};
        if (!accountSid || !accountSid.startsWith('AC')) throw new AppError('Valid Twilio Account SID (starts with AC) is required', 400);
        if (!authToken) throw new AppError('Twilio Auth Token is required', 400);
        if (!fromNumber) throw new AppError('Twilio From Phone Number is required', 400);
        return sendSuccess(res, {
          verified: true,
          providerType,
          fromNumber,
          status: 'ready',
        }, 'Twilio SMS connection parameters validated successfully');
      }
      case 'resend': {
        const { apiKey, fromEmail } = configuration || {};
        if (!apiKey || !apiKey.startsWith('re_')) throw new AppError('Valid Resend API key (starts with re_) is required', 400);
        if (!fromEmail) throw new AppError('Sender email address is required', 400);
        return sendSuccess(res, {
          verified: true,
          providerType,
          fromEmail,
          status: 'ready',
        }, 'Resend Email connection parameters validated successfully');
      }
      case 'mock':
      case 'custom_webhook':
      default:
        return sendSuccess(res, {
          verified: true,
          providerType,
          status: 'ready',
        }, `${providerType} provider validated successfully`);
    }
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves pre-approved WhatsApp message templates from Meta Cloud API
 */
export const getWhatsAppTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const provider = await CommunicationProvider.findOne({
      clientId,
      providerType: 'whatsapp',
      status: 'active',
    });

    const fallbackTemplates = [
      {
        id: 'hello_world',
        name: 'hello_world',
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'en_US',
        bodyText:
          'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.',
      },
    ];

    if (!provider || !provider.configuration?.accessToken) {
      return sendSuccess(res, { templates: fallbackTemplates, count: fallbackTemplates.length }, 'Templates retrieved');
    }

    const { accessToken, wabaId } = provider.configuration;
    if (!wabaId) {
      return sendSuccess(res, { templates: fallbackTemplates, count: fallbackTemplates.length }, 'Templates retrieved');
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return sendSuccess(res, { templates: fallbackTemplates, count: fallbackTemplates.length }, 'Templates retrieved');
      }

      const metaData = (await response.json()) as any;
      const templates = (metaData.data || []).map((t: any) => ({
        id: t.id || t.name,
        name: t.name,
        status: t.status,
        category: t.category,
        language: t.language,
        bodyText: t.components?.find((c: any) => c.type === 'BODY')?.text || '',
        buttons: t.components?.find((c: any) => c.type === 'BUTTONS')?.buttons || [],
        headerFormat: t.components?.find((c: any) => c.type === 'HEADER')?.format || null,
        components: t.components,
      }));

      if (!templates.some((t: any) => t.name === 'hello_world')) {
        templates.unshift(fallbackTemplates[0]);
      }

      return sendSuccess(res, { templates, count: templates.length }, 'WhatsApp templates retrieved successfully');
    } catch (metaErr) {
      return sendSuccess(res, { templates: fallbackTemplates, count: fallbackTemplates.length }, 'Templates retrieved');
    }
  } catch (error) {
    return next(error);
  }
};

/**
 * Uploads media attachment (image, audio, video, document) for WhatsApp / Conversation messages
 */
export const uploadConversationAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { base64Data, name, mimeType } = req.body;
    if (!base64Data || !name) {
      throw new AppError('File data and filename are required', 400);
    }
    const uploadsDir = path.join(process.cwd(), 'uploads', 'conversations');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const ext = path.extname(name) || (mimeType ? `.${mimeType.split('/')[1]}` : '.bin');
    const safeName = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(uploadsDir, safeName);

    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/conversations/${safeName}`;
    const baseUrl = process.env.APP_URL || 'https://connectos.flumenx.in';
    const publicUrl = `${baseUrl.replace(/\/$/, '')}${relativeUrl}`;

    return sendSuccess(
      res,
      {
        url: relativeUrl,
        publicUrl,
        name,
        mimeType: mimeType || 'application/octet-stream',
        size: buffer.length,
      },
      'Media uploaded successfully',
      201
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves predefined messages / quick replies for workspace
 */
export const getQuickReplies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    let replies = await QuickReply.find({ clientId }).sort({ category: 1, createdAt: 1 }).lean();

    if (replies.length === 0) {
      const defaults = [
        {
          clientId,
          title: 'Welcome Greeting',
          category: 'Greeting',
          body: 'Hello! Thank you for reaching out to us. How can we assist you today?',
          channel: 'whatsapp',
        },
        {
          clientId,
          title: 'Specialist Follow-up',
          category: 'Support',
          body: 'Thank you for your message! Our team has received your inquiry and a specialist will get back to you shortly.',
          channel: 'whatsapp',
        },
        {
          clientId,
          title: 'Request Information',
          category: 'Sales',
          body: 'Could you please share your email address and business requirements so we can prepare a tailored proposal?',
          channel: 'whatsapp',
        },
        {
          clientId,
          title: 'Business Hours Notice',
          category: 'Information',
          body: 'Our office hours are Monday through Friday, 9:00 AM to 6:00 PM. We will attend to your request as soon as we open.',
          channel: 'whatsapp',
        },
        {
          clientId,
          title: 'Pricing & Catalog Link',
          category: 'Sales',
          body: 'We are pleased to share our current service catalog and pricing details: https://flumenx.com',
          channel: 'whatsapp',
        },
      ];
      await QuickReply.insertMany(defaults);
      replies = await QuickReply.find({ clientId }).sort({ category: 1, createdAt: 1 }).lean();
    }

    return sendSuccess(res, { quickReplies: replies, count: replies.length }, 'Quick replies retrieved');
  } catch (error) {
    return next(error);
  }
};

/**
 * Creates custom quick reply
 */
export const createQuickReply = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const userId = req.user!._id;
    const { title, body, category, channel, tags } = req.body;

    if (!title || !body) {
      throw new AppError('Title and message body are required', 400);
    }

    const quickReply = await QuickReply.create({
      clientId,
      title: title.trim(),
      body: body.trim(),
      category: category?.trim() || 'General',
      channel: channel || 'whatsapp',
      tags: tags || [],
      createdBy: userId,
    });

    return sendSuccess(res, quickReply, 'Quick reply created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * Deletes quick reply
 */
export const deleteQuickReply = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { id } = req.params;

    const deleted = await QuickReply.findOneAndDelete({ _id: id, clientId });
    if (!deleted) {
      throw new AppError('Quick reply not found or access denied', 404);
    }

    return sendSuccess(res, { deletedId: id }, 'Quick reply deleted successfully');
  } catch (error) {
    return next(error);
  }
};



