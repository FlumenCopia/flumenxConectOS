import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';
import { Client } from '../models/Client';
import { Contact } from '../models/Contact';
import { PortalUser } from '../models/PortalUser';

export const seedPortalDemoUser = async () => {
  try {
    logger.info('Starting Customer Portal Demo User Seeder...');

    // 1. Ensure at least one active Client exists
    let client = await Client.findOne({ isArchived: false });
    if (!client) {
      client = await Client.create({
        name: 'Acme Digital Media',
        slug: 'acme-digital-media',
        status: 'active',
        health: 'healthy',
        email: 'contact@acmedigital.com',
      });
      logger.info(`[✓] Created client workspace: ${client.name}`);
    } else {
      logger.info(`[i] Using existing client workspace: ${client.name}`);
    }

    const demoUsers = [
      {
        email: 'portal-test-charlie@customer.local',
        name: 'Charlie Customer',
        phone: '+15553334444',
        password: 'OtherCustomerPassword123!',
      },
      {
        email: 'customer@example.com',
        name: 'Alex Johnson',
        phone: '+15551234567',
        password: 'Password123!',
      },
    ];

    for (const u of demoUsers) {
      // 2. Ensure Contact exists
      let contact = await Contact.findOne({ clientId: client._id, email: u.email });
      if (!contact) {
        contact = await Contact.create({
          clientId: client._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
        });
        logger.info(`[✓] Created contact: ${u.email}`);
      }

      // 3. Hash Password and Upsert Portal User
      const passwordHash = await bcrypt.hash(u.password, 10);
      let portalUser = await PortalUser.findOne({ clientId: client._id, email: u.email }).select('+passwordHash');
      if (!portalUser) {
        portalUser = await PortalUser.create({
          clientId: client._id,
          contactId: contact._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          passwordHash,
          status: 'active',
          tokenVersion: 0,
          consentGiven: true,
        });
        logger.info(`[✓] Created Customer Portal user: ${u.email}`);
      } else {
        portalUser.passwordHash = passwordHash;
        portalUser.status = 'active';
        portalUser.consentGiven = true;
        await portalUser.save();
        logger.info(`[✓] Updated password for existing Customer Portal user: ${u.email}`);
      }
    }

    logger.info('==================================================');
    logger.info('Customer Portal accounts seeded successfully:');
    for (const u of demoUsers) {
      logger.info(`  • Email: ${u.email} | Password: ${u.password}`);
    }
    logger.info('==================================================');
  } catch (error) {
    logger.error('Error seeding portal demo user:', error);
    throw error;
  }
};

if (require.main === module) {
  (async () => {
    await connectDatabase();
    await seedPortalDemoUser();
    await disconnectDatabase();
    process.exit(0);
  })();
}
