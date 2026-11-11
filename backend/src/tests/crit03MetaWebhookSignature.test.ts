// Force an isolated ephemeral test database before loading env/db config
process.env.MONGODB_URI =
  process.env.CRIT03_TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_qa_crit03';

import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Conversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { Message } from '../models/Message';
import { Workflow } from '../models/Workflow';
import { WorkflowRun } from '../models/WorkflowRun';
import { Task } from '../models/Task';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import { WhatsAppCloudProvider } from '../services/providers/whatsapp.provider';
import { InstagramProvider } from '../services/providers/instagram.provider';
import { MessengerProvider } from '../services/providers/messenger.provider';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface MockGraphCall {
  url: string;
  method: string;
  authorization?: string;
  body?: string;
}

const results: TestResult[] = [];
const graphCalls: MockGraphCall[] = [];

const assert = (condition: boolean, testName: string, failureReason?: string) => {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  [PASS] ${testName}`);
  } else {
    results.push({ name: testName, passed: false, error: failureReason || 'Assertion failed' });
    console.error(`  [FAIL] ${testName}: ${failureReason || 'Assertion failed'}`);
  }
};

const computeMetaSig = (rawBody: string, secret: string): string => {
  return `sha256=${crypto.createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('hex')}`;
};

const runCrit03MetaSignatureTests = async () => {
  console.log('\n==================================================');
  console.log('Running CRIT-03 Issue 1: Meta POST Webhook Signature Tests');
  console.log('==================================================\n');

  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }

  if (mongoose.connection.name !== 'flumenx_qa_crit03') {
    throw new Error(`Refusing to run on non-isolated database: ${mongoose.connection.name}`);
  }

  await seedDatabase();

  await Promise.all([
    CommunicationProvider.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Contact.deleteMany({}),
    Workflow.deleteMany({}),
    WorkflowRun.deleteMany({}),
    Task.deleteMany({}),
    Client.deleteMany({ slug: /^crit03-/ }),
    User.deleteMany({ email: /^crit03-/ }),
  ]);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  const prevAppSecret = process.env.META_APP_SECRET;
  const prevIgAppSecret = process.env.META_INSTAGRAM_APP_SECRET;

  const testAppSecret = 'test_meta_app_secret_crit03_only';
  const testIgSecret = 'test_meta_ig_app_secret_crit03_only';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith(`http://localhost:${port}`)) {
      return nativeFetch(input as any, init);
    }

    if (!url.includes('graph.facebook.com')) {
      throw new Error(`Unexpected external fetch intercepted in CRIT-03 test suite: ${url}`);
    }

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    graphCalls.push({
      url,
      method: (init?.method || 'GET').toUpperCase(),
      authorization: headers.get('authorization') || undefined,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });

    if (url.endsWith('/messages')) {
      return new Response(
        JSON.stringify({ messages: [{ id: 'wamid.mock_crit03_reply' }], message_id: 'mid.mock_crit03_reply' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('fields=name,username,profile_pic') || url.includes('fields=first_name,last_name')) {
      return new Response(
        JSON.stringify({ name: 'Verified Meta Profile', username: 'verified_meta_user' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    process.env.META_APP_SECRET = testAppSecret;
    delete process.env.META_INSTAGRAM_APP_SECRET;

    const clientA = await Client.create({
      name: 'Crit03 Alpha',
      slug: 'crit03-alpha',
      status: 'active',
      health: 'healthy',
    });
    const clientB = await Client.create({
      name: 'Crit03 Beta',
      slug: 'crit03-beta',
      status: 'active',
      health: 'healthy',
    });

    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
    const adminA = await User.create({
      name: 'Crit03 Admin A',
      email: 'crit03-admin-a@example.test',
      passwordHash,
      isSuperAdmin: false,
      status: 'active',
    });
    await ClientMembership.create({
      clientId: clientA._id,
      userId: adminA._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    await CommunicationProvider.create([
      {
        clientId: clientA._id,
        providerType: 'whatsapp',
        displayName: 'Alpha WA',
        status: 'active',
        isDefault: true,
        configuration: {
          phoneNumberId: 'wa_phone_crit03_a',
          wabaId: 'waba_crit03_a',
          accessToken: 'TEST_MOCK_WA_TOKEN_A',
        },
      },
      {
        clientId: clientB._id,
        providerType: 'whatsapp',
        displayName: 'Beta WA',
        status: 'active',
        isDefault: true,
        configuration: {
          phoneNumberId: 'wa_phone_crit03_b',
          wabaId: 'waba_crit03_b',
          accessToken: 'TEST_MOCK_WA_TOKEN_B',
        },
      },
      {
        clientId: clientA._id,
        providerType: 'meta_instagram',
        displayName: 'Alpha IG',
        status: 'active',
        configuration: {
          instagramAccountId: 'ig_crit03_a',
          pageAccessToken: 'TEST_MOCK_IG_TOKEN_A',
        },
      },
      {
        clientId: clientA._id,
        providerType: 'meta_messenger',
        displayName: 'Alpha Messenger',
        status: 'active',
        configuration: {
          pageId: 'fb_crit03_a',
          pageAccessToken: 'TEST_MOCK_FB_TOKEN_A',
        },
      },
    ]);

    // Active workflow triggered on conversation.received to confirm invalid webhooks trigger zero workflows
    await Workflow.create({
      clientId: clientA._id,
      name: 'Crit03 Inbound Task Workflow',
      status: 'active',
      trigger: { eventType: 'conversation.received' },
      actions: [
        {
          id: 'act_task_1',
          type: 'create_task',
          payload: { title: 'Follow up {{body}}' },
        },
      ],
      createdBy: adminA._id,
    });

    // =========================================================================
    // 1. VALID REQUESTS (All 3 channels, raw whitespace/Unicode, multi-entry, alt route prefixes)
    // =========================================================================
    graphCalls.length = 0;
    const validWaRaw = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_crit03_a',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'wa_phone_crit03_a' },
                contacts: [{ wa_id: '919800001111', profile: { name: 'Valid WA Customer' } }],
                messages: [
                  { id: 'wamid.crit03_valid_1', from: '919800001111', type: 'text', text: { body: 'Valid signed WA' } },
                ],
              },
            },
          ],
        },
      ],
    });
    const resWaValid = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(validWaRaw, testAppSecret),
      },
      body: validWaRaw,
    });
    const waMsg = await Message.findOne({ externalMessageId: 'wamid.crit03_valid_1' });
    assert(
      resWaValid.status === 200 && waMsg?.clientId?.toString() === clientA._id.toString(),
      'Valid WhatsApp X-Hub-Signature-256 accepted and routed to Workspace A'
    );

    graphCalls.length = 0;
    const validIgRaw = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'ig_crit03_a',
          messaging: [
            {
              sender: { id: 'ig_sender_valid_1' },
              recipient: { id: 'ig_crit03_a' },
              message: { mid: 'ig_mid.crit03_valid_1', text: 'Valid signed IG' },
            },
          ],
        },
      ],
    });
    const resIgValid = await fetch(`${baseUrl}/conversations/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(validIgRaw, testAppSecret),
      },
      body: validIgRaw,
    });
    const igMsg = await Message.findOne({ externalMessageId: 'ig_mid.crit03_valid_1' });
    assert(
      resIgValid.status === 200 &&
        igMsg?.clientId?.toString() === clientA._id.toString() &&
        graphCalls.some((c) => c.url.includes('/ig_sender_valid_1')),
      'Valid Instagram X-Hub-Signature-256 accepted on shared route and fetches profile'
    );

    graphCalls.length = 0;
    const validFbRaw = JSON.stringify({
      object: 'page',
      entry: [
        {
          id: 'fb_crit03_a',
          messaging: [
            {
              sender: { id: 'fb_sender_valid_1' },
              recipient: { id: 'fb_crit03_a' },
              message: { mid: 'fb_mid.crit03_valid_1', text: 'Valid signed Messenger' },
            },
          ],
        },
      ],
    });
    const resFbValid = await fetch(`${baseUrl}/client/webhooks/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(validFbRaw, testAppSecret),
      },
      body: validFbRaw,
    });
    const fbMsg = await Message.findOne({ externalMessageId: 'fb_mid.crit03_valid_1' });
    assert(
      resFbValid.status === 200 && fbMsg?.clientId?.toString() === clientA._id.toString(),
      'Valid Messenger X-Hub-Signature-256 accepted on mounted webhook route'
    );

    // Raw JSON formatting + key order + escaped slashes + Unicode emojis must verify exact raw wire Buffer
    const nonCanonicalRaw =
      '{\n  "entry":  [\n    {\n      "changes": [{\n        "value": {\n          "messaging_product": "whatsapp",\n          "metadata": { "phone_number_id": "wa_phone_crit03_a" },\n          "contacts": [{ "wa_id": "919800002222", "profile": { "name": "Unicode Café 👋" } }],\n          "messages": [{ "text": { "body": "Hello \\/ നമസ്കാരം 👋 café" }, "type": "text", "from": "919800002222", "id": "wamid.crit03_raw_unicode_1" }]\n        },\n        "field": "messages"\n      }],\n      "id": "waba_crit03_a"\n    }\n  ],\n  "object": "whatsapp_business_account"\n}';
    const resRawFormat = await fetch(`${baseUrl}/conversations/webhook/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(nonCanonicalRaw, testAppSecret),
      },
      body: nonCanonicalRaw,
    });
    const unicodeMsg = await Message.findOne({ externalMessageId: 'wamid.crit03_raw_unicode_1' });
    assert(
      resRawFormat.status === 200 && unicodeMsg?.body === 'Hello / നമസ്കാരം 👋 café',
      'Non-canonical JSON whitespace, escaped slash, key order, and UTF-8 Unicode verify cleanly against raw Buffer'
    );

    // Multi-entry batch payload preserves per-entry tenant isolation under valid signature
    const multiEntryRaw = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_crit03_a',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'wa_phone_crit03_a' },
                contacts: [{ wa_id: '919811110001', profile: { name: 'Multi A' } }],
                messages: [{ id: 'wamid.multi_a', from: '919811110001', type: 'text', text: { body: 'Batch A' } }],
              },
            },
          ],
        },
        {
          id: 'waba_crit03_b',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'wa_phone_crit03_b' },
                contacts: [{ wa_id: '919811110002', profile: { name: 'Multi B' } }],
                messages: [{ id: 'wamid.multi_b', from: '919811110002', type: 'text', text: { body: 'Batch B' } }],
              },
            },
          ],
        },
      ],
    });
    const resMulti = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(multiEntryRaw, testAppSecret),
      },
      body: multiEntryRaw,
    });
    const multiMsgA = await Message.findOne({ externalMessageId: 'wamid.multi_a' });
    const multiMsgB = await Message.findOne({ externalMessageId: 'wamid.multi_b' });
    assert(
      resMulti.status === 200 &&
        multiMsgA?.clientId?.toString() === clientA._id.toString() &&
        multiMsgB?.clientId?.toString() === clientB._id.toString(),
      'Valid multi-entry Meta payload routes each entry strictly to its own workspace'
    );

    // Optional separate META_INSTAGRAM_APP_SECRET when configured for object=instagram
    process.env.META_INSTAGRAM_APP_SECRET = testIgSecret;
    const igSubAppRaw = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'ig_crit03_a',
          messaging: [
            {
              sender: { id: 'ig_sender_subapp_1' },
              recipient: { id: 'ig_crit03_a' },
              message: { mid: 'ig_mid.crit03_subapp_1', text: 'Instagram subapp secret' },
            },
          ],
        },
      ],
    });
    const resIgWrongSecret = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(igSubAppRaw, testAppSecret),
      },
      body: igSubAppRaw,
    });
    const resIgSubAppOk = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(igSubAppRaw, testIgSecret),
      },
      body: igSubAppRaw,
    });
    assert(
      resIgWrongSecret.status === 401 && resIgSubAppOk.status === 200,
      'Separate META_INSTAGRAM_APP_SECRET enforced strictly for Instagram without mixing main secret'
    );
    delete process.env.META_INSTAGRAM_APP_SECRET;

    // =========================================================================
    // 2. INVALID REQUESTS (Enable autoReplyEnabled first to verify zero side effects!)
    // =========================================================================
    await CommunicationProvider.updateOne(
      { clientId: clientA._id, providerType: 'whatsapp' },
      { $set: { 'configuration.autoReplyEnabled': true, 'configuration.autoReplyMessage': 'Must never send on forged webhook' } }
    );
    await WorkflowRun.deleteMany({});
    await Task.deleteMany({});
    graphCalls.length = 0;

    const attackWaRaw = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_crit03_a',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'wa_phone_crit03_a' },
                contacts: [{ wa_id: '919999888877', profile: { name: 'Attacker Forged' } }],
                messages: [
                  { id: 'wamid.forged_attack', from: '919999888877', type: 'text', text: { body: 'Forged WA' } },
                ],
              },
            },
          ],
        },
      ],
    });

    const attackIgRaw = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'ig_crit03_a',
          messaging: [
            {
              sender: { id: 'ig_forged_sender_999' },
              recipient: { id: 'ig_crit03_a' },
              message: { mid: 'ig_mid.forged_attack', text: 'Forged IG' },
            },
          ],
        },
      ],
    });

    const attackFbRaw = JSON.stringify({
      object: 'page',
      entry: [
        {
          id: 'fb_crit03_a',
          messaging: [
            {
              sender: { id: 'fb_forged_sender_999' },
              recipient: { id: 'fb_crit03_a' },
              message: { mid: 'fb_mid.forged_attack', text: 'Forged FB' },
            },
          ],
        },
      ],
    });

    // 2a. Missing signature -> 401 across all 3 channels and route aliases
    const missingSigWa = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: attackWaRaw,
    });
    const missingSigIg = await fetch(`${baseUrl}/conversations/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: attackIgRaw,
    });
    const missingSigFb = await fetch(`${baseUrl}/client/webhooks/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: attackFbRaw,
    });
    assert(
      missingSigWa.status === 401 && missingSigIg.status === 401 && missingSigFb.status === 401,
      'Missing X-Hub-Signature-256 returns 401 across WhatsApp, Instagram, and Messenger'
    );

    // 2b. Incorrect signature -> 401
    const wrongSigRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}`,
      },
      body: attackWaRaw,
    });
    assert(wrongSigRes.status === 401, 'Incorrect HMAC signature digest returns 401');

    // 2c. Modified request body (valid sig for original string, tampered byte in sent body) -> 401
    const originalRaw = attackWaRaw;
    const tamperedRaw = attackWaRaw.replace('Forged WA', 'Tampered WA');
    const tamperedRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(originalRaw, testAppSecret),
      },
      body: tamperedRaw,
    });
    assert(tamperedRes.status === 401, 'Modified request body fails signature validation with 401');

    // 2d. Malformed signatures -> 401
    const rawDigestHex = crypto.createHmac('sha256', testAppSecret).update(Buffer.from(attackWaRaw, 'utf8')).digest('hex');
    const malformedCases = [
      rawDigestHex, // Missing sha256= prefix
      `sha1=${rawDigestHex.slice(0, 40)}`, // Wrong hash algorithm prefix
      `sha256=${'z'.repeat(64)}`, // Non-hex characters
      'sha256=deadbeef', // Truncated digest
    ];
    let allMalformedRejected = true;
    for (const badSig of malformedCases) {
      const r = await fetch(`${baseUrl}/conversations/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': badSig,
        },
        body: attackWaRaw,
      });
      if (r.status !== 401) {
        allMalformedRejected = false;
      }
    }
    assert(allMalformedRejected, 'Malformed signatures (no prefix, sha1, non-hex, truncated) return 401');

    // 2e. Missing App Secret fails closed (returns 503, never skips signature verification)
    delete process.env.META_APP_SECRET;
    delete process.env.META_INSTAGRAM_APP_SECRET;
    const missingSecretUnsigned = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: attackWaRaw,
    });
    const missingSecretSignedOld = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': computeMetaSig(attackWaRaw, testAppSecret),
      },
      body: attackWaRaw,
    });
    const missingSecretErrJson: any = await missingSecretSignedOld.json();
    assert(
      missingSecretUnsigned.status === 503 &&
        missingSecretSignedOld.status === 503 &&
        !JSON.stringify(missingSecretErrJson).includes(testAppSecret),
      'Missing META_APP_SECRET fails closed with 503 and exposes zero secret details'
    );
    process.env.META_APP_SECRET = testAppSecret;

    // 2f. Zero DB writes, zero Graph API calls, zero auto-replies, zero workflow executions across all invalid requests
    const forgedMessages = await Message.countDocuments({
      externalMessageId: { $in: ['wamid.forged_attack', 'ig_mid.forged_attack', 'fb_mid.forged_attack'] },
    });
    const forgedContacts = await Contact.countDocuments({
      $or: [
        { phone: '+919999888877' },
        { 'metadata.instagramScopedId': 'ig_forged_sender_999' },
        { 'metadata.messengerScopedId': 'fb_forged_sender_999' },
      ],
    });
    const workflowRunsCount = await WorkflowRun.countDocuments({});
    const tasksCount = await Task.countDocuments({});
    assert(
      forgedMessages === 0 &&
        forgedContacts === 0 &&
        workflowRunsCount === 0 &&
        tasksCount === 0 &&
        graphCalls.length === 0,
      'Invalid/missing-secret Meta requests cause 0 DB writes, 0 Graph API calls, 0 auto-replies, and 0 workflow runs'
    );

    // =========================================================================
    // 3. ADAPTER verifyWebhook() FAIL-CLOSED CHECKS
    // =========================================================================
    const waAdapter = new WhatsAppCloudProvider({ phoneNumberId: 'p1', accessToken: 't1', appSecret: testAppSecret });
    const igAdapter = new InstagramProvider({ instagramAccountId: 'ig1', pageAccessToken: 't2' });
    const fbAdapter = new MessengerProvider({ pageId: 'fb1', pageAccessToken: 't3' });

    const sampleBuf = Buffer.from(validWaRaw, 'utf8');
    const validHeader = { 'x-hub-signature-256': computeMetaSig(validWaRaw, testAppSecret) };
    const badHeader = { 'x-hub-signature-256': `sha256=${'a'.repeat(64)}` };

    assert(
      waAdapter.verifyWebhook(validHeader, sampleBuf) === true &&
        waAdapter.verifyWebhook({}, sampleBuf) === false &&
        waAdapter.verifyWebhook(badHeader, sampleBuf) === false &&
        igAdapter.verifyWebhook(validHeader, sampleBuf) === true &&
        igAdapter.verifyWebhook(badHeader, sampleBuf) === false &&
        fbAdapter.verifyWebhook(validHeader, sampleBuf, testAppSecret) === true &&
        fbAdapter.verifyWebhook(validHeader, sampleBuf, '') === false,
      'Meta provider verifyWebhook adapters enforce fail-closed HMAC verification'
    );

    // =========================================================================
    // 4. COMPATIBILITY CHECK: Non-Meta endpoints (GET challenge) remain untouched
    // =========================================================================
    const prevVerifyToken = process.env.META_VERIFY_TOKEN;
    process.env.META_VERIFY_TOKEN = 'test_crit03_compat_verify_token';
    try {
      const challengeRes = await fetch(
        `${baseUrl}/conversations/webhook?hub.mode=subscribe&hub.verify_token=test_crit03_compat_verify_token&hub.challenge=challenge_xyz`
      );
      const challengeBody = await challengeRes.text();
      assert(
        challengeRes.status === 200 && challengeBody === 'challenge_xyz',
        'GET verifyWebhookChallenge remains intact without regression'
      );
    } finally {
      if (prevVerifyToken !== undefined) process.env.META_VERIFY_TOKEN = prevVerifyToken;
      else delete process.env.META_VERIFY_TOKEN;
    }
  } finally {
    if (prevAppSecret !== undefined) process.env.META_APP_SECRET = prevAppSecret;
    else delete process.env.META_APP_SECRET;
    if (prevIgAppSecret !== undefined) process.env.META_INSTAGRAM_APP_SECRET = prevIgAppSecret;
    else delete process.env.META_INSTAGRAM_APP_SECRET;
    globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === 'flumenx_qa_crit03') {
      await mongoose.connection.dropDatabase();
    }
    await disconnectDatabase();
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n--------------------------------------------------');
  console.log(`CRIT-03 Issue 1 Results: ${passedCount} passed, ${failedCount} failed (Total: ${results.length})`);
  console.log('--------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  }
};

runCrit03MetaSignatureTests().catch((err) => {
  console.error('CRIT-03 Issue 1 Test Suite fatal error:', err);
  process.exit(1);
});
