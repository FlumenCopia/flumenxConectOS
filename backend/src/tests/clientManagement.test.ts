import http from 'http';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { ClientInvitation } from '../models/ClientInvitation';
import { ClientActivity } from '../models/ClientActivity';
import { AuditLog } from '../models/AuditLog';
import { seedDatabase } from '../scripts/seedSuperAdmin';

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

const runClientManagementTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 3 Test Suite');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  // Clean up any previous test client artifacts for idempotency
  await Client.deleteMany({ slug: /^nexus-peak-marketing/ });
  await User.deleteMany({ email: /nexuspeak\.io/ });
  await ClientInvitation.deleteMany({ email: /nexuspeak\.io/ });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    let superAdminCookie = '';
    let clientAdminCookie = '';
    let clientStaffCookie = '';
    let testClientId = '';
    let testInvitationToken = '';

    // 1. Authenticate Super Admin
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: env.INITIAL_ADMIN_EMAIL,
          password: env.INITIAL_ADMIN_PASSWORD,
        }),
      });
      const rawCookie = res.headers.get('set-cookie');
      if (rawCookie) superAdminCookie = rawCookie.split(';')[0];
    }

    // 2. Authenticate Client Admin (manager@acmedigital.com)
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'manager@acmedigital.com',
          password: env.INITIAL_ADMIN_PASSWORD,
        }),
      });
      const rawCookie = res.headers.get('set-cookie');
      if (rawCookie) clientAdminCookie = rawCookie.split(';')[0];
    }

    // 3. Create & Authenticate Client Staff user
    const sampleClient = await Client.findOne({ slug: 'acme-digital-media' });
    const clientStaffRole = await Role.findOne({ slug: 'client_staff' });
    const staffEmail = 'staff.test@acmedigital.com';

    let staffUser = await User.findOne({ email: staffEmail });
    if (!staffUser) {
      staffUser = await User.create({
        name: 'Staff Tester',
        email: staffEmail,
        passwordHash: (await User.findOne({ email: 'manager@acmedigital.com' }).select('+passwordHash'))!.passwordHash,
        status: 'active',
      });
      await ClientMembership.create({
        clientId: sampleClient!._id,
        userId: staffUser._id,
        roleId: clientStaffRole!._id,
        status: 'active',
      });
    }

    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: staffEmail,
          password: env.INITIAL_ADMIN_PASSWORD,
        }),
      });
      const rawCookie = res.headers.get('set-cookie');
      if (rawCookie) clientStaffCookie = rawCookie.split(';')[0];
    }

    // -------------------------------------------------------------
    // Test 1: Super Admin Can Create a Client
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({
          name: 'Nexus Peak Marketing',
          legalName: 'Nexus Peak Holdings LLC',
          email: 'hello@nexuspeak.io',
          phone: '+1 555-4321',
          industry: 'SaaS & Tech',
          timezone: 'America/Los_Angeles',
          currency: 'USD',
          brandColor: '#2563eb',
        }),
      });
      const data = await res.json();

      if (data.data?._id) testClientId = data.data._id;

      assert(
        res.status === 201 &&
          data.success === true &&
          data.data.slug === 'nexus-peak-marketing' &&
          data.data.onboardingChecklist.length === 14 &&
          data.data.onboardingProgress === 7,
        '1. Client Creation: Super Admin successfully provisions client workspace with default onboarding checklist'
      );
    }

    // -------------------------------------------------------------
    // Test 2: Unauthorized Users Cannot Create a Client
    // -------------------------------------------------------------
    {
      const resClientAdmin = await fetch(`${baseUrl}/admin/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
        },
        body: JSON.stringify({ name: 'Hacker Workspace Inc' }),
      });

      const resUnauth = await fetch(`${baseUrl}/admin/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Anonymous Workspace' }),
      });

      assert(
        resClientAdmin.status === 403 && resUnauth.status === 401,
        '2. Client Creation Restriction: Non-admin users (403) and unauthenticated users (401) cannot create clients'
      );
    }

    // -------------------------------------------------------------
    // Test 3: Client List Supports Pagination and Filtering
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/clients?page=1&limit=2&search=nexus&status=onboarding`, {
        headers: { Cookie: superAdminCookie },
      });
      const data = await res.json();

      assert(
        res.status === 200 &&
          Array.isArray(data.data.clients) &&
          data.data.pagination.page === 1 &&
          data.data.clients.some((c: any) => c.slug === 'nexus-peak-marketing'),
        '3. Directory Query: Supports pagination, keyword search, and status filtering'
      );
    }

    // -------------------------------------------------------------
    // Test 4: Client Updates Are Validated
    // -------------------------------------------------------------
    {
      // Valid update
      const validRes = await fetch(`${baseUrl}/admin/clients/${testClientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({
          legalName: 'Nexus Peak Worldwide Inc',
          brandColor: '#059669',
        }),
      });
      const validData = await validRes.json();

      // Invalid update (invalid hex color)
      const invalidRes = await fetch(`${baseUrl}/admin/clients/${testClientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({ brandColor: 'not-a-hex' }),
      });

      assert(
        validRes.status === 200 &&
          validData.data.legalName === 'Nexus Peak Worldwide Inc' &&
          (invalidRes.status === 400 || invalidRes.status === 422),
        '4. Client Validation: Updates validated via Zod schemas and invalid fields rejected (400/422)'
      );
    }

    // -------------------------------------------------------------
    // Test 5: Client Archive Behavior (Soft Delete)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/clients/${testClientId}`, {
        method: 'DELETE',
        headers: { Cookie: superAdminCookie },
      });
      const data = await res.json();

      const archivedInDb = await Client.findById(testClientId);

      assert(
        res.status === 200 &&
          data.data.status === 'archived' &&
          archivedInDb?.isArchived === true &&
          archivedInDb.status === 'archived',
        '5. Soft Archive: Client is marked as archived rather than permanently deleted'
      );

      // Restore client for subsequent tests
      await Client.findByIdAndUpdate(testClientId, { status: 'active', isArchived: false, archivedAt: null });
    }

    // -------------------------------------------------------------
    // Test 6: Client Health Updates Are Permission-Protected
    // -------------------------------------------------------------
    {
      const healthRes = await fetch(`${baseUrl}/admin/clients/${testClientId}/health`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({ health: 'needs_attention', notes: 'Lead flow decreased' }),
      });
      const healthData = await healthRes.json();

      // Client staff attempt to change health
      const staffAttempt = await fetch(`${baseUrl}/admin/clients/${testClientId}/health`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientStaffCookie,
        },
        body: JSON.stringify({ health: 'healthy' }),
      });

      assert(
        healthRes.status === 200 &&
          healthData.data.health === 'needs_attention' &&
          staffAttempt.status === 403,
        '6. Client Health Management: Health status is successfully updated and protected by RBAC'
      );
    }

    // -------------------------------------------------------------
    // Test 7: Account Manager Assignment Is Restricted
    // -------------------------------------------------------------
    {
      const superAdminUser = await User.findOne({ email: env.INITIAL_ADMIN_EMAIL.toLowerCase() });
      const assignRes = await fetch(`${baseUrl}/admin/clients/${testClientId}/managers`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({ primaryAccountManagerId: superAdminUser!._id.toString() }),
      });
      const assignData = await assignRes.json();

      // Client admin cannot reassign account managers
      const clientAdminAttempt = await fetch(`${baseUrl}/admin/clients/${testClientId}/managers`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
        },
        body: JSON.stringify({ primaryAccountManagerId: superAdminUser!._id.toString() }),
      });

      assert(
        assignRes.status === 200 &&
          assignData.data.primaryAccountManagerId === superAdminUser!._id.toString() &&
          clientAdminAttempt.status === 403,
        '7. Manager Assignment: Restricts account manager assignment to authorized Super Admin'
      );
    }

    // -------------------------------------------------------------
    // Test 8: Client Users Cannot Access Another Client
    // -------------------------------------------------------------
    {
      // Client admin of Acme Digital Media attempts to read Nexus Peak workspace
      const res = await fetch(`${baseUrl}/client/workspace/current`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': testClientId,
        },
      });

      assert(
        res.status === 403,
        '8. Cross-Tenant Isolation: Access to foreign client workspace strictly denied (403)'
      );
    }

    // -------------------------------------------------------------
    // Test 9: Duplicate Memberships Are Rejected
    // -------------------------------------------------------------
    {
      let duplicateThrew = false;
      try {
        await ClientMembership.create({
          clientId: sampleClient!._id,
          userId: staffUser!._id,
          roleId: clientStaffRole!._id,
          status: 'active',
        });
      } catch (err: any) {
        duplicateThrew = err.code === 11000;
      }

      assert(
        duplicateThrew,
        '9. Membership Uniqueness: Database compound unique index rejects duplicate membership records'
      );
    }

    // -------------------------------------------------------------
    // Test 10: Invitations Use Secure, Expiring, Single-Use Tokens
    // -------------------------------------------------------------
    {
      const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
      const inviteEmail = 'invited.executive@nexuspeak.io';

      // 10a. Send invitation
      const inviteRes = await fetch(`${baseUrl}/admin/clients/${testClientId}/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
        },
        body: JSON.stringify({
          email: inviteEmail,
          roleId: clientAdminRole!._id.toString(),
        }),
      });
      const inviteData = await inviteRes.json();
      testInvitationToken = inviteData.data._testToken;

      // Verify token in DB is hashed SHA-256 and not raw token
      const rawInDb = await ClientInvitation.findOne({ tokenHash: testInvitationToken });
      const hashInDb = await ClientInvitation.findOne({ email: inviteEmail, status: 'pending' }).select('+tokenHash');

      const tokenIsHashed = rawInDb === null && hashInDb !== null && hashInDb.tokenHash.length === 64;

      // 10b. Accept invitation (first use)
      const acceptRes = await fetch(`${baseUrl}/auth/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: testInvitationToken,
          password: 'InvitedExecutivePass2026!',
          name: 'Invited Executive',
        }),
      });
      const acceptData = await acceptRes.json();

      // 10c. Replay invitation (second use - single-use enforcement)
      const replayRes = await fetch(`${baseUrl}/auth/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: testInvitationToken,
          password: 'InvitedExecutivePass2026!',
        }),
      });

      assert(
        inviteRes.status === 201 &&
          tokenIsHashed &&
          acceptRes.status === 200 &&
          acceptData.success === true &&
          replayRes.status === 400,
        '10. Secure Invitations: Tokens are SHA-256 hashed, single-use, and replay-protected'
      );
    }

    // -------------------------------------------------------------
    // Test 11: Client Admin Can Manage Permitted Team Members
    // -------------------------------------------------------------
    {
      const roleRes = await fetch(
        `${baseUrl}/admin/clients/${sampleClient!._id}/users/${staffUser!._id}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: clientAdminCookie,
            'X-Client-Id': sampleClient!._id.toString(),
          },
          body: JSON.stringify({ roleId: clientStaffRole!._id.toString() }),
        }
      );

      assert(
        roleRes.status === 200,
        '11. Workspace Team Management: Client Admin can update team member roles within tenant'
      );
    }

    // -------------------------------------------------------------
    // Test 12: Client Staff Cannot Perform Restricted Actions
    // -------------------------------------------------------------
    {
      const res = await fetch(
        `${baseUrl}/admin/clients/${sampleClient!._id}/users/${staffUser!._id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: clientStaffCookie,
            'X-Client-Id': sampleClient!._id.toString(),
          },
          body: JSON.stringify({ status: 'suspended' }),
        }
      );

      assert(
        res.status === 403,
        '12. Role Boundaries: Client Staff denied permission to manage workspace users (403)'
      );
    }

    // -------------------------------------------------------------
    // Test 13: Onboarding Updates Are Client-Scoped & Compute Progress
    // -------------------------------------------------------------
    {
      const client = await Client.findById(testClientId);
      const secondItem = client!.onboardingChecklist[1];

      const res = await fetch(
        `${baseUrl}/admin/clients/${testClientId}/onboarding/${secondItem._id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: superAdminCookie,
          },
          body: JSON.stringify({
            status: 'completed',
            notes: 'Primary contact onboarded and verified',
          }),
        }
      );
      const data = await res.json();

      // 2 out of 14 items completed = ~14%
      assert(
        res.status === 200 &&
          data.data.onboardingProgress === 14 &&
          data.data.onboardingStatus === 'in_progress',
        '13. Onboarding Lifecycle: Item status updates trigger automatic progress percentage calculation'
      );
    }

    // -------------------------------------------------------------
    // Test 14: Audit Logs & Activity Records Are Created
    // -------------------------------------------------------------
    {
      const clientActivities = await ClientActivity.find({ clientId: testClientId });
      const auditLogs = await AuditLog.find({ clientId: testClientId });

      assert(
        clientActivities.length >= 3 && auditLogs.length >= 3,
        '14. Audit & Activity Trails: Operational actions automatically generate audit logs and activity events'
      );
    }

    // -------------------------------------------------------------
    // Test 15: Sensitive Data Is Not Returned
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/clients/${testClientId}`, {
        headers: { Cookie: superAdminCookie },
      });
      const data = await res.json();
      const stringified = JSON.stringify(data);

      const leaksTokenOrPassword =
        stringified.includes('passwordHash') ||
        stringified.includes('tokenHash') ||
        stringified.includes(env.INITIAL_ADMIN_PASSWORD);

      assert(
        res.status === 200 && !leaksTokenOrPassword,
        '15. Information Disclosure Prevention: Passwords and token hashes are never exposed in API outputs'
      );
    }

    // -------------------------------------------------------------
    // Test 16: Workspace Switching Validates Membership
    // -------------------------------------------------------------
    {
      // 16a. Switching to a client where user has membership -> succeeds
      const validSwitch = await fetch(`${baseUrl}/client/workspace/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
        },
        body: JSON.stringify({ targetClientId: sampleClient!._id.toString() }),
      });
      const validSwitchData = await validSwitch.json();

      // 16b. Switching to a foreign client where user has NO membership -> 403 denied
      const invalidSwitch = await fetch(`${baseUrl}/client/workspace/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
        },
        body: JSON.stringify({ targetClientId: testClientId }),
      });

      assert(
        validSwitch.status === 200 &&
          validSwitchData.data.client.id === sampleClient!._id.toString() &&
          invalidSwitch.status === 403,
        '16. Workspace Switching: Server validates target client membership and rejects unauthorized switches (403)'
      );
    }
  } finally {
    server.close();
    await disconnectDatabase();
  }

  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n==================================================');
  if (failedCount === 0) {
    console.log(`ALL ${results.length} RELEASE 3 TESTS PASSED SUCCESSFULLY!`);
    console.log('==================================================\n');
    process.exit(0);
  } else {
    console.error(`FAILED: ${failedCount} out of ${results.length} tests failed.`);
    console.log('==================================================\n');
    process.exit(1);
  }
};

runClientManagementTests().catch((err) => {
  console.error('Fatal error in clientManagement test runner:', err);
  process.exit(1);
});
