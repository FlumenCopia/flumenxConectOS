


import http from 'http';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_qa_crit03_twilio';
process.env.PUBLIC_WEBHOOK_BASE_URL = 'https://connect.flumenx.in';

import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { Client } from '../models/Client';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { ClientMembership } from '../models/ClientMembership';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Contact } from '../models/Contact';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Workflow } from '../models/Workflow';
import { WorkflowRun } from '../models/WorkflowRun';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import {
  computeTwilioSignature,
  computeTwilioUrlOnlySignature,
  encryptProviderSecret,
} from '../utils/crypto';
import { TwilioProvider } from '../services/providers/twilio.provider';

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

const encodeForm = (params: Record<string, string>): string => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    usp.append(k, v);
  }
  return usp.toString();
};

const runTwilioWebhookAuthTests = async () => {
  console.log('\n==============================================================');
  console.log('CRIT-03 Issue 3: Twilio SMS Webhook Auth & Tenant Isolation QA');
  console.log('==============================================================\n');

  const dbUri = process.env.MONGODB_URI!;
  if (!dbUri.includes('flumenx_qa_')) {
    throw new Error(`Refusing to run against non-isolated database URI: ${dbUri}`);
  }

  await connectDatabase();
  if (mongoose.connection.name !== 'flumenx_qa_crit03_twilio') {
    throw new Error(`Refusing to run on non-isolated database: ${mongoose.connection.name}`);
  }
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
  await seedDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  const localApiBase = `http://127.0.0.1:${port}/api/v1`;
  const canonicalOrigin = 'https://connect.flumenx.in';

  // Intercept outbound Twilio REST API HTTP requests so zero real SMS messages are ever sent
  const originalFetch = globalThis.fetch.bind(globalThis);
  const outboundTwilioCalls: Array<{ url: string; body: string }> = [];
  let twilioMockSeq = 1;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const targetUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (targetUrl.startsWith('https://api.twilio.com/')) {
      outboundTwilioCalls.push({
        url: targetUrl,
        body: typeof init?.body === 'string' ? init.body : String(init?.body || ''),
      });
      return new Response(
        JSON.stringify({
          sid: `SM_MOCK_OUT_${twilioMockSeq++}`,
          status: 'queued',
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    return originalFetch(input as any, init);
  }) as typeof fetch;

  try {
    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    if (!clientAdminRole) {
      throw new Error('client_admin role missing after seed');
    }

    // Create Workspace A & Workspace B + Client Admin users
    const clientA = await Client.create({
      name: 'Twilio QA Workspace Alpha',
      slug: 'twilio-qa-alpha',
      status: 'active',
    });
    const clientB = await Client.create({
      name: 'Twilio QA Workspace Beta',
      slug: 'twilio-qa-beta',
      status: 'active',
    });

    const userA = await User.create({
      email: 'alpha-admin@twilio-qa.test',
      name: 'Alpha Admin',
      passwordHash: await bcrypt.hash('AlphaPass@123', 10),
      isEmailVerified: true,
      isActive: true,
    });
    const userB = await User.create({
      email: 'beta-admin@twilio-qa.test',
      name: 'Beta Admin',
      passwordHash: await bcrypt.hash('BetaPass@123', 10),
      isEmailVerified: true,
      isActive: true,
    });

    await ClientMembership.create({
      userId: userA._id,
      clientId: clientA._id,
      roleId: clientAdminRole._id,
      status: 'active',
    });
    await ClientMembership.create({
      userId: userB._id,
      clientId: clientB._id,
      roleId: clientAdminRole._id,
      status: 'active',
    });

    const loginCookie = async (email: string, password: string): Promise<string> => {
      const res = await fetch(`${localApiBase}/auth/login`, {
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

    const cookieA = await loginCookie('alpha-admin@twilio-qa.test', 'AlphaPass@123');
    const cookieB = await loginCookie('beta-admin@twilio-qa.test', 'BetaPass@123');

    // Workspace Twilio credentials (strictly distinct encrypted Auth Tokens)
    const tokenA = 'qa_twilio_auth_token_alpha_32char_secret';
    const tokenB = 'qa_twilio_auth_token_beta_32chars_secret';
    const accountSidA = 'AC_QA_ALPHA_000000000000000000000001';
    const accountSidB = 'AC_QA_BETA_0000000000000000000000002';
    const numberA = '+15550001111';
    const numberB = '+15550002222';

    await CommunicationProvider.create({
      clientId: clientA._id,
      providerType: 'twilio',
      displayName: 'Twilio Alpha',
      status: 'active',
      configuration: {
        accountSid: accountSidA,
        authToken: encryptProviderSecret(tokenA),
        fromNumber: numberA,
        autoReplyEnabled: true,
      },
    });

    await CommunicationProvider.create({
      clientId: clientB._id,
      providerType: 'twilio',
      displayName: 'Twilio Beta',
      status: 'active',
      configuration: {
        accountSid: accountSidB,
        authToken: encryptProviderSecret(tokenB),
        fromNumber: numberB,
      },
    });

    // Active workflow triggered on conversation.received in Workspace A (immediate execution)
    const wfAlpha = await Workflow.create({
      clientId: clientA._id,
      name: 'QA SMS Received Notification Workflow',
      status: 'active',
      trigger: { eventType: 'conversation.received' },
      conditions: [],
      actions: [
        {
          id: 'act_sms_note',
          type: 'create_notification',
          payload: {
            title: 'Inbound SMS arrived',
            message: 'Automated workflow ran for inbound SMS',
          },
          order: 0,
        },
      ],
      executionMode: 'immediate',
      maxExecutionsPerHour: 100,
    });

    const postTwilioForm = async (
      pathWithQuery: string,
      params: Record<string, string>,
      headers: Record<string, string> = {}
    ) => {
      return fetch(`${localApiBase.replace('/api/v1', '')}${pathWithQuery}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...headers,
        },
        body: encodeForm(params),
      });
    };

    const baselineCounts = async () => ({
      messages: await Message.countDocuments({}),
      contacts: await Contact.countDocuments({}),
      conversations: await Conversation.countDocuments({}),
      workflowRuns: await WorkflowRun.countDocuments({}),
      outboundCalls: outboundTwilioCalls.length,
    });

    // =========================================================================
    // INVALID / ATTACK SCENARIOS FIRST (verify zero side effects!)
    // =========================================================================
    const attackStart = await baselineCounts();

    const forgedFormParams = {
      AccountSid: accountSidA,
      MessageSid: 'SM_FORGED_001',
      From: '+15559990001',
      To: numberA,
      Body: 'Forged SMS attempt',
    };
    const canonicalWebhookPath = '/api/v1/conversations/webhook';
    const canonicalWebhookUrl = `${canonicalOrigin}${canonicalWebhookPath}`;

    // 2. Missing signature rejected
    {
      const res = await postTwilioForm(canonicalWebhookPath, forgedFormParams);
      const bodyText = await res.text();
      assert(
        res.status === 401 && !bodyText.includes(tokenA),
        '2. Missing X-Twilio-Signature header is rejected with 401 and zero token leakage',
        `Expected 401, got ${res.status}`
      );
    }

    // 3. Invalid / forged signature rejected
    {
      const res = await postTwilioForm(canonicalWebhookPath, forgedFormParams, {
        'X-Twilio-Signature': 'InvalidBase64Signature==',
      });
      assert(
        res.status === 401,
        '3. Invalid X-Twilio-Signature is rejected with 401',
        `Expected 401, got ${res.status}`
      );
    }

    // 4. Tampered request body (form-encoded) rejected
    {
      const validSigForOriginal = computeTwilioSignature(canonicalWebhookUrl, forgedFormParams, tokenA)!;
      const tamperedParams = { ...forgedFormParams, Body: 'Tampered SMS body!' };
      const res = await postTwilioForm(canonicalWebhookPath, tamperedParams, {
        'X-Twilio-Signature': validSigForOriginal,
      });
      assert(
        res.status === 401,
        '4a. Tampered form-encoded request body fails X-Twilio-Signature check with 401',
        `Expected 401, got ${res.status}`
      );
    }

    // 5. Wrong workspace Auth Token rejected (Workspace B token used for Workspace A webhook)
    {
      const sigWithWrongWorkspaceToken = computeTwilioSignature(
        canonicalWebhookUrl,
        forgedFormParams,
        tokenB
      )!;
      const res = await postTwilioForm(canonicalWebhookPath, forgedFormParams, {
        'X-Twilio-Signature': sigWithWrongWorkspaceToken,
      });
      assert(
        res.status === 401,
        '5a. Signature generated with another workspace Auth Token is rejected with 401',
        `Expected 401, got ${res.status}`
      );

      // Unmapped AccountSid / To rejected cleanly even with arbitrary signature
      const unmappedParams = {
        ...forgedFormParams,
        AccountSid: 'AC_UNMAPPED_999',
        To: '+15559998888',
      };
      const resUnmapped = await postTwilioForm(canonicalWebhookPath, unmappedParams, {
        'X-Twilio-Signature': computeTwilioSignature(canonicalWebhookUrl, unmappedParams, tokenA)!,
      });
      assert(
        resUnmapped.status === 401,
        '5b. Unmapped Twilio workspace / no fallback credential is rejected with 401',
        `Expected 401, got ${resUnmapped.status}`
      );
    }

    // 6. Ambiguous provider resolution rejected (duplicate active fromNumber or AccountSid)
    {
      const clientC = await Client.create({
        name: 'Twilio QA Ambiguous Workspace',
        slug: 'twilio-qa-ambiguous',
        status: 'active',
      });
      const dupProvider = await CommunicationProvider.create({
        clientId: clientC._id,
        providerType: 'twilio',
        displayName: 'Duplicate Alpha Number',
        status: 'active',
        configuration: {
          accountSid: accountSidA,
          authToken: encryptProviderSecret('dup_token_secret'),
          fromNumber: numberA,
        },
      });

      const sig = computeTwilioSignature(canonicalWebhookUrl, forgedFormParams, tokenA)!;
      const resAmb = await postTwilioForm(canonicalWebhookPath, forgedFormParams, {
        'X-Twilio-Signature': sig,
      });
      assert(
        resAmb.status === 401,
        '6a. Ambiguous matching active Twilio providers (duplicate fromNumber) is rejected with 401',
        `Expected 401, got ${resAmb.status}`
      );

      // Test AccountSid-only ambiguity when different fromNumbers share one AccountSid and incoming To is unknown
      await CommunicationProvider.updateOne(
        { _id: dupProvider._id },
        { $set: { 'configuration.fromNumber': '+15550009999' } }
      );
      const unknownToSameAccount = {
        ...forgedFormParams,
        To: '+15558887777',
      };
      const sigAmbSid = computeTwilioSignature(canonicalWebhookUrl, unknownToSameAccount, tokenA)!;
      const resAmbSid = await postTwilioForm(canonicalWebhookPath, unknownToSameAccount, {
        'X-Twilio-Signature': sigAmbSid,
      });
      assert(
        resAmbSid.status === 401,
        '6b. Ambiguous AccountSid fallback across multiple workspaces is rejected with 401',
        `Expected 401, got ${resAmbSid.status}`
      );

      await CommunicationProvider.deleteOne({ _id: dupProvider._id });
      await Client.deleteOne({ _id: clientC._id });
    }

    // 7. Exact public URL, callback path, and fail-closed URL config check
    {
      // Wrong path in signature (/webhooks instead of /webhook)
      const wrongPathSig = computeTwilioSignature(
        `${canonicalOrigin}/api/v1/conversations/webhooks`,
        forgedFormParams,
        tokenA
      )!;
      const resWrongPath = await postTwilioForm(canonicalWebhookPath, forgedFormParams, {
        'X-Twilio-Signature': wrongPathSig,
      });
      assert(
        resWrongPath.status === 401,
        '7a. Signature signed for mismatched callback path is rejected with 401',
        `Expected 401, got ${resWrongPath.status}`
      );

      // Mismatched query string in signature
      const querySig = computeTwilioSignature(
        `${canonicalWebhookUrl}?source=wrong`,
        forgedFormParams,
        tokenA
      )!;
      const resWrongQuery = await postTwilioForm(`${canonicalWebhookPath}?source=twilio`, forgedFormParams, {
        'X-Twilio-Signature': querySig,
      });
      assert(
        resWrongQuery.status === 401,
        '7b. Signature signed for mismatched query string is rejected with 401',
        `Expected 401, got ${resWrongQuery.status}`
      );

      // Missing PUBLIC_WEBHOOK_BASE_URL fails closed
      const savedPublicBase = process.env.PUBLIC_WEBHOOK_BASE_URL;
      delete process.env.PUBLIC_WEBHOOK_BASE_URL;
      const validSig = computeTwilioSignature(canonicalWebhookUrl, forgedFormParams, tokenA)!;
      const resNoUrlCfg = await postTwilioForm(canonicalWebhookPath, forgedFormParams, {
        'X-Twilio-Signature': validSig,
      });
      assert(
        resNoUrlCfg.status === 503,
        '7c. Unavailable public webhook URL configuration fails closed with 503',
        `Expected 503, got ${resNoUrlCfg.status}`
      );

      // Insecure non-localhost HTTP public URL fails closed
      process.env.PUBLIC_WEBHOOK_BASE_URL = 'http://connect.flumenx.in';
      const resHttpCfg = await postTwilioForm(canonicalWebhookPath, forgedFormParams, {
        'X-Twilio-Signature': validSig,
      });
      assert(
        resHttpCfg.status === 503,
        '7d. Non-HTTPS non-local public URL configuration fails closed with 503',
        `Expected 503, got ${resHttpCfg.status}`
      );

      process.env.PUBLIC_WEBHOOK_BASE_URL = savedPublicBase;
    }

    // 8b. Spoofed proxy headers (Host / X-Forwarded-Host / X-Forwarded-Proto) cannot bypass canonical URL
    {
      const spoofedSig = computeTwilioSignature(
        `http://evil.attacker.com${canonicalWebhookPath}`,
        forgedFormParams,
        tokenA
      )!;
      const resSpoofedProxy = await postTwilioForm(canonicalWebhookPath, forgedFormParams, {
        'X-Twilio-Signature': spoofedSig,
        Host: 'evil.attacker.com',
        'X-Forwarded-Host': 'evil.attacker.com',
        'X-Forwarded-Proto': 'http',
      });
      assert(
        resSpoofedProxy.status === 401,
        '8a. Spoofed Host/X-Forwarded-Host/X-Forwarded-Proto headers cannot weaken URL verification (rejected 401)',
        `Expected 401, got ${resSpoofedProxy.status}`
      );
    }

    // 10a/b. JSON invalid cases (missing bodySHA256 & tampered JSON body)
    {
      const jsonObj = { ...forgedFormParams, Body: 'JSON forged check' };
      const rawJson = JSON.stringify(jsonObj);
      const validBodySha = crypto.createHash('sha256').update(rawJson, 'utf8').digest('hex');

      // JSON missing bodySHA256 query parameter -> fail closed 401
      const resJsonNoSha = await fetch(`${localApiBase.replace('/api/v1', '')}${canonicalWebhookPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Twilio-Signature': computeTwilioUrlOnlySignature(canonicalWebhookUrl, tokenA),
        },
        body: rawJson,
      });
      assert(
        resJsonNoSha.status === 401,
        '10a. JSON Twilio webhook without bodySHA256 query param fails closed with 401',
        `Expected 401, got ${resJsonNoSha.status}`
      );

      // JSON tampered body -> bodySHA256 mismatch -> 401
      const signedJsonUrl = `${canonicalWebhookUrl}?bodySHA256=${validBodySha}`;
      const jsonSig = computeTwilioUrlOnlySignature(signedJsonUrl, tokenA);
      const resJsonTampered = await fetch(
        `${localApiBase.replace('/api/v1', '')}${canonicalWebhookPath}?bodySHA256=${validBodySha}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Twilio-Signature': jsonSig,
          },
          body: JSON.stringify({ ...jsonObj, Body: 'Tampered JSON content' }),
        }
      );
      assert(
        resJsonTampered.status === 401,
        '4b/10b. Tampered JSON webhook body fails bodySHA256 check with 401',
        `Expected 401, got ${resJsonTampered.status}`
      );
    }

    // Verify 13, 14, 15: Zero DB side effects, zero workflow runs, zero outbound Twilio API calls across ALL invalid attempts
    const afterInvalidCounts = await baselineCounts();
    assert(
      afterInvalidCounts.messages === attackStart.messages &&
        afterInvalidCounts.contacts === attackStart.contacts &&
        afterInvalidCounts.conversations === attackStart.conversations,
      '13. All invalid/forged Twilio requests created zero messages, contacts, and conversations',
      JSON.stringify({ attackStart, afterInvalidCounts })
    );
    assert(
      afterInvalidCounts.workflowRuns === attackStart.workflowRuns,
      '14. All invalid/forged Twilio requests triggered zero workflows',
      `workflowRuns delta=${afterInvalidCounts.workflowRuns - attackStart.workflowRuns}`
    );
    assert(
      afterInvalidCounts.outboundCalls === attackStart.outboundCalls,
      '15. All invalid/forged Twilio requests triggered zero outbound Twilio API calls',
      `outboundCalls=${afterInvalidCounts.outboundCalls}`
    );

    // =========================================================================
    // VALID AUTHENTICATED WORKFLOWS, DEDUPLICATION & INBOX VISIBILITY
    // =========================================================================

    // 1 + 8b + 9. Valid form-encoded webhook behind HTTPS reverse proxy headers + special chars & query param
    const validParamsA1 = {
      AccountSid: accountSidA,
      MessageSid: 'SM_VALID_ALPHA_001',
      From: '+15557770001',
      To: '+1 555-000-1111', // verifies normalized E.164 match against '+15550001111'
      Body: 'Hello & welcome from Twilio SMS!',
      NumMedia: '0',
    };
    const exactQueryPath = `${canonicalWebhookPath}?source=twilio`;
    const exactPublicQueryUrl = `${canonicalOrigin}${exactQueryPath}`;
    const validSigA1 = computeTwilioSignature(exactPublicQueryUrl, validParamsA1, tokenA)!;

    {
      const res = await postTwilioForm(exactQueryPath, validParamsA1, {
        'X-Twilio-Signature': validSigA1,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'connect.flumenx.in',
      });
      const xml = await res.text();
      assert(
        res.status === 200 && xml.includes('<Response></Response>'),
        '1/7e/8b/9a. Valid signed form-encoded Twilio webhook behind HTTPS reverse proxy returns 200 TwiML',
        `status=${res.status}, body=${xml}`
      );
    }

    // Verify TwilioProvider.verifyWebhook adapter method directly (valid & invalid)
    {
      const adapter = new TwilioProvider({
        accountSid: accountSidA,
        authToken: tokenA,
        fromNumber: numberA,
      });
      const adapterValid = adapter.verifyWebhook(
        {
          'x-twilio-signature': validSigA1,
          'x-twilio-webhook-url': exactQueryPath,
          'content-type': 'application/x-www-form-urlencoded',
        },
        validParamsA1
      );
      const adapterInvalid = adapter.verifyWebhook(
        {
          'x-twilio-signature': 'wrong',
          'x-twilio-webhook-url': exactQueryPath,
          'content-type': 'application/x-www-form-urlencoded',
        },
        validParamsA1
      );
      assert(
        adapterValid === true && adapterInvalid === false,
        '9b. TwilioProvider.verifyWebhook returns true for valid signature and false for invalid signature',
        `adapterValid=${adapterValid}, adapterInvalid=${adapterInvalid}`
      );
    }

    // 10c. Valid JSON Twilio webhook with bodySHA256 accepted cleanly
    {
      const jsonValidPayload = {
        AccountSid: accountSidA,
        MessageSid: 'SM_VALID_ALPHA_JSON_002',
        From: '+15557770001',
        To: numberA,
        Body: 'Valid JSON callback SMS',
      };
      const rawJsonValid = JSON.stringify(jsonValidPayload);
      const bodySha = crypto.createHash('sha256').update(rawJsonValid, 'utf8').digest('hex');
      const fullJsonUrl = `${canonicalWebhookUrl}?bodySHA256=${bodySha}`;
      const jsonSigValid = computeTwilioUrlOnlySignature(fullJsonUrl, tokenA);

      const res = await fetch(
        `${localApiBase.replace('/api/v1', '')}${canonicalWebhookPath}?bodySHA256=${bodySha}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Twilio-Signature': jsonSigValid,
          },
          body: rawJsonValid,
        }
      );
      const jsonMsgCount = await Message.countDocuments({
        clientId: clientA._id,
        externalMessageId: 'SM_VALID_ALPHA_JSON_002',
      });
      assert(
        res.status === 200 && jsonMsgCount === 1,
        '10c. Valid JSON Twilio webhook with bodySHA256 and X-Twilio-Signature persists SMS',
        `status=${res.status}, count=${jsonMsgCount}`
      );
    }

    // 11. Duplicate MessageSid in SAME workspace is ignored
    {
      const callsBeforeDup = outboundTwilioCalls.length;
      const resDup = await postTwilioForm(exactQueryPath, validParamsA1, {
        'X-Twilio-Signature': validSigA1,
      });
      const dupMsgCount = await Message.countDocuments({
        clientId: clientA._id,
        externalMessageId: 'SM_VALID_ALPHA_001',
      });
      assert(
        resDup.status === 200 && dupMsgCount === 1 && outboundTwilioCalls.length === callsBeforeDup,
        '11. Duplicate MessageSid in same workspace is ignored idempotently without extra messages or auto-replies',
        `status=${resDup.status}, count=${dupMsgCount}`
      );
    }

    // 12. Same MessageSid ('SM_VALID_ALPHA_001') in DIFFERENT workspace (Client B) is handled independently
    {
      const validParamsB = {
        AccountSid: accountSidB,
        MessageSid: 'SM_VALID_ALPHA_001', // Exact same MessageSid in Workspace B!
        From: '+15557770002',
        To: numberB,
        Body: 'Independent Beta SMS with colliding SID',
      };
      const sigB = computeTwilioSignature(canonicalWebhookUrl, validParamsB, tokenB)!;
      const resB = await postTwilioForm(canonicalWebhookPath, validParamsB, {
        'X-Twilio-Signature': sigB,
      });

      const countA = await Message.countDocuments({
        clientId: clientA._id,
        externalMessageId: 'SM_VALID_ALPHA_001',
      });
      const countB = await Message.countDocuments({
        clientId: clientB._id,
        externalMessageId: 'SM_VALID_ALPHA_001',
      });
      assert(
        resB.status === 200 && countA === 1 && countB === 1,
        '12. Identical MessageSid in different workspaces is processed independently (clientId-scoped deduplication)',
        `status=${resB.status}, countA=${countA}, countB=${countB}`
      );
    }

    // 16. Valid SMS appears in correct workspace Inbox, isolated from Workspace B, workflow ran, and staff reply still works
    {
      const inboxResA = await fetch(`${localApiBase}/conversations?channel=sms`, {
        headers: { Cookie: cookieA, 'X-Client-Id': clientA._id.toString() },
      });
      const inboxDataA = await inboxResA.json();
      const convsA = inboxDataA.data?.conversations || [];
      const targetConvA = convsA.find((c: any) => c.channel === 'sms');

      let msgVisibleInInboxA = false;
      let msgIsolatedFromB = false;
      let staffReplyOk = false;

      if (targetConvA) {
        const msgsResA = await fetch(`${localApiBase}/conversations/${targetConvA._id}/messages`, {
          headers: { Cookie: cookieA, 'X-Client-Id': clientA._id.toString() },
        });
        const msgsDataA = await msgsResA.json();
        const msgs = msgsDataA.data?.messages || [];
        msgVisibleInInboxA = msgs.some(
          (m: any) =>
            m.direction === 'inbound' &&
            m.externalMessageId === 'SM_VALID_ALPHA_001' &&
            m.body === 'Hello & welcome from Twilio SMS!'
        );

        // Staff reply check via Inbox API (uses mocked Twilio outbound fetch)
        const replyRes = await fetch(`${localApiBase}/conversations/${targetConvA._id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookieA,
            'X-Client-Id': clientA._id.toString(),
          },
          body: JSON.stringify({
            channel: 'sms',
            body: 'Staff reply via Inbox QA',
          }),
        });
        staffReplyOk = replyRes.status === 201;
      }

      const inboxResB = await fetch(`${localApiBase}/conversations?channel=sms`, {
        headers: { Cookie: cookieB, 'X-Client-Id': clientB._id.toString() },
      });
      const inboxDataB = await inboxResB.json();
      const convsB = inboxDataB.data?.conversations || [];
      msgIsolatedFromB =
        convsB.length === 1 &&
        !convsB.some((c: any) => c.lastMessageSnippet?.includes('Hello & welcome'));

      const wfRunsA = await WorkflowRun.countDocuments({
        clientId: clientA._id,
        workflowId: wfAlpha._id,
        eventType: 'conversation.received',
        status: 'completed',
      });

      assert(
        inboxResA.status === 200 && msgVisibleInInboxA && msgIsolatedFromB,
        '16a. Valid SMS reaches Workspace A Inbox API and remains isolated from Workspace B Inbox',
        `inboxStatus=${inboxResA.status}, visible=${msgVisibleInInboxA}, isolated=${msgIsolatedFromB}`
      );
      assert(
        wfRunsA >= 1 && staffReplyOk && outboundTwilioCalls.length >= 2,
        '16b. Existing conversation.received workflow triggered, auto-reply & staff reply dispatched via mocked Twilio API',
        `wfRunsA=${wfRunsA}, staffReplyOk=${staffReplyOk}, mockCalls=${outboundTwilioCalls.length}`
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
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

runTwilioWebhookAuthTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});