import { ICommunicationProviderInterface } from './provider.interface';
import { MockCommunicationProvider } from './mock.provider';
import { WhatsAppCloudProvider } from './whatsapp.provider';
import { InstagramProvider } from './instagram.provider';
import { MessengerProvider } from './messenger.provider';
import { TwilioProvider } from './twilio.provider';
import { CommunicationProvider } from '../../models/CommunicationProvider';
import { logger } from '../../config/logger';

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
          : [normalizedChannel];

      // 1. Prioritize finding the provider specifically configured for this channel
      let configuredProvider = await CommunicationProvider.findOne({
        clientId,
        status: 'active',
        providerType: { $in: targetProviderTypes },
      });

      // 2. Only fall back to default provider if NOT an explicit channel like SMS, Instagram, Messenger, or Email
      const distinctChannels = ['sms', 'twilio', 'meta_instagram', 'meta_messenger', 'email'];
      if (!configuredProvider && !distinctChannels.includes(normalizedChannel)) {
        configuredProvider = await CommunicationProvider.findOne({
          clientId,
          status: 'active',
          isDefault: true,
        });
      }

      if (configuredProvider) {
        switch (configuredProvider.providerType) {
          case 'whatsapp': {
            const cfg = configuredProvider.configuration || {};
            const phoneNumberId = cfg.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
            const accessToken = cfg.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            if (phoneNumberId && accessToken) {
              return new WhatsAppCloudProvider({
                phoneNumberId,
                accessToken,
                wabaId: cfg.wabaId || process.env.WHATSAPP_WABA_ID,
                appSecret: cfg.appSecret || process.env.META_APP_SECRET,
                defaultTemplateName: cfg.defaultTemplateName,
                defaultTemplateLanguage: cfg.defaultTemplateLanguage,
              });
            }
            logger.warn(`WhatsApp provider configured for client ${clientId} missing phoneNumberId or accessToken; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'meta_instagram': {
            const cfg = configuredProvider.configuration || {};
            const instagramAccountId =
              process.env.META_INSTAGRAM_ACCOUNT_ID ||
              cfg.instagramAccountId ||
              '17841470625900032';
            const pageAccessToken =
              process.env.META_PAGE_ACCESS_TOKEN ||
              process.env.INSTAGRAM_PAGE_ACCESS_TOKEN ||
              cfg.pageAccessToken ||
              cfg.accessToken;

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
            const cfg = configuredProvider.configuration || {};
            const pageId =
              process.env.META_PAGE_ID ||
              cfg.pageId ||
              '1383901031476683';
            const pageAccessToken =
              process.env.META_PAGE_ACCESS_TOKEN ||
              process.env.MESSENGER_PAGE_ACCESS_TOKEN ||
              cfg.pageAccessToken ||
              cfg.accessToken;

            if (pageAccessToken) {
              return new MessengerProvider({
                pageId,
                pageAccessToken,
              });
            }
            logger.warn(`Messenger provider configured for client ${clientId} missing pageAccessToken; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'twilio':
          case 'sms' as any: {
            const cfg = configuredProvider.configuration || {};
            const accountSid = cfg.accountSid || process.env.TWILIO_ACCOUNT_SID;
            const authToken = cfg.authToken || process.env.TWILIO_AUTH_TOKEN;
            const fromNumber = cfg.fromNumber || process.env.TWILIO_FROM_NUMBER;

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

          case 'mock':
          default:
            return this.mockProvider;
        }
      }

      // 3. Fallback to environment variables if no database document exists
      if (normalizedChannel === 'meta_instagram') {
        const instagramAccountId = process.env.META_INSTAGRAM_ACCOUNT_ID || '17841470625900032';
        const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
        if (pageAccessToken) {
          return new InstagramProvider({
            instagramAccountId,
            pageAccessToken,
          });
        }
      }

      if (normalizedChannel === 'meta_messenger') {
        const pageId = process.env.META_PAGE_ID || '1383901031476683';
        const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
        if (pageAccessToken) {
          return new MessengerProvider({
            pageId,
            pageAccessToken,
          });
        }
      }

      if (normalizedChannel === 'sms' || normalizedChannel === 'twilio') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_FROM_NUMBER;
        if (accountSid && authToken && fromNumber) {
          return new TwilioProvider({
            accountSid,
            authToken,
            fromNumber,
          });
        }
      }
    } catch (err) {
      logger.warn(`Failed to resolve configured provider for client ${clientId}; defaulting to Mock Provider.`, err);
    }

    return this.mockProvider;
  }
}
