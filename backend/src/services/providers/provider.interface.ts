export interface IProviderSendMessageParams {
  to: string;
  channel: string;
  body: string;
  attachments?: Array<{
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
  }>;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface IProviderSendResult {
  success: boolean;
  externalMessageId?: string;
  deliveryStatus: 'sent' | 'delivered' | 'failed';
  failureReason?: string;
}

export interface ICommunicationProviderInterface {
  readonly providerType: string;
  sendMessage(params: IProviderSendMessageParams): Promise<IProviderSendResult>;
  verifyWebhook(headers: Record<string, any>, rawBody: any, secret?: string): boolean;
  processWebhook(headers: Record<string, any>, body: any): Promise<any>;
}
