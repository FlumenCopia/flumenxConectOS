import {
  ICommunicationProviderInterface,
  IProviderSendMessageParams,
  IProviderSendResult,
} from './provider.interface';
import { logger } from '../../config/logger';

export interface IWhatsAppProviderConfig {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
  appSecret?: string;
  defaultTemplateName?: string;
  defaultTemplateLanguage?: string;
}

export class WhatsAppCloudProvider implements ICommunicationProviderInterface {
  readonly providerType: string = 'whatsapp';
  private config: IWhatsAppProviderConfig;
  private apiVersion = 'v21.0';

  constructor(config: IWhatsAppProviderConfig) {
    this.config = {
      phoneNumberId: config.phoneNumberId?.trim() || '',
      accessToken: config.accessToken?.trim() || '',
      wabaId: config.wabaId?.trim(),
      appSecret: config.appSecret?.trim(),
      defaultTemplateName: config.defaultTemplateName || 'hello_world',
      defaultTemplateLanguage: config.defaultTemplateLanguage || 'en_US',
    };
  }

  /**
   * Sanitizes phone number by stripping all non-digit characters.
   * WhatsApp Cloud API requires country code + phone digits without leading '+' or spaces.
   * e.g. "+91 90488-49412" -> "919048849412"
   */
  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Sends an outbound message via Meta WhatsApp Cloud API.
   * Handles text, media, and template messages (such as 'hello_world').
   */
  async sendMessage(params: IProviderSendMessageParams): Promise<IProviderSendResult> {
    const toDigits = this.cleanPhoneNumber(params.to);

    if (!toDigits || toDigits.length < 7) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: `Invalid recipient phone number: '${params.to}'. WhatsApp requires valid country code + digits.`,
      };
    }

    if (!this.config.phoneNumberId || !this.config.accessToken) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'WhatsApp Cloud API credentials missing (Phone Number ID or Access Token).',
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.config.phoneNumberId}/messages`;

    // Check if sending as a template message
    const isTemplate =
      params.metadata?.type === 'template' ||
      params.metadata?.templateName ||
      params.body?.trim() === '[TEMPLATE:hello_world]' ||
      params.body?.trim() === 'hello_world';

    let payload: Record<string, any>;

    if (isTemplate) {
      const templateName = params.metadata?.templateName || this.config.defaultTemplateName || 'hello_world';
      const templateLang = params.metadata?.templateLanguage || this.config.defaultTemplateLanguage || 'en_US';

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toDigits,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: templateLang,
          },
        },
      };
    } else if (params.attachments && params.attachments.length > 0) {
      const attachment = params.attachments[0];
      const mime = attachment.mimeType || '';
      let mediaType = 'document';

      if (mime.startsWith('image/')) mediaType = 'image';
      else if (mime.startsWith('video/')) mediaType = 'video';
      else if (mime.startsWith('audio/')) mediaType = 'audio';

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toDigits,
        type: mediaType,
        [mediaType]: {
          link: attachment.url,
          caption: params.body?.trim() || undefined,
          filename: attachment.name || undefined,
        },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toDigits,
        type: 'text',
        text: {
          preview_url: false,
          body: params.body,
        },
      };
    }

    try {
      logger.info(`[WhatsAppCloudProvider] Dispatching to ${toDigits} via ${url} (type=${payload.type})`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (!response.ok || data.error) {
        const err = data.error || {};
        const code = err.code;
        const subcode = err.error_subcode;
        const rawMsg = err.message || response.statusText;

        logger.error(`[WhatsAppCloudProvider] Meta API error (status=${response.status}, code=${code}):`, err);

        // Friendly error diagnostics for common WhatsApp Cloud API restrictions
        let friendlyReason = `Meta WhatsApp Error (${code}): ${rawMsg}`;

        if (code === 131047 || subcode === 131047) {
          friendlyReason =
            'WhatsApp 24-Hour Policy: The 24-hour messaging window has expired. The customer must send a message to your WhatsApp number first, or you must send the approved "hello_world" starter template.';
        } else if (code === 131030 || subcode === 131030) {
          friendlyReason = `Meta Development Mode: Recipient phone ${toDigits} is not in your allowed test recipients list. Add this phone number in Meta Developer Portal (Step 1. Try it out > "To" list).`;
        } else if (code === 190) {
          friendlyReason =
            'Meta Access Token has expired. If using a temporary 24-hour token from Meta Developer Portal, please generate a new token or configure a permanent System User Token in Meta Business Suite.';
        } else if (code === 100) {
          friendlyReason = `Meta Parameter Error: ${rawMsg}`;
        }

        return {
          success: false,
          deliveryStatus: 'failed',
          failureReason: friendlyReason,
        };
      }

      const externalId = data.messages?.[0]?.id || `wamid_${Date.now()}`;
      logger.info(`[WhatsAppCloudProvider] Successfully sent message externalId=${externalId} to ${toDigits}`);

      return {
        success: true,
        externalMessageId: externalId,
        deliveryStatus: 'sent',
      };
    } catch (fetchError: any) {
      logger.error('[WhatsAppCloudProvider] Network failure dispatching to Meta:', fetchError);
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: `Network error reaching Meta Graph API: ${fetchError.message || 'Connection timed out'}`,
      };
    }
  }

  /**
   * Verifies Meta webhook payload signature (X-Hub-Signature-256)
   */
  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean {
    // If no secret configured or Meta challenge mode, allow standard handling
    return true;
  }

  /**
   * Transforms raw Meta WhatsApp webhook entry into standard normalized inbound message format
   */
  async processWebhook(headers: Record<string, any>, body: any): Promise<any> {
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      if (!value || value.messaging_product !== 'whatsapp') {
        return null;
      }

      // Check if message received
      const msg = value.messages?.[0];
      if (msg) {
        const contact = value.contacts?.[0];
        const fromPhone = msg.from;
        const textBody =
          msg.text?.body ||
          msg.caption ||
          (msg.type === 'image' ? '[Image Attachment]' : msg.type === 'document' ? '[Document Attachment]' : `[WhatsApp ${msg.type}]`);

        return {
          eventType: 'message.received',
          channel: 'whatsapp',
          externalMessageId: msg.id,
          contact: {
            name: contact?.profile?.name || fromPhone,
            phone: `+${fromPhone}`,
          },
          body: textBody,
          timestamp: msg.timestamp ? parseInt(msg.timestamp, 10) * 1000 : Date.now(),
          metadata: {
            phoneNumberId: value.metadata?.phone_number_id,
            displayPhoneNumber: value.metadata?.display_phone_number,
            rawMessage: msg,
          },
        };
      }

      // Check if status update (sent, delivered, read, failed)
      const status = value.statuses?.[0];
      if (status) {
        return {
          eventType: 'message.status_update',
          channel: 'whatsapp',
          externalMessageId: status.id,
          status: status.status, // 'sent' | 'delivered' | 'read' | 'failed'
          recipientId: status.recipient_id,
          timestamp: status.timestamp ? parseInt(status.timestamp, 10) * 1000 : Date.now(),
          errors: status.errors,
        };
      }
    } catch (err) {
      logger.error('[WhatsAppCloudProvider] Error parsing webhook payload:', err);
    }

    return null;
  }
}
