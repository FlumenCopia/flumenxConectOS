import { connectDatabase, disconnectDatabase } from '../config/db';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Client } from '../models/Client';
import { logger } from '../config/logger';

async function run() {
  try {
    await connectDatabase();
    const clients = await Client.find({ isArchived: false });
    
    const phoneNumberId = '1284439638095450';
    const accessToken = 'EAAXfy0sybgwBSg4zbyODVjmoDn5YUSC0MOzCZCMECFWPgOwx4EUc919ppIbrc95ay4w0SufSvOuDUhQo2YDm7VQYnx1eupnZAZCLWmGeTsdAxHaoMre7ZBME0W9NnLi2P3SOaAx5PNywTWHz6xlhnOG68odbZBwkGDWBh0tLoECgfZCzSC0ZBSMp6dZBHigzxQZDZD';

    for (const client of clients) {
      const provider = await CommunicationProvider.findOneAndUpdate(
        { clientId: client._id, providerType: 'whatsapp' },
        {
          $set: {
            clientId: client._id,
            name: 'WhatsApp - +91 79070 64848',
            providerType: 'whatsapp',
            status: 'active',
            isDefault: true,
            configuration: {
              phoneNumberId,
              accessToken,
              wabaId: '2381123346055633',
              defaultTemplateName: 'misc_website_view',
              defaultTemplateLanguage: 'en',
            },
          },
        },
        { upsert: true, new: true }
      );
      logger.info(`[✓] Configured WhatsApp Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`);
    }

    logger.info('WhatsApp provider configured successfully across workspaces!');
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving WhatsApp provider:', err);
    process.exit(1);
  }
}

run();
