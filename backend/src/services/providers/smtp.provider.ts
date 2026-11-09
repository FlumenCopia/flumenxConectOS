import nodemailer, { Transporter } from 'nodemailer';
import {
  ICommunicationProviderInterface,
  IProviderSendMessageParams,
  IProviderSendResult,
} from './provider.interface';
import { logger } from '../../config/logger';

export interface ISmtpProviderConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
  fromName?: string;
  fromEmail?: string;
}

export class SmtpProvider implements ICommunicationProviderInterface {
  readonly providerType: string = 'smtp';
  private config: ISmtpProviderConfig;
  private transporter: Transporter;

  constructor(config: ISmtpProviderConfig) {
    this.config = {
      host: config.host || 'smtp.gmail.com',
      port: config.port ? Number(config.port) : 465,
      secure: config.secure !== undefined ? Boolean(config.secure) : true,
      user: config.user?.trim() || '',
      pass: config.pass?.trim() || '',
      fromName: config.fromName?.trim() || 'FlumenX ConnectOS',
      fromEmail: config.fromEmail?.trim() || config.user?.trim() || 'flumenxmarketing@gmail.com',
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });
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

    if (!this.config.user || !this.config.pass) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Gmail SMTP credentials (user or pass) are missing.',
      };
    }

    const subject =
      params.metadata?.subject ||
      params.metadata?.title ||
      'New message from FlumenX ConnectOS';

    const fromAddress = `"${this.config.fromName}" <${this.config.fromEmail}>`;
    const bodyContent = params.body?.trim() || '';

    // Build payload: supports HTML body or plain text
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(bodyContent);
    const mailOptions: Record<string, any> = {
      from: fromAddress,
      to: recipientEmail,
      subject,
      ...(isHtml ? { html: bodyContent } : { text: bodyContent }),
    };

    // Attachments support
    if (params.attachments && params.attachments.length > 0) {
      mailOptions.attachments = params.attachments.map((att) => ({
        filename: att.name,
        path: att.url,
      }));
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);

      logger.info(
        `[SmtpProvider] Email successfully sent via Gmail SMTP -> MessageId: ${info.messageId}, To: ${recipientEmail}`
      );

      return {
        success: true,
        deliveryStatus: 'sent',
        externalMessageId: info.messageId,
      };
    } catch (error: any) {
      logger.error(
        `[SmtpProvider] Failed to dispatch email to ${recipientEmail}: ${error.message}`,
        error
      );
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: error.message || 'Failed to dispatch email via SMTP.',
      };
    }
  }

  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean {
    return true;
  }

  async processWebhook(headers: Record<string, any>, body: any): Promise<any> {
    return { handled: true };
  }
}

