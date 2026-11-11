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
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_WABA_ID;
    const appId = process.env.META_APP_ID;
    const defaultTemplateName = process.env.WHATSAPP_DEFAULT_TEMPLATE || 'hello_world';
    const defaultTemplateLanguage = process.env.WHATSAPP_DEFAULT_TEMPLATE_LANG || 'en_US';

    if (!clientSlug && !clientId) {
      logger.error('CLIENT_SLUG or CLIENT_ID must be set to target a specific workspace.');
      process.exit(1);
    }
    if (!phoneNumberId || !accessToken) {
      logger.error('WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set in environment variables.');
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
      phoneNumberId,
      accessToken,
      ...(wabaId ? { wabaId } : {}),
      ...(appId ? { appId } : {}),
      defaultTemplateName,
      defaultTemplateLanguage,
    });

    const provider = await CommunicationProvider.findOneAndUpdate(
      { clientId: client._id, providerType: 'whatsapp' },
      {
        $set: {
          clientId: client._id,
          displayName: `WhatsApp Cloud API (${phoneNumberId})`,
          providerType: 'whatsapp',
          status: 'active',
          isDefault: true,
          configuration,
        },
      },
      { upsert: true, new: true }
    );
    logger.info(`[✓] Configured WhatsApp Provider for client ${client.name} (${client.slug}) -> Provider ID: ${provider._id}`);

    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('Error saving WhatsApp provider:', err);
    process.exit(1);
  }
}

run();
