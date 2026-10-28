import { connectDatabase, disconnectDatabase } from '../config/db';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Client } from '../models/Client';
import { logger } from '../config/logger';

async function run() {
  try {
    await connectDatabase();
    const clients = await Client.find({ isArchived: false });

    const instagramAccountId = '17841470625900032';
    const pageAccessToken =
      'EAAXfy0sybgwBS7ztiigOcN3pD8OdbywXQDSqyhXwV5WQr6VTZCtOheJYbIS8kByEUModZABoPiw1UsKZAvOnqkO6hbY2vJ6vRo43ZCSgoPnQvKl1OkfidwxeOj3yYZB3X55noGnik4JA2hYWY9LZAuu0I49LICxc4pGquWuiEXgDpu57linHu7MIDzR3Km56VZABplZBzjhqrvCZBug8ODBLYweNFkEAwhZCTeSDvYwhOaEbng7cFxBnEacPOG11OcffDC2qS5AuN0LHbTfgV9cqk51tRVlqcBZAMDmaAZDZD';

    for (const client of clients) {
      const provider = await CommunicationProvider.findOneAndUpdate(
        { clientId: client._id, providerType: 'meta_instagram' },
        {
          $set: {
            clientId: client._id,
            displayName: 'Instagram Direct (@flumen_connect_os)',
            providerType: 'meta_instagram',
            status: 'active',
            isDefault: false,
            configuration: {
              instagramAccountId,
              pageAccessToken,
            },
          },
        },
        { upsert: true, new: true }
      );
      logger.info(`[✓] Configured Instagram Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`);
    }

    logger.info('Instagram provider configured successfully across workspaces!');
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving Instagram provider:', err);
    process.exit(1);
  }
}

run();
