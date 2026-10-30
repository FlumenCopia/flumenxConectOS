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

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER || '+17372508034';

    if (!accountSid || !authToken) {
      logger.error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in .env');
      process.exit(1);
    }

    for (const client of clients) {
      const provider = await CommunicationProvider.findOneAndUpdate(
        { clientId: client._id, providerType: 'twilio' },
        {
          $set: {
            clientId: client._id,
            displayName: `Twilio SMS (${fromNumber})`,
            providerType: 'twilio',
            status: 'active',
            isDefault: false,
            configuration: {
              accountSid,
              authToken,
              fromNumber,
            },
          },
        },
        { upsert: true, new: true }
      );
      logger.info(
        `[✓] Configured Twilio Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
      );
    }

    logger.info('Twilio SMS provider configured successfully across workspaces!');
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving Twilio provider:', err);
    process.exit(1);
  }
}

run();

