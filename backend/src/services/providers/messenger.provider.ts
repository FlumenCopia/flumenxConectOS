import {
  ICommunicationProviderInterface,
  IProviderSendMessageParams,
  IProviderSendResult,
} from './provider.interface';
import { logger } from '../../config/logger';

export interface IMessengerProviderConfig {
  pageId?: string;
  pageAccessToken: string;
}

export class MessengerProvider implements ICommunicationProviderInterface {
  readonly providerType: string = 'meta_messenger';
  private config: IMessengerProviderConfig;
  private apiVersion = 'v21.0';

  constructor(config: IMessengerProviderConfig) {
    this.config = {
      pageId: config.pageId?.trim() || '',
      pageAccessToken: config.pageAccessToken?.trim() || '',
    };
  }

  async sendMessage(params: IProviderSendMessageParams): Promise<IProviderSendResult> {
    const recipientId =
      params.to ||
      params.metadata?.recipientId ||
      params.metadata?.messengerScopedId;

    if (!recipientId) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Messenger recipient user ID (PSID) is required.',
      };
    }

    if (!this.config.pageAccessToken) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Facebook Page Access Token is missing.',
      };
    }

    if (this.config.pageAccessToken.startsWith('mock_')) {
      logger.info(
        `[MessengerProvider] Mock mode enabled for local testing. Simulating send to ${recipientId}: "${params.body}"`
      );
      return {
        success: true,
        deliveryStatus: 'sent',
        externalMessageId: `mock_fb_${Date.now()}`,
      };
    }

    // Check if sending as a template message (e.g. misc_website_view)
    const isTemplate =
      params.metadata?.type === 'template' ||
      params.metadata?.templateName ||
      params.body?.trim() === '[TEMPLATE:misc_website_view]' ||
      params.body?.trim() === 'misc_website_view' ||
      params.body?.includes('[Template:');

    let messagePayload: Record<string, any>;

    if (isTemplate) {
      let recipientName =
        params.metadata?.variableValues?.['name'] ||
        params.metadata?.variableValues?.['1'] ||
        params.metadata?.recipientName ||
        '';

      // Discard placeholder names so users never see robotic strings
      if (
        !recipientName ||
        recipientName.startsWith('Facebook User') ||
        recipientName.startsWith('Messenger User') ||
        recipientName === 'Valued Customer' ||
        recipientName.toLowerCase().includes('user')
      ) {
        recipientName = '';
      }

      const greeting = recipientName ? `Hi ${recipientName}!` : 'Hi there!';

      const websiteUrl =
        params.metadata?.websiteUrl ||
        params.metadata?.buttons?.[0]?.url ||
        'https://miscarchive.com/';

      const imageUrl =
        params.attachments?.[0]?.url ||
        params.metadata?.headerImageUrl ||
        'https://miscarchive.com/assets/images/42.png';

      messagePayload = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            image_aspect_ratio: 'square',
            elements: [
              {
                title: 'Welcome to Misc Archive! ✨',
                subtitle: `${greeting} Explore our services and special offers.`.slice(0, 80),
                image_url: imageUrl,
                default_action: {
                  type: 'web_url',
                  url: websiteUrl,
                },
                buttons: [
                  {
                    type: 'web_url',
                    url: websiteUrl,
                    title: 'Visit website',
                  },
                ],
              },
            ],
          },
        },
      };
    } else if (params.attachments && params.attachments.length > 0) {
      const attachment = params.attachments[0];
      const mime = (attachment.mimeType || '').toLowerCase();
      let mediaType = 'image';
      if (mime.startsWith('video/') || /\.(mp4|mov)$/i.test(attachment.name || '')) mediaType = 'video';
      else if (mime.startsWith('audio/') || /\.(mp3|wav|ogg)$/i.test(attachment.name || '')) mediaType = 'audio';
      else if (mime.startsWith('application/') || /\.(pdf|docx?|zip)$/i.test(attachment.name || '')) mediaType = 'file';

      messagePayload = {
        attachment: {
          type: mediaType,
          payload: {
            url: attachment.url,
            is_reusable: true,
          },
        },
      };
    } else {
      messagePayload = {
        text: params.body,
      };
    }

    const payload = {
      recipient: { id: recipientId },
      message: messagePayload,
    };

    // Endpoints for Facebook Messenger API:
    const endpointsToTry: string[] = [
      `https://graph.facebook.com/${this.apiVersion}/me/messages`,
    ];
    if (this.config.pageId) {
      endpointsToTry.unshift(`https://graph.facebook.com/${this.apiVersion}/${this.config.pageId}/messages`);
    }

    let lastError = 'Failed to dispatch Messenger message';

    for (const url of endpointsToTry) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.pageAccessToken}`,
          },
          body: JSON.stringify(payload),
        });

        const resData = (await response.json()) as any;

        if (response.ok && !resData.error) {
          logger.info(`[MessengerProvider] Message successfully delivered via ${url} -> recipient=${recipientId}`);
          return {
            success: true,
            deliveryStatus: 'delivered',
            externalMessageId: resData.message_id || resData.recipient_id,
          };
        }

        lastError = resData.error?.message || `HTTP ${response.status} from ${url}`;
        logger.warn(`[MessengerProvider] Send attempt via ${url} failed:`, resData.error || lastError);
      } catch (err: any) {
        lastError = err.message;
        logger.warn(`[MessengerProvider] Network error attempting ${url}:`, err);
      }
    }

    return {
      success: false,
      deliveryStatus: 'failed',
      failureReason: lastError,
    };
  }

  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean {
    return true;
  }

  async processWebhook(headers: Record<string, any>, body: any): Promise<any> {
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    if (messaging?.message) {
      return {
        eventType: 'message.received',
        channel: 'meta_messenger',
        externalMessageId: messaging.message.mid,
        senderId: messaging.sender?.id,
        body: messaging.message.text,
      };
    }
    return null;
  }
}

