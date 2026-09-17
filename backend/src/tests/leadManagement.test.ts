import http from 'http';
import bcrypt from 'bcryptjs';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { Lead } from '../models/Lead';
import { LeadActivity } from '../models/LeadActivity';
import { ClientWebhook } from '../models/ClientWebhook';
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

const runLeadManagementTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 4 Test Suite');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  // Cleanup test artifacts for idempotency
  await Client.deleteMany({ slug: /^acme-apex-test/ });
  await Lead.deleteMany({ fullName: /^Test Lead/ });
  await ClientWebhook.deleteMany({ name: /^Test Webhook/ });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    let superAdminCookie = '';
    let clientAdminCookie = '';
    let clientStaffCookie = '';
    let clientAId = '';
    let clientBId = '';
    let leadAId = '';
    let leadBId = '';
    let webhookKeyId = '';
    let webhookRawSecret = '';

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

    // 2. Setup Client A (Acme Digital Media)
    let clientA = await Client.findOne({ slug: 'acme-digital-media' });
    if (!clientA) {
      clientA = await Client.create({
        name: 'Acme Digital Media',
        slug: 'acme-digital-media',
        status: 'active',
        health: 'healthy',
      });
    }
    clientAId = clientA._id.toString();

    // 3. Setup Client B (Apex Secondary Workspace)
    let clientB = await Client.findOne({ slug: 'acme-apex-test-b' });
    if (!clientB) {
      clientB = await Client.create({
        name: 'Apex Test Client B',
        slug: 'acme-apex-test-b',
        status: 'active',
        health: 'healthy',
      });
    }
    clientBId = clientB._id.toString();

    // Ensure Client Admin exists for Client A
    let clientAdmin = await User.findOne({ email: 'manager@acmedigital.com' });
    if (!clientAdmin) {
      const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      clientAdmin = await User.create({
        name: 'Sarah Jenkins (Acme Admin)',
        email: 'manager@acmedigital.com',
        passwordHash,
        isSuperAdmin: false,
        status: 'active',
        mustChangePassword: true,
      });
      const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
      await ClientMembership.create({
        clientId: clientA._id,
        userId: clientAdmin._id,
        roleId: clientAdminRole!._id,
        status: 'active',
      });
    }

    // 4. Authenticate Client Admin for Client A
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

    // 5. Setup & Authenticate Client Staff for Client A
    const staffRole = await Role.findOne({ slug: 'client_staff' });
    let staffUser = await User.findOne({ email: 'staff@acmedigital.com' });
    if (!staffUser) {
      const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
      staffUser = new User({
        name: 'Staff Member',
        email: 'staff@acmedigital.com',
        passwordHash,
        status: 'active',
        isSuperAdmin: false,
      });
      await staffUser.save();
    }
    await ClientMembership.findOneAndUpdate(
      { userId: staffUser._id, clientId: clientA._id },
      { $set: { roleId: staffRole!._id, status: 'active' } },
      { upsert: true }
    );

    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'staff@acmedigital.com',
          password: env.INITIAL_ADMIN_PASSWORD,
        }),
      });
      const rawCookie = res.headers.get('set-cookie');
      if (rawCookie) clientStaffCookie = rawCookie.split(';')[0];
    }

    // -------------------------------------------------------------
    // TEST 1: Authenticated user can create a lead
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          firstName: 'Jonathan',
          lastName: 'Vance',
          fullName: 'Test Lead Jonathan Vance',
          email: 'jonathan.vance@example.com',
          phone: '+1-555-0199',
          companyName: 'Vance Capital',
          source: 'meta_ads',
          campaignName: 'Summer Retargeting 2026',
          estimatedValue: 4500,
          notes: 'High interest from Meta Ads form submission',
        }),
      });

      const body = await res.json();
      leadAId = body.data?._id;
      assert(
        res.status === 201 && body.success === true && body.data?.fullName === 'Test Lead Jonathan Vance',
        '1. Lead Creation: Authenticated client user can create lead within authorized workspace',
        `Expected 201, got ${res.status}: ${JSON.stringify(body)}`
      );
    }

    // -------------------------------------------------------------
    // TEST 2: Unauthenticated user cannot create a lead (401)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Test Lead Ghost' }),
      });
      assert(res.status === 401, '2. Authentication Required: Unauthenticated request rejected (401)');
    }

    // -------------------------------------------------------------
    // TEST 3: Client user cannot create a lead for another client (403)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientBId, // Foreign client ID
        },
        body: JSON.stringify({
          fullName: 'Test Lead Foreign Injection',
          email: 'injected@example.com',
        }),
      });
      assert(
        res.status === 403,
        '3. Cross-Tenant Isolation: Client user cannot create lead in foreign client workspace (403)',
        `Expected 403, got ${res.status}`
      );
    }

    // Create a lead in Client B by Super Admin for testing isolation
    {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: superAdminCookie,
          'X-Client-Id': clientBId,
        },
        body: JSON.stringify({
          fullName: 'Test Lead Client B Secret',
          email: 'secret.clientb@example.com',
          companyName: 'Client B Enterprise',
        }),
      });
      const body = await res.json();
      leadBId = body.data?._id;
    }

    // -------------------------------------------------------------
    // TEST 4: Client user cannot read a foreign lead (403)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads/${leadBId}`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });
      assert(
        res.status === 403,
        '4. Lead Read Isolation: Client user cannot access foreign lead details (403)',
        `Expected 403, got ${res.status}`
      );
    }

    // -------------------------------------------------------------
    // TEST 5: Client user cannot update a foreign lead (403)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads/${leadBId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ companyName: 'Malicious Overwrite' }),
      });
      assert(
        res.status === 403,
        '5. Lead Mutation Isolation: Client user cannot modify foreign lead record (403)',
        `Expected 403, got ${res.status}`
      );
    }

    // -------------------------------------------------------------
    // TEST 6: Super Admin can inspect leads across clients
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads?limit=50`, {
        headers: { Cookie: superAdminCookie },
      });
      const body = await res.json();
      const allIds = body.data?.leads?.map((l: any) => l._id);
      assert(
        res.status === 200 && allIds?.includes(leadAId) && allIds?.includes(leadBId),
        '6. Super Admin Visibility: Super Admin can view and inspect leads across all client workspaces'
      );
    }

    // -------------------------------------------------------------
    // TEST 7: Invalid stage is rejected (400/422)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          fullName: 'Test Lead Invalid Stage',
          stage: 'super_won_legendary',
        }),
      });
      assert(
        [400, 422].includes(res.status),
        '7. Stage Validation: Unrecognized stage value rejected with validation error (400/422)'
      );
    }

    // -------------------------------------------------------------
    // TEST 8: Invalid source is rejected (400/422)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          fullName: 'Test Lead Invalid Source',
          source: 'telepathy_signal',
        }),
      });
      assert(
        [400, 422].includes(res.status),
        '8. Source Validation: Unrecognized acquisition source rejected with validation error (400/422)'
      );
    }

    // -------------------------------------------------------------
    // TEST 9: Invalid email is rejected (400/422)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          fullName: 'Test Lead Bad Email',
          email: 'not-an-email-at-all',
        }),
      });
      assert(
        [400, 422].includes(res.status),
        '9. Email Validation: Malformed email rejected by Zod schema (400/422)'
      );
    }

    // -------------------------------------------------------------
    // TEST 10: Pagination and filters work correctly
    // -------------------------------------------------------------
    {
      const res = await fetch(
        `${baseUrl}/leads?search=Jonathan&stage=new&source=meta_ads&page=1&limit=5`,
        {
          headers: {
            Cookie: clientAdminCookie,
            'X-Client-Id': clientAId,
          },
        }
      );
      const body = await res.json();
      assert(
        res.status === 200 &&
          body.data?.leads?.length >= 1 &&
          body.data?.pagination?.page === 1 &&
          body.data?.leads[0]?.fullName.includes('Jonathan'),
        '10. Query Engine: Pagination, keyword search, and stage/source filters work accurately'
      );
    }

    // -------------------------------------------------------------
    // TEST 11: Stage changes create activity records with previous/next stages
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads/${leadAId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          stage: 'contacted',
          notes: 'Spoke on phone for 10 minutes',
        }),
      });
      const body = await res.json();

      const activity = await LeadActivity.findOne({
        leadId: leadAId,
        activityType: 'stage_changed',
      }).sort({ createdAt: -1 });

      assert(
        res.status === 200 &&
          body.data?.stage === 'contacted' &&
          activity?.metadata?.get('previousStage') === 'new' &&
          activity?.metadata?.get('nextStage') === 'contacted',
        '11. Stage Progression & Timeline: Stage update persists and logs stage_changed activity record'
      );
    }

    // -------------------------------------------------------------
    // TEST 12: Assignment changes create activity records
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads/${leadAId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ assignedTo: staffUser!._id.toString() }),
      });
      const body = await res.json();

      const activity = await LeadActivity.findOne({
        leadId: leadAId,
        activityType: 'assigned',
      }).sort({ createdAt: -1 });

      assert(
        res.status === 200 &&
          body.data?.assignedTo === staffUser!._id.toString() &&
          activity !== null,
        '12. Lead Assignment: Team assignment persists and generates assigned activity timeline entry'
      );
    }

    // -------------------------------------------------------------
    // TEST 13: Lost stage requires a reason
    // -------------------------------------------------------------
    {
      // A. Without lostReason -> rejected
      const resFail = await fetch(`${baseUrl}/leads/${leadAId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ stage: 'lost' }),
      });

      // B. With lostReason -> succeeds
      const resPass = await fetch(`${baseUrl}/leads/${leadAId}/stage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          stage: 'lost',
          lostReason: 'Budget constraints; competitor chosen',
        }),
      });

      assert(
        [400, 422].includes(resFail.status) && resPass.status === 200,
        '13. Lost Stage Validation: Moving to Lost strictly requires lostReason explanation'
      );
    }

    // -------------------------------------------------------------
    // TEST 14: Client staff cannot manage webhooks (403)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/clients/${clientAId}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientStaffCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ name: 'Staff Unauthorized Webhook' }),
      });
      assert(
        res.status === 403,
        '14. Webhook RBAC: Client Staff is denied permission to create/manage webhooks (403)'
      );
    }

    // -------------------------------------------------------------
    // TEST 15: Webhook credentials are stored hashed with SHA-256
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/clients/${clientAId}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          name: 'Test Webhook Meta Ingestion',
          allowedSources: ['meta_ads', 'webhook'],
        }),
      });
      const body = await res.json();
      webhookKeyId = body.data?.webhook?.keyId;
      webhookRawSecret = body.data?.rawSecret;

      const dbRecord = await ClientWebhook.findOne({ keyId: webhookKeyId }).select('+secretHash');

      assert(
        res.status === 201 &&
          typeof webhookRawSecret === 'string' &&
          webhookRawSecret.startsWith('whsec_') &&
          dbRecord?.secretHash !== webhookRawSecret &&
          dbRecord?.secretHash?.length === 64, // SHA-256 hex string length
        '15. Webhook Secret Hashing: Secret is hashed using SHA-256 before storage in MongoDB'
      );
    }

    // -------------------------------------------------------------
    // TEST 16: Raw webhook secrets are not returned in subsequent queries
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/admin/clients/${clientAId}/webhooks`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });
      const body = await res.json();
      const queried = body.data?.find((w: any) => w.keyId === webhookKeyId);

      assert(
        res.status === 200 &&
          queried &&
          queried.secretHash === undefined &&
          queried.rawSecret === undefined,
        '16. Credential Concealment: Webhook secrets are excluded from subsequent query responses'
      );
    }

    // -------------------------------------------------------------
    // TEST 17: Invalid webhook credentials are rejected (401)
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': webhookKeyId,
          'X-Webhook-Secret': 'whsec_invalid_fake_secret_12345',
        },
        body: JSON.stringify({ fullName: 'Test Lead Webhook Failed' }),
      });
      assert(
        res.status === 401,
        '17. Webhook Security: Invalid secret rejected with 401 Unauthorized'
      );
    }

    // -------------------------------------------------------------
    // TEST 18: Webhook client scope cannot be overridden
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': webhookKeyId,
          'X-Webhook-Secret': webhookRawSecret,
        },
        body: JSON.stringify({
          fullName: 'Test Lead Webhook Ingested',
          email: 'webhook.inbound@example.com',
          phone: '+1-555-8888',
          company: 'Acme Partner',
          source: 'meta_ads',
          clientId: clientBId, // Attempted tenant tampering in body
        }),
      });
      const body = await res.json();
      const createdLead = await Lead.findById(body.data?.leadId);

      assert(
        res.status === 201 &&
          createdLead !== null &&
          createdLead.clientId.toString() === clientAId && // Firmly Client A, ignoring Client B
          createdLead.clientId.toString() !== clientBId,
        '18. Webhook Tenant Bound: Ingested lead strictly assigned to webhook client; payload override ignored'
      );
    }

    // -------------------------------------------------------------
    // TEST 19: Webhook payload validation works
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': webhookKeyId,
          'X-Webhook-Secret': webhookRawSecret,
        },
        body: JSON.stringify({
          fullName: 'Test Webhook Malformed',
          email: 'invalid-email-pattern',
        }),
      });
      assert(
        [400, 422].includes(res.status),
        '19. Webhook Validation: Malformed webhook payload rejected with 400/422'
      );
    }

    // -------------------------------------------------------------
    // TEST 20: Webhook attempts are audited without secrets
    // -------------------------------------------------------------
    {
      const auditEntry = await AuditLog.findOne({
        action: 'webhook.intake_success',
        clientId: clientAId,
      }).sort({ createdAt: -1 });

      const auditStr = JSON.stringify(auditEntry || {});

      assert(
        auditEntry !== null &&
          !auditStr.includes(webhookRawSecret) &&
          !auditStr.includes('whsec_'),
        '20. Audit Trail Confidentiality: Webhook ingest events logged without storing secret tokens'
      );
    }

    // -------------------------------------------------------------
    // TEST 21: Duplicate or replayed webhook requests handled safely
    // -------------------------------------------------------------
    {
      // Send with timestamp 10 minutes ago (expired)
      const staleTimestamp = Date.now() - 10 * 60 * 1000;
      const res = await fetch(`${baseUrl}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': webhookKeyId,
          'X-Webhook-Secret': webhookRawSecret,
          'X-Webhook-Timestamp': staleTimestamp.toString(),
        },
        body: JSON.stringify({ fullName: 'Test Lead Replay Attack' }),
      });
      assert(
        res.status === 400,
        '21. Replay Attack Protection: Webhook request with expired timestamp header rejected (400)'
      );
    }

    // -------------------------------------------------------------
    // TEST 22: Follow-up filters (overdue vs upcoming) work
    // -------------------------------------------------------------
    {
      // Create one overdue and one upcoming lead
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await Lead.create({
        clientId: clientAId,
        fullName: 'Test Lead Overdue',
        nextFollowUpAt: yesterday,
        source: 'manual',
      });
      await Lead.create({
        clientId: clientAId,
        fullName: 'Test Lead Upcoming',
        nextFollowUpAt: tomorrow,
        source: 'manual',
      });

      const resOverdue = await fetch(`${baseUrl}/leads?followUpFilter=overdue`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });
      const bodyOverdue = await resOverdue.json();

      const resUpcoming = await fetch(`${baseUrl}/leads?followUpFilter=upcoming`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });
      const bodyUpcoming = await resUpcoming.json();

      assert(
        resOverdue.status === 200 &&
          resUpcoming.status === 200 &&
          bodyOverdue.data?.leads?.some((l: any) => l.fullName === 'Test Lead Overdue') &&
          bodyUpcoming.data?.leads?.some((l: any) => l.fullName === 'Test Lead Upcoming'),
        '22. Follow-Up Queries: Overdue and upcoming follow-up filters return accurate segmented leads'
      );
    }

    // -------------------------------------------------------------
    // TEST 23: Lead deletion/archive is permission-protected
    // -------------------------------------------------------------
    {
      // Client Staff lacks leads.delete -> 403
      const resStaff = await fetch(`${baseUrl}/leads/${leadAId}`, {
        method: 'DELETE',
        headers: {
          Cookie: clientStaffCookie,
          'X-Client-Id': clientAId,
        },
      });

      // Client Admin has leads.delete -> succeeds
      const resAdmin = await fetch(`${baseUrl}/leads/${leadAId}`, {
        method: 'DELETE',
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });

      const archivedLead = await Lead.findById(leadAId);

      assert(
        resStaff.status === 403 &&
          resAdmin.status === 200 &&
          archivedLead?.isArchived === true,
        '23. Soft Archive & RBAC: Lead deletion is permission-protected and marks lead isArchived: true'
      );
    }

    // -------------------------------------------------------------
    // TEST 24: Lead export is permission-protected and tenant-scoped
    // -------------------------------------------------------------
    {
      // Create a lead with potentially malicious formula to test CSV sanitization
      await Lead.create({
        clientId: clientAId,
        fullName: '=SUM(1+1)',
        companyName: '@COMPUTED_FIELD',
        source: 'manual',
      });

      // Staff lacks leads.export -> 403
      const resStaff = await fetch(`${baseUrl}/leads/export`, {
        headers: {
          Cookie: clientStaffCookie,
          'X-Client-Id': clientAId,
        },
      });

      // Admin has leads.export -> 200 with text/csv
      const resAdmin = await fetch(`${baseUrl}/leads/export`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });
      const csvText = await resAdmin.text();

      assert(
        resStaff.status === 403 &&
          resAdmin.status === 200 &&
          csvText.includes("'=SUM(1+1)") && // Sanitized with prepended single quote!
          csvText.includes("'@COMPUTED_FIELD"),
        '24. CSV Export Defense: Export is RBAC-protected, tenant-scoped, and defends against formula injection'
      );
    }

    // -------------------------------------------------------------
    // TEST 25: Sensitive fields are absent from API responses
    // -------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/leads?limit=10`, {
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });
      const bodyText = await res.text();

      assert(
        !bodyText.includes('passwordHash') &&
          !bodyText.includes('secretHash') &&
          !bodyText.includes('tokenHash'),
        '25. Information Disclosure Prevention: Zero credentials or token hashes leaked in lead responses'
      );
    }
  } catch (error: any) {
    console.error('Unhandled exception during Release 4 test suite execution:', error);
    results.push({ name: 'Unhandled Exception', passed: false, error: error.message });
  } finally {
    server.close();
    await disconnectDatabase();
  }

  console.log('\n==================================================');
  const failed = results.filter((r) => !r.passed);
  if (failed.length === 0) {
    console.log(`ALL ${results.length} RELEASE 4 TESTS PASSED SUCCESSFULLY!`);
    console.log('==================================================\n');
    process.exit(0);
  } else {
    console.error(`${failed.length} OF ${results.length} TESTS FAILED.`);
    console.log('==================================================\n');
    process.exit(1);
  }
};

runLeadManagementTests();
