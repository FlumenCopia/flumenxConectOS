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
import {
  encryptProviderConfiguration,
  decryptProviderConfiguration,
  decryptProviderSecret,
  hashWebhookSecret,
  sanitizeProviderDocument,
} from '../utils/crypto';

const getActiveWhatsAppConfig = async (clientId: string) => {
  const provider = await CommunicationProvider.findOne({
    clientId,
    providerType: 'whatsapp',
    status: 'active',
  });
  const config = provider ? decryptProviderConfiguration(provider.configuration || {}) : {};
  return { provider, config };
};

const resolveStoredSecretForTest = async (
  clientId: string,
  providerType: string,
  field: string,
  rawValue?: string
): Promise<string> => {
  const candidate = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (candidate && !candidate.includes('•')) {
    return candidate;
  }
  const existingDoc = await CommunicationProvider.findOne({ clientId, providerType });
  return decryptProviderSecret(existingDoc?.configuration?.[field]);
};

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

    const sanitized = providers.map((p) => sanitizeProviderDocument(p));

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

    const existing = await CommunicationProvider.findOne({ clientId, providerType }).select(
      '+webhookSecretHash'
    );
    let provider;
    if (existing) {
      if (displayName) existing.displayName = displayName;
      const updatedConfig = { ...existing.configuration };
      let nextWebhookSecretHash = existing.webhookSecretHash;
      let webhookSecretUpdated = false;

      for (const [k, v] of Object.entries(configuration || {})) {
        if (typeof v === 'string' && v.includes('•')) {
          continue;
        }
        if (k === 'webhookSecret') {
          const trimmedSecret = typeof v === 'string' ? v.trim() : '';
          webhookSecretUpdated = true;
          nextWebhookSecretHash = trimmedSecret ? hashWebhookSecret(trimmedSecret) : undefined;
          delete updatedConfig.webhookSecret;
          continue;
        }
        updatedConfig[k] = v;
      }

      delete updatedConfig.webhookSecret;
      existing.configuration = encryptProviderConfiguration(updatedConfig);
      if (webhookSecretUpdated) {
        existing.webhookSecretHash = nextWebhookSecretHash;
      }
      if (typeof isDefault === 'boolean') existing.isDefault = isDefault;
      if (status) existing.status = status;
      provider = await existing.save();
    } else {
      const nextConfig: Record<string, any> = { ...(configuration || {}) };
      const rawWebhookSecret =
        typeof nextConfig.webhookSecret === 'string' ? nextConfig.webhookSecret.trim() : '';
      delete nextConfig.webhookSecret;
      const webhookSecretHash = rawWebhookSecret ? hashWebhookSecret(rawWebhookSecret) : undefined;

      provider = await CommunicationProvider.create({
        clientId,
        providerType,
        displayName: displayName || `${providerType.toUpperCase()} Provider`,
        configuration: encryptProviderConfiguration(nextConfig),
        webhookSecretHash,
        isDefault: Boolean(isDefault),
        status: status || 'active',
        createdBy: userId,
      });
    }

    return sendSuccess(
      res,
      sanitizeProviderDocument(provider),
      'Communication provider saved successfully',
      existing ? 200 : 201
    );
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
        const phoneNumberId = (configuration?.phoneNumberId || '').toString().trim();
        if (!phoneNumberId) throw new AppError('WhatsApp Phone Number ID is required', 400);

        const accessToken = await resolveStoredSecretForTest(
          clientId,
          'whatsapp',
          'accessToken',
          configuration?.accessToken
        );

        if (!accessToken) {
          throw new AppError('WhatsApp Cloud API Access Token is required. Please paste your token.', 400);
        }

        try {
          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}?fields=verified_name,code_verification_status,display_phone_number,quality_rating`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
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
              phoneNumberId,
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
        const { instagramAccountId } = configuration || {};
        const pageAccessToken = await resolveStoredSecretForTest(
          clientId,
          'meta_instagram',
          'pageAccessToken',
          configuration?.pageAccessToken
        );
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
        const { pageId } = configuration || {};
        const pageAccessToken = await resolveStoredSecretForTest(
          clientId,
          'meta_messenger',
          'pageAccessToken',
          configuration?.pageAccessToken
        );
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
        const { accountSid, fromNumber } = configuration || {};
        const authToken = await resolveStoredSecretForTest(
          clientId,
          'twilio',
          'authToken',
          configuration?.authToken
        );
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
        const { fromEmail } = configuration || {};
        const apiKey = await resolveStoredSecretForTest(
          clientId,
          'resend',
          'apiKey',
          configuration?.apiKey
        );
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
    const { provider, config } = await getActiveWhatsAppConfig(clientId);

    const accessToken = (config.accessToken || '').toString().trim();
    const wabaId = (config.wabaId || '').toString().trim();
    const phoneNumberId = (config.phoneNumberId || '').toString().trim();

    // Unconfigured workspace: do not make external Meta requests or fall back to another tenant
    if (!provider || !accessToken) {
      return sendSuccess(
        res,
        {
          templates: [],
          count: 0,
          configured: false,
          phoneNumberId: null,
          wabaId: null,
        },
        'WhatsApp integration is not configured for this workspace'
      );
    }

    const helloWorldStarter = {
      id: 'hello_world',
      name: 'hello_world',
      status: 'APPROVED',
      category: 'UTILITY',
      language: 'en_US',
      bodyText:
        'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us.',
    };

    // Configured with Phone Number ID + Token, but no WABA ID saved yet: return built-in starter without external WABA call
    if (!wabaId) {
      return sendSuccess(
        res,
        {
          templates: [helloWorldStarter],
          count: 1,
          configured: true,
          phoneNumberId: phoneNumberId || null,
          wabaId: null,
        },
        'WhatsApp starter templates retrieved (add WABA ID in Integrations to sync custom templates)'
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(wabaId)}/message_templates?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as any;
      const errObj = errBody.error || {};
      throw new AppError(
        `Meta Cloud API failed to load templates (${errObj.code || response.status}): ${errObj.message || response.statusText}`,
        response.status >= 500 ? 502 : 400
      );
    }

    const metaData = (await response.json()) as any;
    const templateMap = new Map<string, any>();

    for (const t of metaData.data || []) {
      const key = `${t.name}_${t.language}`;
      const existing = templateMap.get(key);
      if (!existing || (existing.status !== 'APPROVED' && t.status === 'APPROVED')) {
        const bText = t.components?.find((c: any) => c.type === 'BODY')?.text || '';
        const varMatches = [...bText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]);
        const uniqueVars = Array.from(new Set(varMatches));
        const isNamed = t.parameter_format === 'NAMED' || uniqueVars.some((v) => !/^\d+$/.test(v));

        templateMap.set(key, {
          id: t.id || t.name,
          name: t.name,
          status: t.status,
          category: t.category,
          language: t.language,
          bodyText: bText,
          buttons: t.components?.find((c: any) => c.type === 'BUTTONS')?.buttons || [],
          headerFormat: t.components?.find((c: any) => c.type === 'HEADER')?.format || null,
          components: t.components,
          variables: uniqueVars,
          parameterFormat: isNamed ? 'NAMED' : 'POSITIONAL',
        });
      }
    }

    const templates = Array.from(templateMap.values());
    if (!templates.some((t: any) => t.name === 'hello_world')) {
      templates.unshift(helloWorldStarter);
    }

    return sendSuccess(
      res,
      {
        templates,
        count: templates.length,
        configured: true,
        phoneNumberId: phoneNumberId || null,
        wabaId,
      },
      'WhatsApp templates retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves WhatsApp Business Profile from Meta Cloud API
 */
export const getWhatsAppBusinessProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { provider, config } = await getActiveWhatsAppConfig(clientId);

    const accessToken = (config.accessToken || '').toString().trim();
    const phoneNumberId = (config.phoneNumberId || '').toString().trim();

    if (!provider || !accessToken || !phoneNumberId) {
      return sendSuccess(
        res,
        { configured: false, profile: null },
        'WhatsApp integration is not configured for this workspace'
      );
    }

    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;
    const metaPhoneUrl = `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}?fields=verified_name,display_phone_number`;

    const [response, phoneMetaRes] = await Promise.all([
      fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch(metaPhoneUrl, { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null),
    ]);

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as any;
      throw new AppError(err.error?.message || 'Failed to fetch WhatsApp profile from Meta', 400);
    }

    const data = (await response.json()) as any;
    const phoneMeta = phoneMetaRes && phoneMetaRes.ok ? ((await phoneMetaRes.json().catch(() => ({}))) as any) : {};
    const profile = data.data?.[0] || {};

    return sendSuccess(
      res,
      {
        configured: true,
        profile: {
          phoneNumberId,
          wabaId: config.wabaId || undefined,
          phoneNumber: phoneMeta.display_phone_number || config.phoneNumber || '',
          verifiedName: phoneMeta.verified_name || config.verifiedName || provider.displayName || '',
          ...profile,
        },
      },
      'WhatsApp business profile retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Updates WhatsApp Business Profile in Meta Cloud API
 */
export const updateWhatsAppBusinessProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { provider, config } = await getActiveWhatsAppConfig(clientId);

    const accessToken = (config.accessToken || '').toString().trim();
    const phoneNumberId = (config.phoneNumberId || '').toString().trim();

    if (!provider || !accessToken || !phoneNumberId) {
      throw new AppError('WhatsApp Cloud API integration is not configured for this workspace.', 400);
    }

    const { about, description, address, email, vertical, websites } = req.body;

    const payload: Record<string, any> = {
      messaging_product: 'whatsapp',
    };
    if (about !== undefined) payload.about = about;
    if (description !== undefined) payload.description = description;
    if (address !== undefined) payload.address = address;
    if (email !== undefined) payload.email = email;
    if (vertical !== undefined) payload.vertical = vertical;
    if (Array.isArray(websites)) payload.websites = websites.filter(Boolean);

    const url = `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}/whatsapp_business_profile`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as any;
      throw new AppError(err.error?.message || 'Failed to update WhatsApp profile in Meta', 400);
    }

    return sendSuccess(res, { success: true }, 'WhatsApp business profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Uploads profile picture / avatar to Meta WhatsApp Cloud API via Resumable Upload
 */
export const uploadWhatsAppProfilePicture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { provider, config } = await getActiveWhatsAppConfig(clientId);

    const accessToken = (config.accessToken || '').toString().trim();
    const phoneNumberId = (config.phoneNumberId || '').toString().trim();
    const appId = (config.appId || process.env.META_APP_ID || '').toString().trim();

    if (!provider || !accessToken || !phoneNumberId) {
      throw new AppError('WhatsApp Cloud API integration is not configured for this workspace.', 400);
    }

    if (!appId) {
      throw new AppError(
        'Meta App ID is required in WhatsApp provider configuration to upload a profile picture.',
        400
      );
    }

    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      throw new AppError('Image file data is required', 400);
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const imageType = mimeType || 'image/jpeg';

    // Step 1: Create Resumable Upload Session (token sent via Authorization header, never URL query)
    const sessionRes = await fetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(appId)}/uploads?file_length=${buffer.length}&file_type=${encodeURIComponent(imageType)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const sessionData = (await sessionRes.json()) as any;
    if (!sessionRes.ok || !sessionData.id) {
      throw new AppError(sessionData.error?.message || 'Failed to initiate Meta upload session', 400);
    }

    // Step 2: Upload file binary to the session
    const uploadRes = await fetch(`https://graph.facebook.com/v22.0/${sessionData.id}`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: '0',
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });
    const uploadData = (await uploadRes.json()) as any;
    if (!uploadRes.ok || !uploadData.h) {
      throw new AppError(uploadData.error?.message || 'Failed to upload image to Meta', 400);
    }

    // Step 3: Attach profile_picture_handle to WhatsApp Business Profile
    const profileRes = await fetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}/whatsapp_business_profile`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          profile_picture_handle: uploadData.h,
        }),
      }
    );
    const profileData = (await profileRes.json()) as any;
    if (!profileRes.ok) {
      throw new AppError(profileData.error?.message || 'Failed to set WhatsApp profile photo in Meta', 400);
    }

    return sendSuccess(res, { success: true }, 'WhatsApp profile photo updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * Retrieves WhatsApp account quality rating, verification status, and limits
 */
export const getWhatsAppHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { provider, config } = await getActiveWhatsAppConfig(clientId);

    const accessToken = (config.accessToken || '').toString().trim();
    const phoneNumberId = (config.phoneNumberId || '').toString().trim();

    if (!provider || !accessToken || !phoneNumberId) {
      return sendSuccess(
        res,
        { configured: false, health: null },
        'WhatsApp integration is not configured for this workspace'
      );
    }

    const phoneRes = await fetch(
      `https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}?fields=verified_name,display_phone_number,quality_rating,code_verification_status,name_status,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const phoneInfo = (await phoneRes.json().catch(() => ({}))) as any;

    if (!phoneRes.ok || phoneInfo.error) {
      const errObj = phoneInfo.error || {};
      throw new AppError(
        errObj.message || 'Failed to retrieve WhatsApp account health from Meta',
        phoneRes.status >= 500 ? 502 : 400
      );
    }

    return sendSuccess(res, { configured: true, health: phoneInfo }, 'WhatsApp health retrieved');
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
    const baseUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '');
    const publicUrl = baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl;

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
 * Updates an existing quick reply
 */
export const updateQuickReply = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = await resolveScopeClientId(req);
    const { id } = req.params;
    const { title, body, category, channel, tags } = req.body;

    const quickReply = await QuickReply.findOne({ _id: id, clientId });
    if (!quickReply) {
      throw new AppError('Quick reply not found or access denied', 404);
    }

    if (title !== undefined) quickReply.title = title.trim();
    if (body !== undefined) quickReply.body = body.trim();
    if (category !== undefined) quickReply.category = category.trim();
    if (channel !== undefined) quickReply.channel = channel;
    if (tags !== undefined) quickReply.tags = tags;

    await quickReply.save();
    return sendSuccess(res, quickReply, 'Quick reply updated successfully');
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



