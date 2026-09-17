import crypto from 'crypto';
import {
  ICommunicationProviderInterface,
  IProviderSendMessageParams,
  IProviderSendResult,
} from './provider.interface';
import { logger } from '../../config/logger';

export class MockCommunicationProvider implements ICommunicationProviderInterface {
  readonly providerType: string = 'mock';

  async sendMessage(params: IProviderSendMessageParams): Promise<IProviderSendResult> {
    logger.info(`[MockCommunicationProvider] Sending message via channel=${params.channel} to=${params.to}`);

    // Allow simulating failure for test cases and failure handling verification
    const shouldFail =
      params.body.includes('[SIMULATE_FAIL]') ||
      params.to.includes('fail') ||
      params.to === '+0000000000' ||
      params.metadata?.simulateFailure === true;

    if (shouldFail) {
      logger.warn(`[MockCommunicationProvider] Simulated delivery failure for to=${params.to}`);
      return {
        success: false,
        deliveryStatus: 'failed',
        failureReason: 'Simulated network timeout or carrier rejection (Mock Provider)',
      };
    }

    // Generate deterministic or unique external ID
    const externalId = params.idempotencyKey
      ? `mock_${crypto.createHash('sha256').update(params.idempotencyKey).digest('hex').slice(0, 16)}`
      : `mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    return {
      success: true,
      externalMessageId: externalId,
      deliveryStatus: 'sent',
    };
  }

  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean {
    if (!secret) return true;
    const provided = headers['x-webhook-secret'] || headers['x-mock-signature'];
    if (!provided) return false;
    try {
      const expectedBuf = Buffer.from(secret);
      const providedBuf = Buffer.from(provided);
      if (expectedBuf.length !== providedBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, providedBuf);
    } catch {
      return false;
    }
  }

  async processWebhook(headers: Record<string, any>, body: any): Promise<any> {
    return {
      eventType: body.eventType || 'message.received',
      externalMessageId: body.externalMessageId || `mock_inbound_${Date.now()}`,
      contact: body.from || { name: 'Mock Inbound Contact' },
      channel: body.channel || 'whatsapp',
      body: body.body || '',
      attachments: body.attachments || [],
    };
  }
}
