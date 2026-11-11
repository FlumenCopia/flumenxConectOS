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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!clientSlug && !clientId) {
      logger.error('CLIENT_SLUG or CLIENT_ID must be set to target a specific workspace.');
      process.exit(1);
    }
    if (!accountSid || !authToken || !fromNumber) {
      logger.error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must be set.');
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
      accountSid,
      authToken,
      fromNumber,
    });

    const provider = await CommunicationProvider.findOneAndUpdate(
      { clientId: client._id, providerType: 'twilio' },
      {
        $set: {
          clientId: client._id,
          displayName: `Twilio SMS (${fromNumber})`,
          providerType: 'twilio',
          status: 'active',
          isDefault: false,
          configuration,
        },
      },
      { upsert: true, new: true }
    );
    logger.info(
      `[✓] Configured Twilio Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
    );

    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving Twilio provider:', err);
    process.exit(1);
  }
}

run();

