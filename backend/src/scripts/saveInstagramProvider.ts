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
      'EAAXfy0sybgwBS7RHnlwXHHuJy9n0uLhs5vvNZC9PsvMJEwloBdAYtllFEITuPjEGtGRZBqJRSmAEXXxB3EhsTnlWnBSWtwHlWnQRfDrezLtm6r5yZAHHfdbkinKMI5juFOX7SP7CjC0CZAb2SH8HGZAg3sAtBFkFaaOfqPlSYbbVTnvQv0ZCfgQZA1BaTZAfDAUrbZCeGZCyfm2JUgK1SUet4ZC0Qc84pSIu3WUDePrcBBfoK2wqGzeQ3yjbWJqpAD4NtZAhQHZCGz1tSKQT6znmTNopTJTen0UOA547imwZDZD';

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
