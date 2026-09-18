import { ICommunicationProviderInterface } from './provider.interface';
import { MockCommunicationProvider } from './mock.provider';
import { WhatsAppCloudProvider } from './whatsapp.provider';
import { CommunicationProvider } from '../../models/CommunicationProvider';
import { logger } from '../../config/logger';

export class ProviderManager {
  private static mockProvider = new MockCommunicationProvider();

  /**
   * Resolves the communication provider instance for a client and channel.
   * If a real integration is configured and active in MongoDB, it is loaded.
   * Otherwise, safely falls back to the MockCommunicationProvider.
   */
  static async getProvider(
    clientId: string,
    channel: string
  ): Promise<ICommunicationProviderInterface> {
    try {
      const configuredProvider = await CommunicationProvider.findOne({
        clientId,
        status: 'active',
        $or: [{ providerType: channel }, { isDefault: true }],
      });

      if (configuredProvider) {
        switch (configuredProvider.providerType) {
          case 'whatsapp': {
            const cfg = configuredProvider.configuration || {};
            if (cfg.phoneNumberId && cfg.accessToken) {
              return new WhatsAppCloudProvider({
                phoneNumberId: cfg.phoneNumberId,
                accessToken: cfg.accessToken,
                wabaId: cfg.wabaId,
                appSecret: cfg.appSecret,
                defaultTemplateName: cfg.defaultTemplateName,
                defaultTemplateLanguage: cfg.defaultTemplateLanguage,
              });
            }
            logger.warn(`WhatsApp provider configured for client ${clientId} missing phoneNumberId or accessToken; falling back to Mock Provider.`);
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
