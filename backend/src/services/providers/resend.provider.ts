import {
  ICommunicationProviderInterface,
  IProviderSendMessageParams,
  IProviderSendResult,
} from './provider.interface';
import { logger } from '../../config/logger';

export interface IResendProviderConfig {
  apiKey: string;
  fromEmail?: string;
}

export class ResendProvider implements ICommunicationProviderInterface {
  readonly providerType: string = 'resend';
  private config: IResendProviderConfig;

  constructor(config: IResendProviderConfig) {
    this.config = {
      apiKey: config.apiKey?.trim() || '',
      fromEmail: config.fromEmail?.trim() || 'FlumenX ConnectOS <onboarding@resend.dev>',
    };
  }

  async sendMessage(params: IProviderSendMessageParams): Promise<IProviderSendResult> {
    const recipientEmail = params.to?.trim() || '';

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!recipientEmail || !emailRegex.test(recipientEmail)) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: `Invalid recipient email address: '${recipientEmail}'.`,
      };
    }

    if (!this.config.apiKey) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Resend API key is missing.',
      };
    }

    if (this.config.apiKey.startsWith('mock_')) {
      logger.info(
        `[ResendProvider] Mock mode enabled. Simulating email dispatch to ${recipientEmail}: "${params.body}"`
      );
      return {
        success: true,
        deliveryStatus: 'sent',
        externalMessageId: `mock_resend_${Date.now()}`,
      };
    }

    const subject =
      params.metadata?.subject ||
      params.metadata?.title ||
      'New message from FlumenX ConnectOS';

    const fromAddress = this.config.fromEmail || 'FlumenX ConnectOS <onboarding@resend.dev>';
    const bodyContent = params.body?.trim() || '';

    // Build payload: supports HTML body or plain text
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(bodyContent);
    const emailPayload: Record<string, any> = {
      from: fromAddress,
      to: [recipientEmail],
      subject,
      ...(isHtml ? { html: bodyContent } : { text: bodyContent }),
    };

    // Attachments support
    if (params.attachments && params.attachments.length > 0) {
      emailPayload.attachments = params.attachments.map((att) => ({
        filename: att.name,
        path: att.url,
      }));
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const resData = (await response.json()) as any;

      if (response.ok && resData.id) {
        logger.info(
          `[ResendProvider] Email successfully dispatched -> ID: ${resData.id}, To: ${recipientEmail}`
        );
        return {
          success: true,
          deliveryStatus: 'sent',
          externalMessageId: resData.id,
        };
      }

      const errorMessage =
        resData.message || resData.error?.message || `HTTP ${response.status} from Resend API`;
      logger.warn(`[ResendProvider] Email dispatch failed:`, resData);
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: errorMessage,
      };
    } catch (err: any) {
      logger.error(`[ResendProvider] Network error attempting Resend API:`, err);
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: err.message || 'Network error reaching Resend',
      };
    }
  }

  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean {
    return true;
  }

  async processWebhook(headers: Record<string, any>, body: any): Promise<any> {
    return { handled: true, event: body?.type, data: body?.data };
  }
}

