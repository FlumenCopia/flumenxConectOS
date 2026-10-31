import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/db';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Client } from '../models/Client';
import { logger } from '../config/logger';

async function run() {
  try {
    await connectDatabase();
    const clients = await Client.find({ isArchived: false });

    const instagramAccountId =
      process.env.META_INSTAGRAM_ACCOUNT_ID || '17841470625900032';
    const pageAccessToken =
      process.env.META_PAGE_ACCESS_TOKEN ||
      process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      logger.error('META_PAGE_ACCESS_TOKEN or INSTAGRAM_PAGE_ACCESS_TOKEN must be set in .env');
      process.exit(1);
    }

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
      logger.info(
        `[✓] Configured Instagram Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
      );
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
