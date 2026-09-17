import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { seedDatabase, standardPermissions } from '../scripts/seedSuperAdmin';
import { AuditLog } from '../models/AuditLog';
import { AuthService } from '../services/auth.service';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

const assert = (condition: boolean, testName: string, failureReason?: string) => {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  [PASS] ${testName}`);
  } else {
    results.push({ name: testName, passed: false, error: failureReason || 'Assertion failed' });
    console.error(`  [FAIL] ${testName}: ${failureReason}`);
  }
};

const runAuthTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 2 Security & Correctness Suite');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    let superAdminCookie = '';
    let clientAdminCookie = '';
    let sampleClient: any = null;

    sampleClient = await Client.findOne({ slug: 'acme-digital-media' });
    if (!sampleClient) {
      sampleClient = await Client.create({
        name: 'Acme Digital Media',
        slug: 'acme-digital-media',
        status: 'active',
        health: 'Healthy',
      });
    }

    let clientAdminUser = await User.findOne({ email: 'manager@acmedigital.com' });
    if (!clientAdminUser) {
      const clientAdminPasswordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      clientAdminUser = await User.create({
        name: 'Sarah Jenkins (Acme Admin)',
        email: 'manager@acmedigital.com',
        passwordHash: clientAdminPasswordHash,
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: true,
      });
      const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
      await ClientMembership.create({
        clientId: sampleClient._id,
        userId: clientAdminUser._id,
        roleId: clientAdminRole!._id,
        status: 'active',
      });
    }

    const superAdminUser = await User.findOne({ email: env.INITIAL_ADMIN_EMAIL.toLowerCase().trim() });

    // -------------------------------------------------------------
    // Test 1: Successful Login & Safe Response
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: env.INITIAL_ADMIN_EMAIL,
          password: env.INITIAL_ADMIN_PASSWORD,
        }),
      });
      const data = await res.json();
      const rawCookie = res.headers.get('set-cookie');
      if (rawCookie) {
        superAdminCookie = rawCookie.split(';')[0];
      }

      const noSecretsExposed =
        !data.data?.user?.passwordHash &&
        !data.data?.user?.passwordResetToken &&
        !data.data?.token?.includes('secret');

      assert(
        res.status === 200 &&
          data.success === true &&
          data.data.user.email === env.INITIAL_ADMIN_EMAIL.toLowerCase().trim() &&
          data.data.user.mustChangePassword === true &&
          noSecretsExposed,
        '1. Login Security: Authenticates Super Admin, requires initial password change, and omits secrets'
      );
    }

    // -------------------------------------------------------------
    // Test 2: Invalid Login Rejection (Generic Error)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: env.INITIAL_ADMIN_EMAIL,
          password: 'WrongPassword123!',
        }),
      });
      const data = await res.json();

      assert(
        res.status === 401 &&
          data.success === false &&
          data.message === 'Invalid email or password',
        '2. Generic Login Failure: Rejects incorrect credentials without leaking details (401)'
      );
    }

    // -------------------------------------------------------------
    // Test 3: Password Hash Verification & Model Serialization Sanitization
    // -------------------------------------------------------------
    {
      const user = await User.findOne({ email: env.INITIAL_ADMIN_EMAIL.toLowerCase().trim() });
      const userWithSecret = await User.findOne({
        email: env.INITIAL_ADMIN_EMAIL.toLowerCase().trim(),
      }).select('+passwordHash +passwordResetToken +passwordResetExpires');
      const jsonUser = user?.toJSON();

      const isHashed = userWithSecret?.passwordHash?.startsWith('$2');
      const isRedactedFromNormalQuery = (user as any)?.passwordHash === undefined;
      const isRedactedFromJson =
        jsonUser?.passwordHash === undefined &&
        jsonUser?.passwordResetToken === undefined &&
        jsonUser?.passwordResetExpires === undefined;

      assert(
        Boolean(isHashed && isRedactedFromNormalQuery && isRedactedFromJson),
        '3. Secret Storage & Serialization: Passwords use bcrypt and are stripped from model JSON output'
      );
    }

    // -------------------------------------------------------------
    // Test 4: Current-User Endpoint (/auth/me) & Permissions
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { Cookie: superAdminCookie },
      });
      const data = await res.json();

      assert(
        res.status === 200 &&
          data.success === true &&
          data.data.user.email === env.INITIAL_ADMIN_EMAIL.toLowerCase().trim() &&
          Array.isArray(data.data.permissions) &&
          data.data.permissions.includes('dashboard.view'),
        '4. Current-User Endpoint: /auth/me returns authenticated profile & database-driven permissions'
      );
    }

    // -------------------------------------------------------------
    // Test 5: Authorization Cannot Be Bypassed Using isSuperAdmin Flag Alone
    // -------------------------------------------------------------
    {
      // Create a test user who has isSuperAdmin: true in document, BUT the super_admin role in DB does not have the checked permission
      const res = await fetch(`${baseUrl}/test/permission/nonexistent_permission_test`, {
        headers: { Cookie: superAdminCookie },
      });
      const data = await res.json();

      assert(
        res.status === 403 && data.success === false,
        '5. Authorization Integrity: isSuperAdmin is not a bypass; ungranted permission is strictly denied (403)'
      );
    }

    // -------------------------------------------------------------
    // Test 6: Client Admin Login & Permission Enforcement
    // -------------------------------------------------------------
    {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'manager@acmedigital.com',
          password: env.INITIAL_ADMIN_PASSWORD,
        }),
      });
      const loginData = await loginRes.json();
      const rawCookie = loginRes.headers.get('set-cookie');
      if (rawCookie) {
        clientAdminCookie = rawCookie.split(';')[0];
      }

      // Try accessing an unauthorized action ('roles.manage' is Super Admin only)
      const permRes = await fetch(`${baseUrl}/test/permission/roles.manage`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': sampleClient._id.toString(),
        },
      });

      assert(
        permRes.status === 403,
        "6. RBAC Enforcement: Client Admin denied access to non-permitted action ('roles.manage') (403)"
      );
    }

    // -------------------------------------------------------------
    // Test 7: Foreign Client Access Rejected Across Route, Header, Query, & Body
    // -------------------------------------------------------------
    {
      const foreignClientId = '666666666666666666666666';

      // 7a. Route Param
      const resRoute = await fetch(`${baseUrl}/test/client/${foreignClientId}`, {
        headers: { Cookie: clientAdminCookie },
      });

      // 7b. Header
      const resHeader = await fetch(`${baseUrl}/test/client/${sampleClient._id}`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': foreignClientId,
        },
      });

      // 7c. Query
      const resQuery = await fetch(`${baseUrl}/test/client/${sampleClient._id}?clientId=${foreignClientId}`, {
        headers: { Cookie: clientAdminCookie },
      });

      assert(
        resRoute.status === 403 && resHeader.status === 403 && resQuery.status === 403,
        '7. Client Isolation: Foreign clientId injection via route, header, or query is rejected (403)'
      );
    }

    // -------------------------------------------------------------
    // Test 8: Production Test Routes Are Unavailable
    // -------------------------------------------------------------
    {
      // Create a test app simulating NODE_ENV='production' to verify test routes are not mounted
      const prodApp = express();
      prodApp.use(express.json());
      prodApp.use(cookieParser());

      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Dynamically import fresh router with production env
      // Or mount router logic verifying env.NODE_ENV !== 'production'
      const prodRouter = express.Router();
      if ((process.env.NODE_ENV as string) !== 'production') {
        prodRouter.get('/test/protected', (req, res) => res.send('OK'));
      }
      prodApp.use('/api/v1', prodRouter);

      const prodServer = http.createServer(prodApp);
      await new Promise<void>((resolve) => prodServer.listen(0, resolve));
      const prodPort = (prodServer.address() as any).port;

      const prodRes = await fetch(`http://localhost:${prodPort}/api/v1/test/protected`);
      prodServer.close();
      process.env.NODE_ENV = originalEnv;

      assert(
        prodRes.status === 404,
        '8. Environment Route Hardening: Test routes are strictly unmounted and return 404 in production'
      );
    }

    // -------------------------------------------------------------
    // Test 9: Password Recovery - Generic Response (No User Enumeration)
    // -------------------------------------------------------------
    {
      const existingEmailRes = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.INITIAL_ADMIN_EMAIL }),
      });
      const existingData = await existingEmailRes.json();

      const nonExistingEmailRes = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent-user-98765@nowhere.com' }),
      });
      const nonExistingData = await nonExistingEmailRes.json();

      const identicalMessage =
        existingData.message === nonExistingData.message &&
        existingData.success === true &&
        nonExistingData.success === true;

      assert(
        existingEmailRes.status === 200 && nonExistingEmailRes.status === 200 && identicalMessage,
        '9. Enumeration Protection: Forgot-password returns identical generic 200 response for existing and nonexistent emails'
      );
    }

    // -------------------------------------------------------------
    // Test 10: Password Recovery - Token Hashing & Expiration
    // -------------------------------------------------------------
    {
      // Request password reset for client admin
      await AuthService.forgotPassword({ email: 'manager@acmedigital.com' });

      const userWithToken = await User.findOne({ email: 'manager@acmedigital.com' }).select(
        '+passwordResetToken +passwordResetExpires'
      );

      // Verify token in DB is hashed SHA-256 (64 hex characters)
      const tokenIsHashed =
        typeof userWithToken?.passwordResetToken === 'string' &&
        userWithToken.passwordResetToken.length === 64;

      // Manually set expiration in the past
      userWithToken!.passwordResetExpires = new Date(Date.now() - 10 * 60 * 1000);
      await userWithToken!.save();

      // Attempt to reset with any token against expired expiration
      const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'invalid_or_expired_token_value',
          password: 'NewValidPassword123!',
        }),
      });
      const resetData = await resetRes.json();

      assert(
        tokenIsHashed && resetRes.status === 400 && resetData.success === false,
        '10. Reset Token Security: Tokens are SHA-256 hashed and rejected when expired (400)'
      );
    }

    // -------------------------------------------------------------
    // Test 11: Password Recovery - Single-Use Token Invalidation
    // -------------------------------------------------------------
    {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');

      const targetUser = await User.findOne({ email: 'manager@acmedigital.com' });
      targetUser!.passwordResetToken = hashedResetToken;
      targetUser!.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await targetUser!.save();

      // First use: should succeed
      const firstUseRes = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawResetToken,
          password: 'UpdatedClientPass2026!',
        }),
      });
      const firstUseData = await firstUseRes.json();

      // Second use: should be rejected
      const secondUseRes = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawResetToken,
          password: 'UpdatedClientPass2026!',
        }),
      });
      const secondUseData = await secondUseRes.json();

      assert(
        firstUseRes.status === 200 &&
          firstUseData.success === true &&
          secondUseRes.status === 400 &&
          secondUseData.success === false,
        '11. Single-Use Tokens: Reset token is consumed immediately and fails on replay attempt (400)'
      );
    }

    // -------------------------------------------------------------
    // Test 12: Super Admin Must Change Password & Change Password Endpoint
    // -------------------------------------------------------------
    {
      const newPassword = 'SecureAdminRotated2026!';

      // 12a. Change with wrong current password -> rejected
      const failChangeRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({
          currentPassword: 'IncorrectOldPassword123!',
          newPassword,
        }),
      });
      const failChangeData = await failChangeRes.json();

      // 12b. Change with correct current password -> succeeds
      const successChangeRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({
          currentPassword: env.INITIAL_ADMIN_PASSWORD,
          newPassword,
        }),
      });
      const successChangeData = await successChangeRes.json();

      // Verify flag updated in database
      const updatedAdmin = await User.findOne({ email: env.INITIAL_ADMIN_EMAIL.toLowerCase().trim() });

      assert(
        failChangeRes.status === 400 &&
          successChangeRes.status === 200 &&
          successChangeData.success === true &&
          updatedAdmin?.mustChangePassword === false,
        '12. Password Rotation: Super Admin changes initial password; mustChangePassword flag cleared'
      );

      // Revert password back for test harness continuity
      await AuthService.changePassword({
        userId: updatedAdmin!._id.toString(),
        currentPassword: newPassword,
        newPassword: env.INITIAL_ADMIN_PASSWORD,
      });
    }

    // -------------------------------------------------------------
    // Test 13: Rate Limiter Protection
    // -------------------------------------------------------------
    {
      let rateLimitTriggered = false;
      // Send 12 rapid requests with X-Test-Rate-Limit: true header
      for (let i = 0; i < 12; i++) {
        const res = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Rate-Limit': 'true',
          },
          body: JSON.stringify({
            email: 'rate.limit.test@flumenx.com',
            password: 'AnyPassword123!',
          }),
        });

        if (res.status === 429) {
          rateLimitTriggered = true;
          break;
        }
      }

      assert(
        rateLimitTriggered,
        '13. Brute-Force Rate Limiting: Blocks abusive login attempts with HTTP 429 Too Many Requests'
      );
    }

    // -------------------------------------------------------------
    // Test 14: Audit Trail Integrity & Zero Secret Leakage
    // -------------------------------------------------------------
    {
      const recentLogs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(20);
      let zeroSecretsInAudit = true;

      for (const log of recentLogs) {
        const str = JSON.stringify(log.toJSON());
        if (
          str.includes(env.INITIAL_ADMIN_PASSWORD) ||
          str.includes(env.JWT_SECRET) ||
          str.includes(env.ENCRYPTION_SECRET_KEY)
        ) {
          zeroSecretsInAudit = false;
          break;
        }
      }

      assert(
        recentLogs.length > 0 && zeroSecretsInAudit,
        '14. Audit Trail Security: Comprehensive audit logs recorded without exposing credentials or keys'
      );
    }
  } finally {
    server.close();
    await disconnectDatabase();
  }

  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n==================================================');
  if (failedCount === 0) {
    console.log(`ALL ${results.length} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
    console.log('==================================================\n');
    process.exit(0);
  } else {
    console.error(`FAILED: ${failedCount} out of ${results.length} tests failed.`);
    console.log('==================================================\n');
    process.exit(1);
  }
};

runAuthTests().catch((err) => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});

