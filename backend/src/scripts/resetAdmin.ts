import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { env } from '../config/env';
import { logger } from '../config/logger';

const run = async () => {
  try {
    await connectDatabase();
    console.log('--------------------------------------------------');
    console.log('MongoDB Connected to:', env.MONGODB_URI);
    console.log('--------------------------------------------------');

    const targetPassword = process.argv[2] || 'AdminStrongPassword123!';
    const passwordHash = await bcrypt.hash(targetPassword, 10);

    const superAdminRole = await Role.findOne({ slug: 'super_admin' });

    const emailsToSync = ['admin@flumenx.com', 'admin@flumenx.in'];

    for (const email of emailsToSync) {
      let user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        user = await User.create({
          name: 'FlumenX Super Admin',
          email,
          passwordHash,
          isSuperAdmin: true,
          status: 'active',
          mustChangePassword: false,
        });
        console.log(`[CREATED] Super Admin: ${email}`);
      } else {
        user.passwordHash = passwordHash;
        user.isSuperAdmin = true;
        user.status = 'active';
        user.mustChangePassword = false;
        await user.save();
        console.log(`[UPDATED] Super Admin: ${email}`);
      }

      // Verify bcrypt match immediately
      const verifiedUser = await User.findOne({ email }).select('+passwordHash');
      const isMatch = await bcrypt.compare(targetPassword, verifiedUser!.passwordHash);
      console.log(`[VERIFIED] ${email} -> Password "${targetPassword}" matches DB hash: ${isMatch}`);
    }

    console.log('--------------------------------------------------');
    console.log('ALL USERS IN DATABASE:');
    const allUsers = await User.find({}).select('+passwordHash');
    allUsers.forEach((u) => {
      console.log(`  - Email: ${u.email} | SuperAdmin: ${u.isSuperAdmin} | Status: ${u.status}`);
    });
    console.log('--------------------------------------------------');
    console.log('SUCCESS! You can now log in with:');
    console.log('  Email:    admin@flumenx.com (or admin@flumenx.in)');
    console.log(`  Password: ${targetPassword}`);
    console.log('--------------------------------------------------');

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Error resetting admin:', error);
    process.exit(1);
  }
};

run();
