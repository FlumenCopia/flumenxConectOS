import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/db';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Client } from '../models/Client';
import { logger } from '../config/logger';

async function run() {
  try {
    await connectDatabase();
    const clients = await Client.find({ isArchived: false });

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'FlumenX ConnectOS <onboarding@resend.dev>';

    if (!apiKey) {
      logger.error('RESEND_API_KEY must be set in .env');
      process.exit(1);
    }

    for (const client of clients) {
      const provider = await CommunicationProvider.findOneAndUpdate(
        { clientId: client._id, providerType: 'resend' },
        {
          $set: {
            clientId: client._id,
            displayName: `Resend Email (${fromEmail})`,
            providerType: 'resend',
            status: 'active',
            isDefault: false,
            configuration: {
              apiKey,
              fromEmail,
            },
          },
        },
        { upsert: true, new: true }
      );
      logger.info(
        `[✓] Configured Resend Email Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
      );
    }

    logger.info('Resend Email provider configured successfully across workspaces!');
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving Resend provider:', err);
    process.exit(1);
  }
}

run();
