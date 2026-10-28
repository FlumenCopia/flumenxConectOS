import { ICommunicationProviderInterface } from './provider.interface';
import { MockCommunicationProvider } from './mock.provider';
import { WhatsAppCloudProvider } from './whatsapp.provider';
import { InstagramProvider } from './instagram.provider';
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
      // 1. Prioritize finding the provider specifically configured for this channel
      let configuredProvider = await CommunicationProvider.findOne({
        clientId,
        status: 'active',
        providerType: channel,
      });

      // 2. Only fall back to default provider if channel-specific provider is not found
      if (!configuredProvider) {
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
              cfg.instagramAccountId || process.env.META_INSTAGRAM_ACCOUNT_ID || '17841470625900032';
            const pageAccessToken =
              cfg.pageAccessToken || cfg.accessToken || process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

            if (instagramAccountId && pageAccessToken) {
              return new InstagramProvider({
                instagramAccountId,
                pageAccessToken,
              });
            }
            logger.warn(`Instagram provider configured for client ${clientId} missing instagramAccountId or pageAccessToken; falling back to Mock Provider.`);
            return this.mockProvider;
          }

          case 'mock':
          default:
            return this.mockProvider;
        }
      }

      // 3. Fallback to environment variables if no database document exists
      if (channel === 'meta_instagram') {
        const instagramAccountId = process.env.META_INSTAGRAM_ACCOUNT_ID || '17841470625900032';
        const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
        if (pageAccessToken) {
          return new InstagramProvider({
            instagramAccountId,
            pageAccessToken,
          });
        }
      }
    } catch (err) {
      logger.warn(`Failed to resolve configured provider for client ${clientId}; defaulting to Mock Provider.`, err);
    }

    return this.mockProvider;
  }
}
