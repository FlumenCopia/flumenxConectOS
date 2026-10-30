import {
  ICommunicationProviderInterface,
  IProviderSendMessageParams,
  IProviderSendResult,
} from './provider.interface';
import { logger } from '../../config/logger';

export interface ITwilioProviderConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioProvider implements ICommunicationProviderInterface {
  readonly providerType: string = 'twilio';
  private config: ITwilioProviderConfig;

  constructor(config: ITwilioProviderConfig) {
    this.config = {
      accountSid: config.accountSid?.trim() || '',
      authToken: config.authToken?.trim() || '',
      fromNumber: config.fromNumber?.trim() || '',
    };
  }

  async sendMessage(params: IProviderSendMessageParams): Promise<IProviderSendResult> {
    let recipientPhone = params.to?.trim() || '';

    if (!recipientPhone) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Recipient phone number is required for SMS.',
      };
    }

    // Format phone with leading + if country code is missing
    if (!recipientPhone.startsWith('+')) {
      recipientPhone = `+${recipientPhone}`;
    }

    if (!this.config.accountSid || !this.config.authToken || !this.config.fromNumber) {
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Twilio Account SID, Auth Token, or From Number is missing.',
      };
    }

    if (this.config.authToken.startsWith('mock_')) {
      logger.info(
        `[TwilioProvider] Mock mode enabled. Simulating SMS send to ${recipientPhone}: "${params.body}"`
      );
      return {
        success: true,
        deliveryStatus: 'sent',
        externalMessageId: `mock_twilio_${Date.now()}`,
      };
    }

    const basicAuth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;

    const bodyText = params.body?.trim() || '';

    // Function to execute send
    const executeSend = async (messageBody: string) => {
      const formParams = new URLSearchParams();
      formParams.append('From', this.config.fromNumber);
      formParams.append('To', recipientPhone);
      formParams.append('Body', messageBody);

      return await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });
    };

    try {
      let response = await executeSend(bodyText);
      let resData = (await response.json()) as any;

      // Handle Twilio Trial Account template restriction (Error 572006)
      if (!response.ok && resData.code === 572006) {
        logger.warn(
          `[TwilioProvider] Trial account template restriction detected (572006). Retrying with predefined template "sms_appointment_reminders"`
        );
        response = await executeSend('sms_appointment_reminders');
        resData = (await response.json()) as any;
      }

      if (response.ok && resData.sid) {
        logger.info(
          `[TwilioProvider] SMS dispatched successfully -> SID: ${resData.sid}, Status: ${resData.status}, To: ${recipientPhone}`
        );
        return {
          success: true,
          deliveryStatus: resData.status === 'delivered' ? 'delivered' : 'sent',
          externalMessageId: resData.sid,
        };
      }

      const errorMessage = resData.message || `HTTP ${response.status} from Twilio`;
      logger.warn(`[TwilioProvider] Dispatch failed:`, resData);
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: errorMessage,
      };
    } catch (err: any) {
      logger.error(`[TwilioProvider] Network error attempting Twilio API:`, err);
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: err.message || 'Network error reaching Twilio',
      };
    }
  }

  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean {
    return true;
  }

  async processWebhook(headers: Record<string, any>, body: any): Promise<any> {
    if (body.MessageSid) {
      return {
        eventType: 'message.received',
        channel: 'sms',
        externalMessageId: body.MessageSid,
        senderId: body.From,
        body: body.Body,
      };
    }
    return null;
  }
}
