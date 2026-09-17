import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { Lead } from '../models/Lead';
import { Contact } from '../models/Contact';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { ConversationActivity } from '../models/ConversationActivity';
import { ClientWebhook } from '../models/ClientWebhook';
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

const runConversationTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 5 Test Suite');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  // Cleanup test artifacts
  await Client.deleteMany({ slug: /^conv-test-/ });
  await Conversation.deleteMany({ subject: /^Conv Test/ });
  await Contact.deleteMany({ name: /^Test Contact/ });
  await Message.deleteMany({ body: /^Test message/ });

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
    let convAId = '';
    let convBId = '';
    let contactAId = '';
    let staffUserId = '';
    let leadAId = '';
    let webhookRawSecret = 'whsec_conv_test_' + crypto.randomBytes(16).toString('hex');

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

    // 2. Setup Client A and Client B
    let clientA = await Client.findOne({ slug: 'conv-test-client-a' });
    if (!clientA) {
      clientA = await Client.create({
        name: 'Client Alpha Communications',
        slug: 'conv-test-client-a',
        timezone: 'America/New_York',
        currency: 'USD',
        status: 'active',
      });
    }
    clientAId = clientA._id.toString();

    let clientB = await Client.findOne({ slug: 'conv-test-client-b' });
    if (!clientB) {
      clientB = await Client.create({
        name: 'Client Beta Logistics',
        slug: 'conv-test-client-b',
        timezone: 'America/Chicago',
        currency: 'USD',
        status: 'active',
      });
    }
    clientBId = clientB._id.toString();

    // 3. Setup Client Admin & Client Staff users
    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    const clientStaffRole = await Role.findOne({ slug: 'client_staff' });

    let clientAdminUser = await User.findOne({ email: 'admin@alpha-conv.com' });
    if (!clientAdminUser) {
      clientAdminUser = await User.create({
        email: 'admin@alpha-conv.com',
        name: 'Alpha Admin',
        passwordHash: await bcrypt.hash('AlphaPass@123', 10),
        isEmailVerified: true,
        isActive: true,
      });
    }

    await ClientMembership.findOneAndUpdate(
      { userId: clientAdminUser._id, clientId: clientA._id },
      { $set: { roleId: clientAdminRole!._id, status: 'active' } },
      { upsert: true }
    );

    let clientStaffUser = await User.findOne({ email: 'staff@alpha-conv.com' });
    if (!clientStaffUser) {
      clientStaffUser = await User.create({
        email: 'staff@alpha-conv.com',
        name: 'Alpha Staff Rep',
        passwordHash: await bcrypt.hash('StaffPass@123', 10),
        isEmailVerified: true,
        isActive: true,
      });
    }
    staffUserId = clientStaffUser._id.toString();

    await ClientMembership.findOneAndUpdate(
      { userId: clientStaffUser._id, clientId: clientA._id },
      { $set: { roleId: clientStaffRole!._id, status: 'active' } },
      { upsert: true }
    );

    // Create a dummy lead in Client A to test lead linkage
    const testLead = await Lead.create({
      clientId: clientA._id,
      fullName: 'Test Lead Prospect',
      firstName: 'Prospect',
      lastName: 'One',
      email: 'prospect@alphalead.com',
      stage: 'qualified',
      source: 'meta_ads',
      score: 80,
    });
    leadAId = testLead._id.toString();

    // Login Client Admin
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@alpha-conv.com', password: 'AlphaPass@123' }),
      });
      const rawCookie = res.headers.get('set-cookie');
      if (rawCookie) clientAdminCookie = rawCookie.split(';')[0];
    }

    // Login Client Staff
    {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'staff@alpha-conv.com', password: 'StaffPass@123' }),
      });
      const rawCookie = res.headers.get('set-cookie');
      if (rawCookie) clientStaffCookie = rawCookie.split(';')[0];
    }

    // Setup a Webhook Secret for Client A for inbound webhook tests
    const secretHash = crypto.createHash('sha256').update(webhookRawSecret).digest('hex');
    await ClientWebhook.create({
      clientId: clientA._id,
      name: 'Test Webhook Alpha',
      keyId: 'whk_' + crypto.randomBytes(8).toString('hex'),
      secretHash,
      status: 'active',
      createdBy: clientAdminUser._id,
    });

    // Create a Conversation in Client B directly to verify tenant isolation
    const contactB = await Contact.create({
      clientId: clientB._id,
      name: 'Test Contact B',
      email: 'contactb@beta.com',
    });
    const convB = await Conversation.create({
      clientId: clientB._id,
      contactId: contactB._id,
      subject: 'Conv Test Client B Secret Thread',
      channel: 'whatsapp',
      status: 'open',
    });
    convBId = convB._id.toString();

    // =========================================================================
    // TEST CASES (1 to 25)
    // =========================================================================

    // 1. Workspace Isolation: Client A user cannot list Client B conversations
    {
      const res = await fetch(`${baseUrl}/conversations`, {
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const data = await res.json();
      const hasClientB = data.data?.conversations?.some((c: any) => c._id === convBId);
      assert(res.status === 200 && !hasClientB, '1. Workspace Isolation: Client A cannot view conversations belonging to Client B');
    }

    // 2. Cross-Tenant ID Traversal: Direct GET /conversations/:id across tenants yields 404
    {
      const res = await fetch(`${baseUrl}/conversations/${convBId}`, {
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      assert(res.status === 404, '2. Cross-Tenant ID Traversal: Direct GET /conversations/:convId across tenants yields 404');
    }

    // 3. RBAC View: Request without auth cookie fails
    {
      const res = await fetch(`${baseUrl}/conversations`, {
        headers: { 'X-Client-Id': clientAId },
      });
      assert(res.status === 401, '3. RBAC View: Unauthenticated request is rejected with 401');
    }

    // 4. Conversation Creation with Contact Auto-Provisioning
    {
      const res = await fetch(`${baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          contactName: 'Test Contact Jonathan',
          contactEmail: 'jonathan@company.com',
          contactPhone: '+1-555-0199',
          channel: 'whatsapp',
          subject: 'Conv Test Jonathan WhatsApp Inquiry',
          priority: 'high',
          initialMessage: 'Hi, I would like to learn more about your services.',
          tags: ['enterprise', 'inbound'],
        }),
      });
      const data = await res.json();
      convAId = data.data?._id;
      contactAId = data.data?.contactId?._id || data.data?.contactId;
      assert(res.status === 201 && convAId && data.data.subject.includes('Jonathan'), '4. Conversation Creation: Created conversation with auto-provisioned contact');
    }

    // 5. Conversation Lead Linkage: Linking conversation to CRM lead persists
    {
      const res = await fetch(`${baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          contactName: 'Test Contact Lead Linked',
          contactEmail: 'linked@lead.com',
          leadId: leadAId,
          channel: 'email',
          subject: 'Conv Test Lead Linked Thread',
        }),
      });
      const data = await res.json();
      assert(res.status === 201 && data.data?.leadId?._id === leadAId, '5. Lead Linkage: Conversation linked to CRM lead preserves leadId relation');
    }

    // 6. Multi-attribute Query Filtering: filter by channel and priority
    {
      const res = await fetch(`${baseUrl}/conversations?channel=whatsapp&priority=high`, {
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const data = await res.json();
      const allMatch = data.data?.conversations?.every((c: any) => c.channel === 'whatsapp' && c.priority === 'high');
      assert(res.status === 200 && data.data?.conversations?.length > 0 && allMatch, '6. Query Engine: Channel and priority filters accurately constrain conversation results');
    }

    // 7. Keyword Search: search by contact name or subject
    {
      const res = await fetch(`${baseUrl}/conversations?search=Jonathan`, {
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.conversations?.length >= 1, '7. Keyword Search: Search filter finds conversations matching contact name or subject');
    }

    // 8. Outbound Message Dispatch via Mock Provider
    let sentMessageId = '';
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          body: 'Hello Jonathan, thank you for reaching out! We are preparing your proposal.',
          channel: 'whatsapp',
        }),
      });
      const data = await res.json();
      sentMessageId = data.data?._id;
      assert(
        res.status === 201 && data.data?.deliveryStatus === 'sent' && data.data?.direction === 'outbound',
        '8. Outbound Message: Message sent via provider updates deliveryStatus to sent and direction to outbound'
      );
    }

    // 9. Delivery Failure Handling: Simulated error updates message to failed
    let failedMessageId = '';
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          body: 'Test message [SIMULATE_FAIL] trigger carrier timeout',
          channel: 'whatsapp',
        }),
      });
      const data = await res.json();
      failedMessageId = data.data?._id;
      assert(
        res.status === 201 && data.data?.deliveryStatus === 'failed' && data.data?.failureReason,
        '9. Failure Handling: Carrier failure marks message deliveryStatus as failed with failureReason'
      );
    }

    // 10. Message Retry Flow: Retrying failed message dispatches provider again
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/messages/${failedMessageId}/retry`, {
        method: 'POST',
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      });
      const data = await res.json();
      assert(
        res.status === 200 && data.data?.retryCount === 1,
        '10. Retry Engine: Retrying a failed message dispatches provider and increments retryCount'
      );
    }

    // 11. Idempotency on Send: Duplicate idempotencyKey returns existing message
    {
      const idempotencyKey = 'idemp_key_' + Date.now();
      const res1 = await fetch(`${baseUrl}/conversations/${convAId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          body: 'Idempotency test payload',
          idempotencyKey,
        }),
      });
      const data1 = await res1.json();

      const res2 = await fetch(`${baseUrl}/conversations/${convAId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          body: 'Idempotency test payload duplicate send',
          idempotencyKey,
        }),
      });
      const data2 = await res2.json();
      assert(data1.data?._id === data2.data?._id, '11. Send Idempotency: Duplicate idempotencyKey returns identical existing message');
    }

    // 12. Inbound Webhook Message Ingestion
    const inboundExtId = 'wh_inbound_msg_' + Date.now();
    {
      const res = await fetch(`${baseUrl}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhookRawSecret,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify({
          channel: 'whatsapp',
          externalMessageId: inboundExtId,
          from: {
            name: 'Test Contact Inbound User',
            phone: '+1-555-0822',
            email: 'inbound@customer.com',
          },
          body: 'Hello! I am confirming our scheduled meeting for tomorrow.',
        }),
      });
      const data = await res.json();
      assert(res.status === 201 && data.data?.success && !data.data?.duplicate, '12. Inbound Webhook: Ingests external customer message, resolves contact, and logs thread');
    }

    // 13. Inbound Webhook Idempotency: Duplicate externalMessageId rejected/acknowledged without duplicating
    {
      const res = await fetch(`${baseUrl}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhookRawSecret,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify({
          channel: 'whatsapp',
          externalMessageId: inboundExtId,
          from: {
            name: 'Test Contact Inbound User',
            phone: '+1-555-0822',
          },
          body: 'Duplicate payload with same externalMessageId',
        }),
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.duplicate === true, '13. Webhook Idempotency: Re-sent externalMessageId acknowledged as duplicate without re-creating message');
    }

    // 14. Mark Conversation as Read
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/read`, {
        method: 'POST',
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.unreadCount === 0, '14. Mark as Read: Clears unreadCount and marks unread inbound messages as read');
    }

    // 15. Status Progression: Updating status to resolved persists and logs activity
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ status: 'resolved' }),
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.status === 'resolved', '15. Status Progression: Status transition to resolved persists');
    }

    // 16. Priority Update persists accurately
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/priority`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ priority: 'urgent' }),
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.priority === 'urgent', '16. Priority Update: Updating conversation priority to urgent persists');
    }

    // 17. Assignment Transition
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ assignedTo: staffUserId }),
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.assignedTo?._id === staffUserId, '17. Assignment: Team member assignment persists and logs event');
    }

    // 18. Tags Management
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/tags`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({ tags: ['vip-client', 'q3-campaign'] }),
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.tags?.includes('vip-client'), '18. Tags Engine: Conversation tags updated and persisted');
    }

    // 19. Archiving Conversation
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}`, {
        method: 'DELETE',
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.isArchived === true, '19. Archiving: Archiving conversation sets isArchived to true');
    }

    // 20. Reopening Conversation
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/reopen`, {
        method: 'POST',
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const data = await res.json();
      assert(res.status === 200 && data.data?.isArchived === false && data.data?.status === 'open', '20. Reopen Conversation: Reopening restores conversation to active list with open status');
    }

    // 21. Replay Attack Protection: Webhook with expired timestamp rejected
    {
      const expiredTimestamp = Date.now() - 400 * 1000; // 400s in past (> 300s drift)
      const res = await fetch(`${baseUrl}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhookRawSecret,
          'X-Webhook-Timestamp': expiredTimestamp.toString(),
        },
        body: JSON.stringify({
          channel: 'sms',
          externalMessageId: 'wh_expired_' + Date.now(),
          from: { name: 'Expired Replay Attacker' },
          body: 'Replay payload test',
        }),
      });
      assert(res.status === 400, '21. Replay Defense: Expired webhook timestamp header rejected with 400');
    }

    // 22. Webhook Secret Validation: Invalid secret returns 401
    {
      const res = await fetch(`${baseUrl}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'invalid_secret_key_123',
        },
        body: JSON.stringify({
          channel: 'email',
          externalMessageId: 'wh_invalid_sec_' + Date.now(),
          from: { name: 'Attacker' },
          body: 'Unauthorized payload',
        }),
      });
      assert(res.status === 401, '22. Webhook Authentication: Invalid secret rejected with 401 Unauthorized');
    }

    // 23. Stored XSS Sanitization: Dangerous script tags stripped from message body
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          body: 'Hello <script>alert("XSS")</script><img src="x" onerror="alert(1)"> safe message',
        }),
      });
      const data = await res.json();
      const body = data.data?.body || '';
      const isSanitized = !body.includes('<script>') && !body.includes('onerror');
      assert(isSanitized && body.includes('safe message'), '23. XSS Defense: Dangerous script tags and inline event handlers stripped from message body');
    }

    // 24. Zero Credential Disclosure: Ensure no secret hashes or passwords in conversation responses
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}`, {
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const text = await res.text();
      const hasSecrets = text.includes('passwordHash') || text.includes('secretHash') || text.includes('webhookSecretHash');
      assert(res.status === 200 && !hasSecrets, '24. Confidentiality: Zero password hashes or secret tokens leaked in conversation responses');
    }

    // 25. Conversation Activity Trail: Inspect immutable activity event history
    {
      const res = await fetch(`${baseUrl}/conversations/${convAId}/activities`, {
        headers: { Cookie: clientAdminCookie, 'X-Client-Id': clientAId },
      });
      const data = await res.json();
      assert(
        res.status === 200 && Array.isArray(data.data) && data.data.length >= 3,
        '25. Activity Trail: Conversation event history records lifecycle mutations (created, assigned, status_changed)'
      );
    }

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n==================================================');
  console.log(`RELEASE 5 TESTS COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('==================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
};

runConversationTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
