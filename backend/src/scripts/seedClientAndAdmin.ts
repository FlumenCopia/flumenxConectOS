import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { logger } from '../config/logger';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { Contact } from '../models/Contact';
import { PortalUser } from '../models/PortalUser';
import { seedDatabase } from './seedSuperAdmin';

export const seedClientAndAdmin = async () => {
  try {
    logger.info('Starting full client, admin, and user seeding...');

    // 1. Seed base roles and permissions + Super Admin
    await seedDatabase();

    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    const clientStaffRole = await Role.findOne({ slug: 'client_staff' });

    if (!clientAdminRole || !clientStaffRole) {
      throw new Error('System roles client_admin or client_staff not found after bootstrap');
    }

    // 2. Ensure Primary Demo Client Workspace exists
    let client = await Client.findOne({ slug: 'acme-digital-media' });
    if (!client) {
      client = await Client.create({
        name: 'Acme Digital Media',
        slug: 'acme-digital-media',
        legalName: 'Acme Digital Media Inc.',
        email: 'contact@acmedigital.com',
        phone: '+1 (555) 234-5678',
        website: 'https://acmedigital.com',
        industry: 'Digital Marketing & Lead Generation',
        city: 'New York',
        country: 'United States',
        timezone: 'America/New_York',
        currency: 'USD',
        status: 'active',
        health: 'healthy',
        isArchived: false,
        onboardingStatus: 'completed',
        onboardingProgress: 100,
        settings: {
          leadResponseThresholdMinutes: 15,
          notificationEmails: ['notifications@acmedigital.com'],
          allowClientUserInvites: true,
        },
      });
      logger.info(`[✓] Created Client Workspace: ${client.name} (${client._id})`);
    } else {
      client.status = 'active';
      client.isArchived = false;
      await client.save();
      logger.info(`[i] Existing Client Workspace verified: ${client.name} (${client._id})`);
    }

    // 3. Seed Client Admin Users
    const clientAdminPassword = 'ClientAdminPassword123!';
    const clientAdminHash = await bcrypt.hash(clientAdminPassword, 10);

    const clientAdminEmails = ['client.admin@acmedigital.com', 'manager@acmedigital.com'];
    for (const email of clientAdminEmails) {
      let user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        user = await User.create({
          name: 'Acme Workspace Admin',
          email,
          passwordHash: clientAdminHash,
          isSuperAdmin: false,
          status: 'active',
          mustChangePassword: false,
        });
        logger.info(`[✓] Created Client Admin user: ${email}`);
      } else {
        user.passwordHash = clientAdminHash;
        user.status = 'active';
        user.mustChangePassword = false;
        await user.save();
        logger.info(`[i] Updated password for Client Admin user: ${email}`);
      }

      // Upsert ClientMembership
      await ClientMembership.findOneAndUpdate(
        { clientId: client._id, userId: user._id },
        {
          $set: {
            clientId: client._id,
            userId: user._id,
            roleId: clientAdminRole._id,
            status: 'active',
            joinedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      logger.info(`[✓] Linked ${email} to ${client.name} with role: client_admin`);
    }

    // 4. Seed Client Staff Users
    const clientStaffPassword = 'ClientStaffPassword123!';
    const clientStaffHash = await bcrypt.hash(clientStaffPassword, 10);

    const clientStaffEmails = ['client.staff@acmedigital.com', 'staff.test@acmedigital.com'];
    for (const email of clientStaffEmails) {
      let user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        user = await User.create({
          name: 'Acme Workspace Staff',
          email,
          passwordHash: clientStaffHash,
          isSuperAdmin: false,
          status: 'active',
          mustChangePassword: false,
        });
        logger.info(`[✓] Created Client Staff user: ${email}`);
      } else {
        user.passwordHash = clientStaffHash;
        user.status = 'active';
        user.mustChangePassword = false;
        await user.save();
        logger.info(`[i] Updated password for Client Staff user: ${email}`);
      }

      // Upsert ClientMembership
      await ClientMembership.findOneAndUpdate(
        { clientId: client._id, userId: user._id },
        {
          $set: {
            clientId: client._id,
            userId: user._id,
            roleId: clientStaffRole._id,
            status: 'active',
            joinedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      logger.info(`[✓] Linked ${email} to ${client.name} with role: client_staff`);
    }

    // 5. Seed Customer Portal User
    const portalEmail = 'customer@example.com';
    const portalPassword = 'Password123!';
    const portalPasswordHash = await bcrypt.hash(portalPassword, 10);

    let contact = await Contact.findOne({ clientId: client._id, email: portalEmail });
    if (!contact) {
      contact = await Contact.create({
        clientId: client._id,
        name: 'Alex Johnson',
        email: portalEmail,
        phone: '+1 (555) 019-2831',
      });
      logger.info(`[✓] Created Contact for Customer Portal: ${portalEmail}`);
    }

    let portalUser = await PortalUser.findOne({ clientId: client._id, email: portalEmail }).select('+passwordHash');
    if (!portalUser) {
      portalUser = await PortalUser.create({
        clientId: client._id,
        contactId: contact._id,
        name: 'Alex Johnson',
        email: portalEmail,
        phone: '+1 (555) 019-2831',
        passwordHash: portalPasswordHash,
        status: 'active',
        tokenVersion: 0,
        consentGiven: true,
      });
      logger.info(`[✓] Created Customer Portal User: ${portalEmail}`);
    } else {
      portalUser.passwordHash = portalPasswordHash;
      portalUser.status = 'active';
      portalUser.consentGiven = true;
      await portalUser.save();
      logger.info(`[i] Updated Customer Portal User: ${portalEmail}`);
    }

    logger.info('================================================================');
    logger.info('🚀 ALL CREDENTIALS SEEDED AND VERIFIED:');
    logger.info('----------------------------------------------------------------');
    logger.info('1. SUPER ADMIN');
    logger.info('   Email:    admin@flumenx.com (or admin@flumenx.in)');
    logger.info('   Password: AdminStrongPassword123!');
    logger.info('----------------------------------------------------------------');
    logger.info('2. CLIENT ADMIN (Acme Digital Media workspace)');
    logger.info('   Email:    client.admin@acmedigital.com (or manager@acmedigital.com)');
    logger.info('   Password: ClientAdminPassword123!');
    logger.info('----------------------------------------------------------------');
    logger.info('3. CLIENT STAFF (Acme Digital Media workspace)');
    logger.info('   Email:    client.staff@acmedigital.com (or staff.test@acmedigital.com)');
    logger.info('   Password: ClientStaffPassword123!');
    logger.info('----------------------------------------------------------------');
    logger.info('4. CUSTOMER PORTAL USER');
    logger.info('   Email:    customer@example.com');
    logger.info('   Password: Password123!');
    logger.info('================================================================');
  } catch (error) {
    logger.error('Error during client and admin seeding:', error);
    throw error;
  }
};

if (require.main === module) {
  (async () => {
    await connectDatabase();
    await seedClientAndAdmin();
    await disconnectDatabase();
    process.exit(0);
  })();
}
