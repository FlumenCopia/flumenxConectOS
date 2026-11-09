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

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE !== 'false';
    const user = process.env.SMTP_USER || 'flumenxmarketing@gmail.com';
    const pass = process.env.SMTP_PASS;
    const fromName = process.env.SMTP_FROM_NAME || 'FlumenX ConnectOS';
    const fromEmail = process.env.SMTP_FROM_EMAIL || user;

    if (!pass) {
      logger.error('SMTP_PASS must be defined in .env');
      process.exit(1);
    }

    for (const client of clients) {
      // 1. Upsert SMTP provider
      const provider = await CommunicationProvider.findOneAndUpdate(
        { clientId: client._id, providerType: 'smtp' },
        {
          $set: {
            clientId: client._id,
            displayName: `Gmail SMTP (${user})`,
            providerType: 'smtp',
            status: 'active',
            isDefault: false,
            configuration: {
              host,
              port,
              secure,
              user,
              pass,
              fromName,
              fromEmail,
            },
          },
        },
        { upsert: true, new: true }
      );

      // Deactivate any old resend providers if they were used for email, so smtp is prioritized
      await CommunicationProvider.updateMany(
        { clientId: client._id, providerType: 'resend' },
        { $set: { status: 'inactive' } }
      );

      logger.info(
        `[✓] Configured Gmail SMTP Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
      );
    }

    logger.info('Gmail SMTP provider configured successfully across workspaces!');
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving Gmail SMTP provider:', err);
    process.exit(1);
  }
}

run();
