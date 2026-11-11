import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/db';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Client } from '../models/Client';
import { logger } from '../config/logger';
import { encryptProviderConfiguration } from '../utils/crypto';

async function run() {
  try {
    const clientSlug = process.env.CLIENT_SLUG;
    const clientId = process.env.CLIENT_ID;
    const instagramAccountId = process.env.META_INSTAGRAM_ACCOUNT_ID;
    const pageAccessToken =
      process.env.INSTAGRAM_PAGE_ACCESS_TOKEN ||
      process.env.META_PAGE_ACCESS_TOKEN;

    if (!clientSlug && !clientId) {
      logger.error('CLIENT_SLUG or CLIENT_ID must be set to target a specific workspace.');
      process.exit(1);
    }
    if (!instagramAccountId || !pageAccessToken) {
      logger.error('META_INSTAGRAM_ACCOUNT_ID and INSTAGRAM_PAGE_ACCESS_TOKEN (or META_PAGE_ACCESS_TOKEN) must be set.');
      process.exit(1);
    }

    await connectDatabase();
    const client = await Client.findOne(
      clientId ? { _id: clientId, isArchived: false } : { slug: clientSlug, isArchived: false }
    );
    if (!client) {
      logger.error('Target active client workspace not found.');
      await disconnectDatabase();
      process.exit(1);
    }

    const configuration = encryptProviderConfiguration({
      instagramAccountId,
      pageAccessToken,
    });

    const provider = await CommunicationProvider.findOneAndUpdate(
      { clientId: client._id, providerType: 'meta_instagram' },
      {
        $set: {
          clientId: client._id,
          displayName: `Instagram Direct (${instagramAccountId})`,
          providerType: 'meta_instagram',
          status: 'active',
          isDefault: false,
          configuration,
        },
      },
      { upsert: true, new: true }
    );
    logger.info(
      `[✓] Configured Instagram Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
    );

    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving Instagram provider:', err);
    process.exit(1);
  }
}

run();
