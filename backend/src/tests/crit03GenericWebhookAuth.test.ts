import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_qa_crit03_generic';

import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { Client } from '../models/Client';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { ClientMembership } from '../models/ClientMembership';
import { ClientWebhook } from '../models/ClientWebhook';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Contact } from '../models/Contact';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Lead } from '../models/Lead';
import { Workflow } from '../models/Workflow';
import { WorkflowRun } from '../models/WorkflowRun';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import { hashWebhookSecret, verifyWebhookSecretHash } from '../utils/crypto';

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

const runGenericWebhookAuthTests = async () => {
  console.log('\n================================================================');
  console.log('CRIT-03 Issue 4: Generic Webhook Auth & Secret Hash Security QA');
  console.log('================================================================\n');

  const dbUri = process.env.MONGODB_URI || '';
  if (!dbUri.includes('flumenx_qa_')) {
    throw new Error(`Refusing to run against non-isolated database URI: ${dbUri}`);
  }

  await connectDatabase();
  if (mongoose.connection.name !== 'flumenx_qa_crit03_generic') {
    throw new Error(`Refusing to run on non-isolated database: ${mongoose.connection.name}`);
  }
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
  await seedDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const apiBase = `http://127.0.0.1:${port}/api/v1`;

  const savedNodeEnv = process.env.NODE_ENV;

  try {
    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    if (!clientAdminRole) {
      throw new Error('client_admin role missing after seed');
    }

    const clientA = await Client.create({
      name: 'Generic Webhook QA Alpha',
      slug: 'generic-wh-qa-alpha',
      status: 'active',
    });
    const clientB = await Client.create({
      name: 'Generic Webhook QA Beta',
      slug: 'generic-wh-qa-beta',
      status: 'active',
    });
    const clientAId = clientA._id.toString();
    const clientBId = clientB._id.toString();

    const adminA = await User.create({
      email: 'alpha-wh@qa.test',
      name: 'Alpha WH Admin',
      passwordHash: await bcrypt.hash('AlphaWhPass@123', 10),
      isEmailVerified: true,
      isActive: true,
    });
    const adminB = await User.create({
      email: 'beta-wh@qa.test',
      name: 'Beta WH Admin',
      passwordHash: await bcrypt.hash('BetaWhPass@123', 10),
      isEmailVerified: true,
      isActive: true,
    });

    await ClientMembership.create({
      userId: adminA._id,
      clientId: clientA._id,
      roleId: clientAdminRole._id,
      status: 'active',
    });
    await ClientMembership.create({
      userId: adminB._id,
      clientId: clientB._id,
      roleId: clientAdminRole._id,
      status: 'active',
    });

    const loginCookie = async (email: string, password: string): Promise<string> => {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const cookie = res.headers.get('set-cookie');
      if (!res.ok || !cookie) {
        throw new Error(`Login failed for ${email}: HTTP ${res.status}`);
      }
      return cookie.split(';')[0];
    };

    const cookieA = await loginCookie('alpha-wh@qa.test', 'AlphaWhPass@123');
    const cookieB = await loginCookie('beta-wh@qa.test', 'BetaWhPass@123');

    // Provision ClientWebhook credentials for Workspace A and Workspace B
    const createClientWebhook = async (cookie: string, clientId: string, name: string) => {
      const res = await fetch(`${apiBase}/admin/clients/${clientId}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
          'X-Client-Id': clientId,
        },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (res.status !== 201 || !data.data?.rawSecret || !data.data?.webhook?.keyId) {
        throw new Error(`Failed creating ClientWebhook: ${res.status} ${JSON.stringify(data)}`);
      }
      return {
        id: data.data.webhook._id as string,
        keyId: data.data.webhook.keyId as string,
        rawSecret: data.data.rawSecret as string,
      };
    };

    const whA = await createClientWebhook(cookieA, clientAId, 'Alpha ClientWebhook');
    const whB = await createClientWebhook(cookieB, clientBId, 'Beta ClientWebhook');

    // Provision CommunicationProvider (custom_webhook) for Workspace A via API
    const customSecretA_v1 = `whsec_custom_prov_alpha_${crypto.randomBytes(12).toString('hex')}`;
    const customSecretA_v2 = `whsec_custom_prov_alpha_v2_${crypto.randomBytes(12).toString('hex')}`;
    const customSecretB = `whsec_custom_prov_beta_${crypto.randomBytes(12).toString('hex')}`;

    {
      const resSave = await fetch(`${apiBase}/conversations/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          providerType: 'custom_webhook',
          displayName: 'Alpha Custom Webhook Provider',
          configuration: {
            webhookSecret: customSecretA_v1,
            endpointLabel: 'external-bot',
          },
          status: 'active',
        }),
      });
      const saveJson = await resSave.json();
      const responseText = JSON.stringify(saveJson);
      const dbProv = await CommunicationProvider.findOne({
        clientId: clientA._id,
        providerType: 'custom_webhook',
      }).select('+webhookSecretHash');

      assert(
        resSave.status === 201 &&
          dbProv !== null &&
          typeof dbProv.webhookSecretHash === 'string' &&
          dbProv.webhookSecretHash === hashWebhookSecret(customSecretA_v1) &&
          dbProv.webhookSecretHash.length === 64 &&
          dbProv.configuration?.webhookSecret === undefined &&
          !responseText.includes(customSecretA_v1) &&
          !responseText.includes('webhookSecretHash'),
        '11. CommunicationProvider.webhookSecretHash stores one-way SHA-256 hash without plaintext or response leakage',
        `status=${resSave.status}, hasHash=${Boolean(dbProv?.webhookSecretHash)}, cfgSecret=${String(
          dbProv?.configuration?.webhookSecret
        )}`
      );

      assert(
        verifyWebhookSecretHash(customSecretA_v1, dbProv?.webhookSecretHash) &&
          !verifyWebhookSecretHash('wrong-secret', dbProv?.webhookSecretHash),
        '12. Stored webhookSecretHash verifies exact secret and rejects incorrect secrets in constant time'
      );
    }

    // Create Workspace B custom_webhook provider too
    await fetch(`${apiBase}/conversations/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
        'X-Client-Id': clientBId,
      },
      body: JSON.stringify({
        providerType: 'custom_webhook',
        displayName: 'Beta Custom Webhook Provider',
        configuration: { webhookSecret: customSecretB },
        status: 'active',
      }),
    });

    // Active workflow triggered on conversation.received in Workspace A
    const wfAlpha = await Workflow.create({
      clientId: clientA._id,
      name: 'QA Generic Webhook Workflow Alpha',
      status: 'active',
      trigger: { eventType: 'conversation.received' },
      conditions: [],
      actions: [
        {
          id: 'act_generic_note',
          type: 'create_notification',
          payload: {
            title: 'Generic webhook inbound message',
            message: 'Triggered from authenticated generic webhook',
          },
          order: 0,
        },
      ],
      executionMode: 'immediate',
      maxExecutionsPerHour: 100,
    });

    const samplePayload = (extId: string, bodyText: string, extra: Record<string, any> = {}) => ({
      channel: 'whatsapp',
      externalMessageId: extId,
      from: {
        name: 'Webhook Customer',
        phone: '+15551112222',
        email: 'customer@generic-qa.test',
      },
      body: bodyText,
      ...extra,
    });

    const snapshotCounts = async () => ({
      messages: await Message.countDocuments({}),
      contacts: await Contact.countDocuments({}),
      conversations: await Conversation.countDocuments({}),
      leads: await Lead.countDocuments({}),
      workflowRuns: await WorkflowRun.countDocuments({}),
    });

    // =========================================================================
    // INVALID / ATTACK / BOUNDARY TESTS FIRST (verify zero side effects!)
    // =========================================================================
    const baselineBeforeAttacks = await snapshotCounts();

    // 3. Missing webhook secret rejected
    {
      const resConv = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(samplePayload('gen_missing_secret_1', 'No secret')),
      });
      const resLeads = await fetch(`${apiBase}/client/webhooks/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'No Secret Lead', email: 'nosec@qa.test' }),
      });
      assert(
        resConv.status === 401 && resLeads.status === 401,
        '3. Missing webhook secret is rejected with 401 across generic webhook endpoints',
        `conv=${resConv.status}, leads=${resLeads.status}`
      );
    }

    // 2. Invalid webhook secret rejected
    {
      const resConv = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': 'whsec_completely_wrong_secret',
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload('gen_invalid_secret_1', 'Bad secret')),
      });
      const resLeads = await fetch(`${apiBase}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': whA.keyId,
          'X-Webhook-Secret': 'whsec_wrong_lead_secret',
        },
        body: JSON.stringify({ fullName: 'Bad Secret Lead', email: 'badsec@qa.test' }),
      });
      assert(
        resConv.status === 401 && resLeads.status === 401,
        '2. Invalid webhook secret is rejected with 401',
        `conv=${resConv.status}, leads=${resLeads.status}`
      );
    }

    // 4 & 13. ?clientId= cannot bypass authentication or cross workspaces
    {
      const resBypassDummy = await fetch(
        `${apiBase}/client/webhooks/conversations?clientId=${clientAId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': 'arbitrary_attacker_string',
            'X-Webhook-Timestamp': Date.now().toString(),
          },
          body: JSON.stringify(samplePayload('gen_bypass_dummy', 'Attacker clientId bypass')),
        }
      );

      const resCrossTenant = await fetch(
        `${apiBase}/client/webhooks/conversations?clientId=${clientAId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': whB.rawSecret, // Valid secret belonging to Workspace B, NOT A!
            'X-Webhook-Timestamp': Date.now().toString(),
          },
          body: JSON.stringify(samplePayload('gen_cross_tenant_override', 'Cross tenant attempt')),
        }
      );

      const resBypassCustomProv = await fetch(
        `${apiBase}/conversations/webhook?clientId=${clientAId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': customSecretB, // Custom provider secret of B, NOT A!
          },
          body: JSON.stringify(samplePayload('gen_cross_custom_prov', 'Cross tenant custom provider')),
        }
      );

      assert(
        resBypassDummy.status === 401 &&
          resCrossTenant.status === 403 &&
          resBypassCustomProv.status === 403,
        '4/13. ?clientId= cannot bypass authentication (401) and another workspace secret cannot authenticate target workspace (403)',
        `dummy=${resBypassDummy.status}, crossClientWh=${resCrossTenant.status}, crossProv=${resBypassCustomProv.status}`
      );
    }

    // 5. Mock secret (x-mock-secret) rejected in production
    {
      process.env.NODE_ENV = 'production';
      const resProdMockEvenValidSecret = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-secret': whA.rawSecret,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload('gen_prod_mock_1', 'Mock header in prod')),
      });
      const resProdMockWithClientId = await fetch(
        `${apiBase}/client/webhooks/conversations?clientId=${clientAId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mock-secret': 'fake_mock',
          },
          body: JSON.stringify(samplePayload('gen_prod_mock_2', 'Mock header + clientId in prod')),
        }
      );
      process.env.NODE_ENV = 'development';
      const resDevMock = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-secret': whA.rawSecret,
        },
        body: JSON.stringify(samplePayload('gen_dev_mock_1', 'Mock header in dev')),
      });
      assert(
        resProdMockEvenValidSecret.status === 401 &&
          resProdMockWithClientId.status === 401 &&
          resDevMock.status === 401,
        '5. x-mock-secret is rejected with 401 in production (and development)',
        `prodValid=${resProdMockEvenValidSecret.status}, prodBypass=${resProdMockWithClientId.status}, dev=${resDevMock.status}`
      );
    }

    // 7, 8, 9. Missing timestamp where required, malformed/empty/zero, expired, and future-dated timestamps rejected
    {
      // 7a. Portal malware-scan protocol strictly requires timestamp
      const resScannerMissingTs = await fetch(`${apiBase}/portal/webhooks/malware-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-scanner-signature': 'deadbeef',
        },
        body: JSON.stringify({ fileKey: 'test.pdf', verdict: 'clean' }),
      });

      // 7b. Empty / zero / malformed timestamps on generic conversation & leads webhooks cannot silently bypass
      const resEmptyTs = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': '',
        },
        body: JSON.stringify(samplePayload('gen_empty_ts', 'Empty header timestamp')),
      });

      const resZeroBodyTs = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': whA.rawSecret,
        },
        body: JSON.stringify(samplePayload('gen_zero_ts', 'Zero payload timestamp', { timestamp: 0 })),
      });

      const resMalformedLeadTs = await fetch(`${apiBase}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': whA.keyId,
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': '   ',
        },
        body: JSON.stringify({ fullName: 'Blank TS Lead', email: 'blankts@qa.test' }),
      });

      assert(
        resScannerMissingTs.status === 401 &&
          resEmptyTs.status === 400 &&
          resZeroBodyTs.status === 400 &&
          resMalformedLeadTs.status === 400,
        '7. Missing timestamp rejected where required (401 on scanner gate) and empty/zero/blank timestamps rejected (400)',
        `scanner=${resScannerMissingTs.status}, empty=${resEmptyTs.status}, zero=${resZeroBodyTs.status}, leadBlank=${resMalformedLeadTs.status}`
      );

      // 8. Expired timestamp rejected (> 300s ago)
      const expiredMs = (Date.now() - 400 * 1000).toString();
      const resExpiredConv = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': expiredMs,
        },
        body: JSON.stringify(samplePayload('gen_expired_ts', 'Expired ts')),
      });
      const resExpiredLead = await fetch(`${apiBase}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': whA.keyId,
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': expiredMs,
        },
        body: JSON.stringify({ fullName: 'Expired Lead', email: 'expired@qa.test' }),
      });
      assert(
        resExpiredConv.status === 400 && resExpiredLead.status === 400,
        '8. Expired webhook timestamp is rejected with 400 across generic endpoints',
        `conv=${resExpiredConv.status}, leads=${resExpiredLead.status}`
      );

      // 9. Future-dated timestamp rejected (> 300s ahead)
      const futureMs = (Date.now() + 400 * 1000).toString();
      const resFutureConvHeader = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': futureMs,
        },
        body: JSON.stringify(samplePayload('gen_future_hdr', 'Future header ts')),
      });
      const resFutureConvBody = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': customSecretA_v1,
        },
        body: JSON.stringify(
          samplePayload('gen_future_body', 'Future body ts', { timestamp: Number(futureMs) })
        ),
      });
      const resFutureLead = await fetch(`${apiBase}/client/webhooks/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Key': whA.keyId,
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': futureMs,
        },
        body: JSON.stringify({ fullName: 'Future Lead', email: 'future@qa.test' }),
      });
      assert(
        resFutureConvHeader.status === 400 &&
          resFutureConvBody.status === 400 &&
          resFutureLead.status === 400,
        '9. Excessively future-dated webhook timestamp is rejected with 400',
        `hdr=${resFutureConvHeader.status}, body=${resFutureConvBody.status}, leads=${resFutureLead.status}`
      );
    }

    // 16 & 17. Invalid requests created ZERO unintended DB records and triggered ZERO workflows
    {
      const afterInvalid = await snapshotCounts();
      const whDocAfter = await ClientWebhook.findById(whA.id);
      assert(
        afterInvalid.messages === baselineBeforeAttacks.messages &&
          afterInvalid.contacts === baselineBeforeAttacks.contacts &&
          afterInvalid.conversations === baselineBeforeAttacks.conversations &&
          afterInvalid.leads === baselineBeforeAttacks.leads &&
          !whDocAfter?.lastUsedAt,
        '16. Invalid/forged generic webhook requests created zero messages, contacts, conversations, leads, or lastUsedAt updates',
        JSON.stringify({ baselineBeforeAttacks, afterInvalid, lastUsedAt: whDocAfter?.lastUsedAt })
      );
      assert(
        afterInvalid.workflowRuns === baselineBeforeAttacks.workflowRuns,
        '17. Invalid/forged generic webhook requests triggered zero workflows',
        `delta=${afterInvalid.workflowRuns - baselineBeforeAttacks.workflowRuns}`
      );
    }

    // =========================================================================
    // VALID AUTHENTICATED WORKFLOWS, ROTATION, TEST-ENV MOCK, AND REPLAYS
    // =========================================================================

    // 1 + 14 + 15. Valid ClientWebhook secret processes message, reaches Inbox, triggers workflow
    const sharedExtId = 'gen_valid_ext_id_001';
    {
      const resValid = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': Math.floor(Date.now() / 1000).toString(), // Also verifies epoch seconds!
        },
        body: JSON.stringify(
          samplePayload(sharedExtId, 'Valid ClientWebhook message content', {
            attachments: [
              {
                name: 'quote.pdf',
                url: 'https://cdn.example.com/quote.pdf',
                size: 2048,
                mimeType: 'application/pdf',
              },
            ],
          })
        ),
      });
      const jsonValid = await resValid.json();

      // Verify Inbox API visibility in Workspace A ONLY
      const inboxA = await fetch(`${apiBase}/conversations`, {
        headers: { Cookie: cookieA, 'X-Client-Id': clientAId },
      });
      const inboxAJson = await inboxA.json();
      const hasConvA = (inboxAJson.data?.conversations || []).some(
        (c: any) => c._id === jsonValid.data?.conversationId
      );

      const inboxB = await fetch(`${apiBase}/conversations`, {
        headers: { Cookie: cookieB, 'X-Client-Id': clientBId },
      });
      const inboxBJson = await inboxB.json();
      const leakedToB = (inboxBJson.data?.conversations || []).some(
        (c: any) => c._id === jsonValid.data?.conversationId
      );

      const wfRuns = await WorkflowRun.countDocuments({
        clientId: clientA._id,
        workflowId: wfAlpha._id,
        eventType: 'conversation.received',
        status: 'completed',
      });

      assert(
        resValid.status === 201 &&
          jsonValid.data?.success === true &&
          jsonValid.data?.duplicate === false &&
          hasConvA &&
          !leakedToB,
        '1a/14. Valid ClientWebhook secret ingests event, resolves Workspace A from credential, and isolates from Workspace B Inbox',
        `status=${resValid.status}, hasConvA=${hasConvA}, leakedToB=${leakedToB}`
      );
      assert(
        wfRuns === 1,
        '15. Valid generic webhook event still triggers existing conversation.received workflow',
        `wfRuns=${wfRuns}`
      );
    }

    // 1b. Valid CommunicationProvider (custom_webhook) secret + secret rotation + non-secret update preservation
    {
      const resProv1 = await fetch(`${apiBase}/conversations/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': customSecretA_v1,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload('gen_custom_prov_msg_1', 'Via custom_webhook provider v1')),
      });
      const jsonProv1 = await resProv1.json();

      // Rotate webhookSecret via saveCommunicationProvider
      await fetch(`${apiBase}/conversations/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          providerType: 'custom_webhook',
          displayName: 'Alpha Custom Webhook Provider Rotated',
          configuration: {
            webhookSecret: customSecretA_v2,
            endpointLabel: 'external-bot-v2',
          },
          status: 'active',
        }),
      });

      // Update unrelated field WITHOUT resending webhookSecret (hash must remain preserved!)
      await fetch(`${apiBase}/conversations/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
          'X-Client-Id': clientAId,
        },
        body: JSON.stringify({
          providerType: 'custom_webhook',
          displayName: 'Alpha Custom Webhook Renamed',
          configuration: {
            endpointLabel: 'external-bot-v2',
          },
          status: 'active',
        }),
      });

      const resOldAfterRotate = await fetch(`${apiBase}/conversations/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': customSecretA_v1,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload('gen_custom_prov_old', 'Old secret should fail')),
      });

      const resNewAfterRotate = await fetch(`${apiBase}/conversations/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': customSecretA_v2,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload('gen_custom_prov_msg_2', 'Rotated secret succeeds')),
      });

      assert(
        resProv1.status === 201 &&
          resOldAfterRotate.status === 401 &&
          resNewAfterRotate.status === 201 &&
          jsonProv1.data?.messageId,
        '1b/11b/12b. CommunicationProvider custom_webhook authenticates via webhookSecretHash, supports rotation, and preserves hash on metadata updates',
        `v1=${resProv1.status}, oldAfter=${resOldAfterRotate.status}, newAfter=${resNewAfterRotate.status}`
      );
    }

    // 6. Mock authentication (x-mock-secret) works ONLY in explicitly isolated test environment (NODE_ENV=test)
    {
      process.env.NODE_ENV = 'test';
      const resTestMockValid = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-secret': whA.rawSecret,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload('gen_test_mock_valid', 'Valid secret in NODE_ENV=test')),
      });
      // Still cannot bypass ?clientId= or invalid secret even in NODE_ENV=test!
      const resTestMockBypass = await fetch(
        `${apiBase}/client/webhooks/conversations?clientId=${clientBId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mock-secret': 'wrong_mock_secret',
          },
          body: JSON.stringify(samplePayload('gen_test_mock_bypass', 'Cannot bypass in test mode')),
        }
      );
      process.env.NODE_ENV = savedNodeEnv;
      assert(
        resTestMockValid.status === 201 && resTestMockBypass.status === 401,
        '6. x-mock-secret works only in isolated NODE_ENV=test while still enforcing DB secret verification',
        `valid=${resTestMockValid.status}, bypass=${resTestMockBypass.status}`
      );
    }

    // 10. Replay / idempotency handling within valid window & cross-workspace independence
    {
      const wfBeforeReplay = await WorkflowRun.countDocuments({
        clientId: clientA._id,
        workflowId: wfAlpha._id,
      });

      // Retry exact same externalMessageId in Workspace A
      const resReplayA = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': whA.rawSecret,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload(sharedExtId, 'Retried delivery of sharedExtId')),
      });
      const jsonReplayA = await resReplayA.json();

      // Same externalMessageId in Workspace B using Workspace B secret -> processed independently!
      const resSameExtInB = await fetch(`${apiBase}/client/webhooks/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': whB.rawSecret,
          'X-Webhook-Timestamp': Date.now().toString(),
        },
        body: JSON.stringify(samplePayload(sharedExtId, 'Workspace B message with same externalMessageId')),
      });
      const jsonSameExtInB = await resSameExtInB.json();

      const wfAfterReplay = await WorkflowRun.countDocuments({
        clientId: clientA._id,
        workflowId: wfAlpha._id,
      });

      assert(
        resReplayA.status === 200 &&
          jsonReplayA.data?.duplicate === true &&
          wfAfterReplay === wfBeforeReplay &&
          resSameExtInB.status === 201 &&
          jsonSameExtInB.data?.duplicate === false,
        '10. Replayed generic webhooks honor tenant-scoped externalMessageId idempotency cleanly',
        `replayA=${resReplayA.status}/${jsonReplayA.data?.duplicate}, sameInB=${resSameExtInB.status}/${jsonSameExtInB.data?.duplicate}`
      );
    }

    // 11-16. T12: Cross-collection and multi-record webhook secret ambiguity & regression checks
    {
      const takeT12Snapshot = async () => ({
        contacts: await Contact.countDocuments(),
        conversations: await Conversation.countDocuments(),
        messages: await Message.countDocuments(),
        workflowRuns: await WorkflowRun.countDocuments(),
      });
      const snapshotsEqual = (
        a: Awaited<ReturnType<typeof takeT12Snapshot>>,
        b: Awaited<ReturnType<typeof takeT12Snapshot>>
      ) =>
        a.contacts === b.contacts &&
        a.conversations === b.conversations &&
        a.messages === b.messages &&
        a.workflowRuns === b.workflowRuns;
      const postGenericWebhook = (secret: string, extId: string, bodyText: string) =>
        fetch(`${apiBase}/client/webhooks/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': secret,
            'X-Webhook-Timestamp': Date.now().toString(),
          },
          body: JSON.stringify(samplePayload(extId, bodyText)),
        });

      const createdWebhookIds: any[] = [];
      const createdProviderIds: any[] = [];

      try {
        // T12-A: Active ClientWebhook (Workspace A) + active CommunicationProvider (Workspace B) sharing identical secret hash
        const crossSecret = `whsec_t12_cross_${Date.now()}`;
        const crossHash = hashWebhookSecret(crossSecret);
        const crossWhA = await ClientWebhook.create({
          clientId: clientA._id,
          name: 'T12 Cross Collision Webhook A',
          keyId: `wh_t12_cross_a_${Date.now()}`,
          secretHash: crossHash,
          status: 'active',
          createdBy: adminA._id,
        });
        createdWebhookIds.push(crossWhA._id);

        const crossProvB = await CommunicationProvider.create({
          clientId: clientB._id,
          providerType: 'custom_webhook',
          displayName: 'T12 Cross Collision Provider B',
          status: 'active',
          webhookSecretHash: crossHash,
          createdBy: adminA._id,
        });
        createdProviderIds.push(crossProvB._id);

        const beforeT12A = await takeT12Snapshot();
        const provUpdatedBefore = crossProvB.updatedAt?.getTime() ?? null;
        const resT12A = await postGenericWebhook(
          crossSecret,
          `t12-a-cross-${Date.now()}`,
          'Should reject ambiguous cross-collection secret'
        );
        await new Promise((r) => setTimeout(r, 50));
        const afterT12A = await takeT12Snapshot();
        const crossWhAAfter = await ClientWebhook.findById(crossWhA._id);
        const crossProvBAfter = await CommunicationProvider.findById(crossProvB._id);

        assert(
          resT12A.status === 401 &&
            snapshotsEqual(beforeT12A, afterT12A) &&
            !crossWhAAfter?.lastUsedAt &&
            (crossProvBAfter?.updatedAt?.getTime() ?? null) === provUpdatedBefore,
          '11. T12-A: Cross-collection active webhook secret collision rejects with 401 and zero side effects',
          `status=${resT12A.status}, countsBefore=${JSON.stringify(beforeT12A)}, countsAfter=${JSON.stringify(afterT12A)}, lastUsedAt=${crossWhAAfter?.lastUsedAt}`
        );

        // T12-B: Single active ClientWebhook credential continues to work
        const whBBefore = await ClientWebhook.findById(whB.id);
        const resT12B = await postGenericWebhook(
          whB.rawSecret,
          `t12-b-single-wh-${Date.now()}`,
          'Single active ClientWebhook regression check'
        );
        const jsonT12B = (await resT12B.json()) as { success?: boolean };
        const whBAfter = await ClientWebhook.findById(whB.id);
        assert(
          resT12B.status === 201 &&
            jsonT12B.success === true &&
            Boolean(whBAfter?.lastUsedAt) &&
            (whBAfter?.lastUsedAt?.getTime() ?? 0) >= (whBBefore?.lastUsedAt?.getTime() ?? 0),
          '12. T12-B: Single active ClientWebhook authenticates cleanly and persists message',
          `status=${resT12B.status}, success=${jsonT12B.success}`
        );

        // T12-C: Single active CommunicationProvider credential continues to work
        const resT12C = await postGenericWebhook(
          customSecretB,
          `t12-c-single-prov-${Date.now()}`,
          'Single active CommunicationProvider regression check'
        );
        const jsonT12C = (await resT12C.json()) as { success?: boolean };
        assert(
          resT12C.status === 201 && jsonT12C.success === true,
          '13. T12-C: Single active CommunicationProvider authenticates cleanly and persists message',
          `status=${resT12C.status}, success=${jsonT12C.success}`
        );

        // T12-D: Two active ClientWebhook records sharing same secretHash -> 401 with zero side effects
        const dupWhSecret = `whsec_t12_dup_wh_${Date.now()}`;
        const dupWhHash = hashWebhookSecret(dupWhSecret);
        const dupWh1 = await ClientWebhook.create({
          clientId: clientA._id,
          name: 'T12 Duplicate Active Webhook 1',
          keyId: `wh_t12_dup_1_${Date.now()}`,
          secretHash: dupWhHash,
          status: 'active',
          createdBy: adminA._id,
        });
        createdWebhookIds.push(dupWh1._id);

        const dupWh2 = await ClientWebhook.create({
          clientId: clientB._id,
          name: 'T12 Duplicate Active Webhook 2',
          keyId: `wh_t12_dup_2_${Date.now()}`,
          secretHash: dupWhHash,
          status: 'active',
          createdBy: adminA._id,
        });
        createdWebhookIds.push(dupWh2._id);

        const beforeT12D = await takeT12Snapshot();
        const resT12D = await postGenericWebhook(
          dupWhSecret,
          `t12-d-dup-wh-${Date.now()}`,
          'Should reject duplicate active ClientWebhook secrets'
        );
        await new Promise((r) => setTimeout(r, 50));
        const afterT12D = await takeT12Snapshot();
        const dupWh1After = await ClientWebhook.findById(dupWh1._id);
        const dupWh2After = await ClientWebhook.findById(dupWh2._id);

        assert(
          resT12D.status === 401 &&
            snapshotsEqual(beforeT12D, afterT12D) &&
            !dupWh1After?.lastUsedAt &&
            !dupWh2After?.lastUsedAt,
          '14. T12-D: Duplicate active ClientWebhook secrets reject with 401 and zero side effects',
          `status=${resT12D.status}, countsBefore=${JSON.stringify(beforeT12D)}, countsAfter=${JSON.stringify(afterT12D)}`
        );

        // T12-E: Inactive/revoked credentials reject 401, and an inactive CommunicationProvider does NOT block one active ClientWebhook
        const inactiveOnlySecret = `whsec_t12_inactive_${Date.now()}`;
        const inactiveOnlyHash = hashWebhookSecret(inactiveOnlySecret);
        const revokedWh = await ClientWebhook.create({
          clientId: clientA._id,
          name: 'T12 Revoked Webhook',
          keyId: `wh_t12_rev_${Date.now()}`,
          secretHash: inactiveOnlyHash,
          status: 'revoked',
          createdBy: adminA._id,
        });
        createdWebhookIds.push(revokedWh._id);

        const inactiveProvOnly = await CommunicationProvider.create({
          clientId: clientB._id,
          providerType: 'custom_webhook',
          displayName: 'T12 Inactive Provider Only',
          status: 'inactive',
          webhookSecretHash: inactiveOnlyHash,
          createdBy: adminA._id,
        });
        createdProviderIds.push(inactiveProvOnly._id);

        const beforeT12EInactive = await takeT12Snapshot();
        const resT12EInactive = await postGenericWebhook(
          inactiveOnlySecret,
          `t12-e-inactive-${Date.now()}`,
          'Should reject revoked/inactive credentials'
        );
        const afterT12EInactive = await takeT12Snapshot();

        const oneActiveSecret = `whsec_t12_one_active_${Date.now()}`;
        const oneActiveHash = hashWebhookSecret(oneActiveSecret);
        const activeWhOne = await ClientWebhook.create({
          clientId: clientA._id,
          name: 'T12 Single Active With Inactive Sibling',
          keyId: `wh_t12_active_sib_${Date.now()}`,
          secretHash: oneActiveHash,
          status: 'active',
          createdBy: adminA._id,
        });
        createdWebhookIds.push(activeWhOne._id);

        const inactiveProvSibling = await CommunicationProvider.create({
          clientId: clientB._id,
          providerType: 'custom_webhook',
          displayName: 'T12 Inactive Provider Sibling',
          status: 'inactive',
          webhookSecretHash: oneActiveHash,
          createdBy: adminA._id,
        });
        createdProviderIds.push(inactiveProvSibling._id);

        const msgCountABefore = await Message.countDocuments({ clientId: clientA._id });
        const msgCountBBefore = await Message.countDocuments({ clientId: clientB._id });
        const resT12EActiveWithInactive = await postGenericWebhook(
          oneActiveSecret,
          `t12-e-active-with-inactive-${Date.now()}`,
          'Single active ClientWebhook should not be blocked by inactive provider'
        );
        const jsonT12EActiveWithInactive = (await resT12EActiveWithInactive.json()) as {
          success?: boolean;
        };
        const msgCountAAfter = await Message.countDocuments({ clientId: clientA._id });
        const msgCountBAfter = await Message.countDocuments({ clientId: clientB._id });

        assert(
          resT12EInactive.status === 401 &&
            snapshotsEqual(beforeT12EInactive, afterT12EInactive) &&
            resT12EActiveWithInactive.status === 201 &&
            jsonT12EActiveWithInactive.success === true &&
            msgCountAAfter === msgCountABefore + 1 &&
            msgCountBAfter === msgCountBBefore,
          '15. T12-E: Revoked/inactive credentials reject 401 and inactive provider does not block single active ClientWebhook',
          `inactiveStatus=${resT12EInactive.status}, activeWithInactive=${resT12EActiveWithInactive.status}, msgA=${msgCountABefore}->${msgCountAAfter}, msgB=${msgCountBBefore}->${msgCountBAfter}`
        );

        // T12-F: Non-matching webhook secret rejects 401 with zero side effects
        const beforeT12F = await takeT12Snapshot();
        const resT12F = await postGenericWebhook(
          `whsec_t12_nonexistent_${Date.now()}`,
          `t12-f-missing-${Date.now()}`,
          'Should reject unknown webhook secret'
        );
        await new Promise((r) => setTimeout(r, 50));
        const afterT12F = await takeT12Snapshot();

        assert(
          resT12F.status === 401 && snapshotsEqual(beforeT12F, afterT12F),
          '16. T12-F: Unknown webhook secret rejects with 401 and zero side effects',
          `status=${resT12F.status}, countsBefore=${JSON.stringify(beforeT12F)}, countsAfter=${JSON.stringify(afterT12F)}`
        );
      } finally {
        if (createdWebhookIds.length > 0) {
          await ClientWebhook.deleteMany({ _id: { $in: createdWebhookIds } });
        }
        if (createdProviderIds.length > 0) {
          await CommunicationProvider.deleteMany({ _id: { $in: createdProviderIds } });
        }
      }
    }
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await disconnectDatabase();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
};

runGenericWebhookAuthTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

