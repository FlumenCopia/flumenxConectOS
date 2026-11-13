import {
  ICommunicationProviderInterface,
  IProviderSendMessageParams,
  IProviderSendResult,
} from './provider.interface';
import { logger } from '../../config/logger';
import { resolveMetaWebhookAppSecret, verifyMetaWebhookHeaders } from '../../utils/crypto';

export interface IInstagramProviderConfig {
  instagramAccountId: string;
  pageAccessToken: string;
}

export class InstagramProvider implements ICommunicationProviderInterface {
  readonly providerType: string = 'meta_instagram';
  private config: IInstagramProviderConfig;
  private apiVersion = 'v21.0';

  constructor(config: IInstagramProviderConfig) {
    this.config = {
      instagramAccountId: config.instagramAccountId?.trim() || '',
      pageAccessToken: config.pageAccessToken?.trim() || '',
    };
  }

  async sendMessage(params: IProviderSendMessageParams): Promise<IProviderSendResult> {
    const recipientId = params.to || params.metadata?.recipientId || params.metadata?.instagramScopedId;
    if (!recipientId) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason:
          'Instagram recipient user ID is required to dispatch DM. The customer must message your Instagram account first.',
      };
    }

    if (!this.config.instagramAccountId || !this.config.pageAccessToken) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Instagram Business Account ID and Page Access Token are required.',
      };
    }

    if (this.config.pageAccessToken.startsWith('mock_')) {
      logger.info(`[InstagramProvider] Mock mode enabled for local testing. Simulating send to ${recipientId}: "${params.body}"`);
      return {
        success: true,
        deliveryStatus: 'sent',
        externalMessageId: `mock_ig_${Date.now()}`,
      };
    }

    const isMiscArchiveTemplate = Boolean(
      params.metadata?.templateName === 'misc_website_view' ||
      params.body?.trim() === '[TEMPLATE:misc_website_view]' ||
      params.body?.trim() === 'misc_website_view' ||
      params.body?.includes('[Template: misc_website_view]') ||
      params.body?.includes('[Template:')
    );

    const isTemplate = Boolean(
      params.metadata?.type === 'template' ||
      params.metadata?.templateName ||
      isMiscArchiveTemplate
    );

    const websiteUrl =
      params.metadata?.websiteUrl ||
      params.metadata?.buttons?.[0]?.url ||
      (isMiscArchiveTemplate ? 'https://miscarchive.com/' : '');
    const imageUrl =
      params.attachments?.[0]?.url ||
      params.metadata?.headerImageUrl ||
      (isMiscArchiveTemplate ? 'https://miscarchive.com/assets/images/42.png' : '');

    const hasTemplateCard = Boolean(isTemplate && websiteUrl);

    let messagePayload: Record<string, any>;

    if (hasTemplateCard) {
      let recipientName =
        params.metadata?.variableValues?.['name'] ||
        params.metadata?.variableValues?.['1'] ||
        params.metadata?.recipientName ||
        '';

      if (
        !recipientName ||
        recipientName.startsWith('Instagram User') ||
        recipientName === 'Valued Customer' ||
        recipientName.toLowerCase().includes('user')
      ) {
        recipientName = '';
      }

      const greeting = recipientName ? `Hi ${recipientName}!` : 'Hi there!';
      const cardTitle =
        params.metadata?.templateTitle ||
        (isMiscArchiveTemplate || websiteUrl.includes('miscarchive')
          ? 'Welcome to Misc Archive! ✨'
          : 'Explore More');
      const cardSubtitle =
        params.metadata?.templateSubtitle ||
        (isMiscArchiveTemplate || websiteUrl.includes('miscarchive')
          ? `${greeting} Explore our services and special offers.`.slice(0, 80)
          : `${greeting} View details and connect with our team.`.slice(0, 80));

      messagePayload = {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'generic',
            image_aspect_ratio: 'square',
            elements: [
              {
                title: cardTitle,
                subtitle: cardSubtitle,
                ...(imageUrl ? { image_url: imageUrl } : {}),
                default_action: {
                  type: 'web_url',
                  url: websiteUrl,
                },
                buttons: [
                  {
                    type: 'web_url',
                    url: websiteUrl,
                    title: params.metadata?.buttons?.[0]?.title || 'Visit website',
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

    const isInstagramUserToken = this.config.pageAccessToken.startsWith('IGAA');
    const graphBaseUrl = isInstagramUserToken
      ? `https://graph.instagram.com/${this.apiVersion}`
      : `https://graph.facebook.com/${this.apiVersion}`;

    const endpointsToTry: string[] = [
      `${graphBaseUrl}/${this.config.instagramAccountId}/messages`,
      `${graphBaseUrl}/me/messages`,
    ];

    let lastError = 'Failed to dispatch Instagram message';

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
          logger.info(`[InstagramProvider] Message successfully delivered via ${url} -> recipient=${recipientId}`);
          return {
            success: true,
            deliveryStatus: 'delivered',
            externalMessageId: resData.message_id || resData.recipient_id,
          };
        }

        lastError = resData.error?.message || `HTTP ${response.status} from ${url}`;
        logger.warn(`[InstagramProvider] Send attempt via ${url} failed:`, resData.error || lastError);
      } catch (err: any) {
        lastError = err.message;
        logger.warn(`[InstagramProvider] Network error attempting ${url}:`, err);
      }
    }

    return {
      success: false,
      deliveryStatus: 'failed',
      failureReason: lastError,
    };
  }

  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean {
    return verifyMetaWebhookHeaders(
      headers,
      rawBody,
      secret !== undefined ? secret : resolveMetaWebhookAppSecret('instagram')
    );
  }

  async processWebhook(headers: Record<string, any>, body: any): Promise<any> {
    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    if (messaging?.message) {
      return {
        eventType: 'message.received',
        channel: 'meta_instagram',
        externalMessageId: messaging.message.mid,
        senderId: messaging.sender?.id,
        body: messaging.message.text,
      };
    }
    return null;
  }
}
