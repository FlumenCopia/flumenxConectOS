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
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE !== 'false';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const fromName = process.env.SMTP_FROM_NAME || 'FlumenX ConnectOS';
    const fromEmail = process.env.SMTP_FROM_EMAIL || user;

    if (!clientSlug && !clientId) {
      logger.error('CLIENT_SLUG or CLIENT_ID must be set to target a specific workspace.');
      process.exit(1);
    }
    if (!user || !pass) {
      logger.error('SMTP_USER and SMTP_PASS must be set.');
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
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail,
    });

    const provider = await CommunicationProvider.findOneAndUpdate(
      { clientId: client._id, providerType: 'smtp' },
      {
        $set: {
          clientId: client._id,
          displayName: `SMTP (${user})`,
          providerType: 'smtp',
          status: 'active',
          isDefault: false,
          configuration,
        },
      },
      { upsert: true, new: true }
    );

    await CommunicationProvider.updateMany(
      { clientId: client._id, providerType: 'resend' },
      { $set: { status: 'inactive' } }
    );

    logger.info(
      `[✓] Configured SMTP Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`
    );

    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving SMTP provider:', err);
    process.exit(1);
  }
}

run();
