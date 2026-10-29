
import { connectDatabase, disconnectDatabase } from '../config/db';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Client } from '../models/Client';
import { logger } from '../config/logger';

async function run() {
  try {
    await connectDatabase();
    const clients = await Client.find({ isArchived: false });

    const pageId = process.env.META_PAGE_ID || '1383901031476683';
    const pageAccessToken =
      process.env.META_PAGE_ACCESS_TOKEN ||
      process.env.MESSENGER_PAGE_ACCESS_TOKEN ||
    'EAAXfy0sybgwBSZBjuiOyO6sZBjoZCmDyeK7dvpwxhCZAFE5WDI7KXeBW540CZC6c2FRl7M2CVBR4opYRbDdpFpwJPVpgsQzkM41mRPVPR1isUp9hkMDKoy3230AlNmI4rvJMzkEIWlFVyYEctDshaG8Oa2rQrAGDev8yT4PfFLlJr14yu4P5OD4ocRwgHbQZDZD';

    for (const client of clients) {
      const provider = await CommunicationProvider.findOneAndUpdate(
        { clientId: client._id, providerType: 'meta_messenger' },
        {
          $set: {
            clientId: client._id,
            displayName: 'Facebook Messenger (Flumenconnect OS)',
            providerType: 'meta_messenger',
            status: 'active',
            isDefault: false,
            configuration: {
              pageId,
              pageAccessToken,
            },
          },
        },
        { upsert: true, new: true }
      );
      logger.info(
        `[✓] Configured Messenger Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
      );
    }

    logger.info('Facebook Messenger provider configured successfully across workspaces!');
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving Messenger provider:', err);
    process.exit(1);
  }
}

run();

