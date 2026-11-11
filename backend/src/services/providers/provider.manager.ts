import { ICommunicationProviderInterface } from './provider.interface';
import { MockCommunicationProvider } from './mock.provider';
import { WhatsAppCloudProvider } from './whatsapp.provider';
import { InstagramProvider } from './instagram.provider';
import { MessengerProvider } from './messenger.provider';
import { TwilioProvider } from './twilio.provider';
import { ResendProvider } from './resend.provider';
import { SmtpProvider } from './smtp.provider';
import { CommunicationProvider } from '../../models/CommunicationProvider';
import { logger } from '../../config/logger';
import { decryptProviderConfiguration } from '../../utils/crypto';

export class ProviderManager {
  private static mockProvider = new MockCommunicationProvider();

  /**
   * Resolves the communication provider instance for a client and channel.
   * If a real integration is configured in MongoDB or .env, it is loaded.
   * Otherwise, safely falls back to the MockCommunicationProvider.
   */
  static async getProvider(
    clientId: string,
    channel: string
  ): Promise<ICommunicationProviderInterface> {
    try {
      const normalizedChannel = (channel || '').toLowerCase().trim();

      // Map channel to corresponding providerType(s)
      const targetProviderTypes =
        normalizedChannel === 'sms' || normalizedChannel === 'twilio'
          ? ['twilio', 'sms']
          : normalizedChannel === 'email' || normalizedChannel === 'smtp' || normalizedChannel === 'resend'
          ? ['smtp', 'resend', 'email']
          : [normalizedChannel];

      // 1. Prioritize finding the provider specifically configured for this channel
      let configuredProvider = await CommunicationProvider.findOne({
        clientId,
        status: 'active',
        providerType: { $in: targetProviderTypes },
      });

      // 2. Only fall back to default provider if NOT an explicit channel like SMS, Instagram, Messenger, or Email
      const distinctChannels = ['sms', 'twilio', 'meta_instagram', 'meta_messenger', 'email', 'smtp', 'resend'];
      if (!configuredProvider && !distinctChannels.includes(normalizedChannel)) {
        configuredProvider = await CommunicationProvider.findOne({
          clientId,
          status: 'active',
          isDefault: true,
        });
      }

      if (configuredProvider) {
        const cfg = decryptProviderConfiguration(configuredProvider.configuration || {});

        switch (configuredProvider.providerType) {
          case 'whatsapp': {
            const phoneNumberId = cfg.phoneNumberId;
            const accessToken = cfg.accessToken;
            if (phoneNumberId && accessToken) {
              return new WhatsAppCloudProvider({
                phoneNumberId,
                accessToken,
                wabaId: cfg.wabaId,
                appSecret: cfg.appSecret,
                defaultTemplateName: cfg.defaultTemplateName,
                defaultTemplateLanguage: cfg.defaultTemplateLanguage,
                defaultHeaderImageUrl: cfg.defaultHeaderImageUrl,
              });
            }
            logger.warn(`WhatsApp provider configured for client ${clientId} missing phoneNumberId or accessToken; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'meta_instagram': {
            const instagramAccountId = cfg.instagramAccountId;
            const pageAccessToken = cfg.pageAccessToken || cfg.accessToken;

            if (instagramAccountId && pageAccessToken) {
              return new InstagramProvider({
                instagramAccountId,
                pageAccessToken,
              });
            }
            logger.warn(`Instagram provider configured for client ${clientId} missing instagramAccountId or pageAccessToken; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'meta_messenger': {
            const pageId = cfg.pageId || cfg.facebookPageId;
            const pageAccessToken = cfg.pageAccessToken || cfg.accessToken;

            if (pageId && pageAccessToken) {
              return new MessengerProvider({
                pageId,
                pageAccessToken,
              });
            }
            logger.warn(`Messenger provider configured for client ${clientId} missing pageId or pageAccessToken; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'twilio':
          case 'sms' as any: {
            const accountSid = cfg.accountSid;
            const authToken = cfg.authToken;
            const fromNumber = cfg.fromNumber;

            if (accountSid && authToken && fromNumber) {
              return new TwilioProvider({
                accountSid,
                authToken,
                fromNumber,
              });
            }
            logger.warn(`Twilio provider configured for client ${clientId} missing accountSid, authToken, or fromNumber; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'smtp': {
            const user = cfg.user;
            const pass = cfg.pass;
            if (user && pass) {
              return new SmtpProvider({
                host: cfg.host,
                port: cfg.port ? Number(cfg.port) : undefined,
                secure: cfg.secure,
                user,
                pass,
                fromName: cfg.fromName,
                fromEmail: cfg.fromEmail || user,
              });
            }
            logger.warn(`SMTP provider configured for client ${clientId} missing user or pass; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'resend':
          case 'email' as any: {
            if (cfg.user && cfg.pass) {
              return new SmtpProvider({
                host: cfg.host,
                port: cfg.port ? Number(cfg.port) : undefined,
                secure: cfg.secure,
                user: cfg.user,
                pass: cfg.pass,
                fromName: cfg.fromName,
                fromEmail: cfg.fromEmail || cfg.user,
              });
            }

            const apiKey = cfg.apiKey;
            const fromEmail = cfg.fromEmail;

            if (apiKey) {
              return new ResendProvider({
                apiKey,
                fromEmail,
              });
            }
            logger.warn(`Email provider configured for client ${clientId} missing credentials; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'mock':
          default:
            return this.mockProvider;
        }
      }
    } catch (err) {
      logger.warn(`Failed to resolve configured provider for client ${clientId}; defaulting to Mock Provider.`, err);
    }

    return this.mockProvider;
  }
}
