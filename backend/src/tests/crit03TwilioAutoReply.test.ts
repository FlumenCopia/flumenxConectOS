import http from 'http';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_qa_crit03_twilio_autoreply';
process.env.PUBLIC_WEBHOOK_BASE_URL = 'https://connect.flumenx.in';

import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { Client } from '../models/Client';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { ClientMembership } from '../models/ClientMembership';
import { CommunicationProvider } from '../models/CommunicationProvider';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Workflow } from '../models/Workflow';
import { WorkflowRun } from '../models/WorkflowRun';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import { ConversationWebhookService } from '../services/conversationWebhook.service';
import { computeTwilioSignature, encryptProviderSecret } from '../utils/crypto';

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

const runTwilioAutoReplyTests = async () => {
  console.log('\n================================================================');
  console.log('CRIT-03 Issue 5: Twilio Opt-In Auto-Reply Security & Flow QA');
  console.log('================================================================\n');

  const dbUri = process.env.MONGODB_URI || '';
  if (!dbUri.includes('flumenx_qa_')) {
    throw new Error(`Refusing to run against non-isolated database URI: ${dbUri}`);
  }

  await connectDatabase();
  if (mongoose.connection.name !== 'flumenx_qa_crit03_twilio_autoreply') {
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
  const webhookPath = '/api/v1/conversations/webhook';
  const webhookUrl = `${canonicalOrigin}${webhookPath}`;

  // Mock outbound api.twilio.com HTTP requests — never send real SMS messages
  const originalFetch = globalThis.fetch.bind(globalThis);
  const outboundTwilioCalls: Array<{ url: string; body: string }> = [];
  let mockSidSeq = 1;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const targetUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (targetUrl.startsWith('https://api.twilio.com/')) {
      outboundTwilioCalls.push({
        url: targetUrl,
        body: typeof init?.body === 'string' ? init.body : String(init?.body || ''),
      });
      return new Response(
        JSON.stringify({
          sid: `SM_MOCK_AR_${mockSidSeq++}`,
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

    // Create 3 workspaces:
    // - Client A: autoReplyEnabled === true
    // - Client B: autoReplyEnabled === false
    // - Client C: autoReplyEnabled omitted (undefined)
    const clientA = await Client.create({ name: 'AR Enabled Workspace', slug: 'ar-enabled', status: 'active' });
    const clientB = await Client.create({ name: 'AR Disabled Workspace', slug: 'ar-disabled', status: 'active' });
    const clientC = await Client.create({ name: 'AR Omitted Workspace', slug: 'ar-omitted', status: 'active' });
    const clientMissingCfg = await Client.create({
      name: 'AR Missing Config Workspace',
      slug: 'ar-missing-cfg',
      status: 'active',
    });

    const createAdmin = async (email: string, clientId: mongoose.Types.ObjectId) => {
      const user = await User.create({
        email,
        name: email,
        passwordHash: await bcrypt.hash('AutoReply@123', 10),
        isEmailVerified: true,
        isActive: true,
      });
      await ClientMembership.create({
        userId: user._id,
        clientId,
        roleId: clientAdminRole._id,
        status: 'active',
      });
      const res = await fetch(`${localApiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'AutoReply@123' }),
      });
      return res.headers.get('set-cookie')!.split(';')[0];
    };

    const cookieA = await createAdmin('ar-a@qa.test', clientA._id);
    const cookieB = await createAdmin('ar-b@qa.test', clientB._id);

    const credA = {
      accountSid: 'AC_AR_ALPHA_0000000000000000000001',
      authToken: 'ar_auth_token_alpha_32char_secret_1',
      fromNumber: '+15551110001',
    };
    const credB = {
      accountSid: 'AC_AR_BETA_00000000000000000000002',
      authToken: 'ar_auth_token_beta_32chars_secret_2',
      fromNumber: '+15551110002',
    };
    const credC = {
      accountSid: 'AC_AR_GAMMA_0000000000000000000003',
      authToken: 'ar_auth_token_gamma_32char_secret_3',
      fromNumber: '+15551110003',
    };

    await CommunicationProvider.create({
      clientId: clientA._id,
      providerType: 'twilio',
      displayName: 'Twilio Alpha Enabled',
      status: 'active',
      configuration: {
        accountSid: credA.accountSid,
        authToken: encryptProviderSecret(credA.authToken),
        fromNumber: credA.fromNumber,
        autoReplyEnabled: true,
      },
    });

    await CommunicationProvider.create({
      clientId: clientB._id,
      providerType: 'twilio',
      displayName: 'Twilio Beta Disabled',
      status: 'active',
      configuration: {
        accountSid: credB.accountSid,
        authToken: encryptProviderSecret(credB.authToken),
        fromNumber: credB.fromNumber,
        autoReplyEnabled: false,
      },
    });

    await CommunicationProvider.create({
      clientId: clientC._id,
      providerType: 'twilio',
      displayName: 'Twilio Gamma Missing AutoReply',
      status: 'active',
      configuration: {
        accountSid: credC.accountSid,
        authToken: encryptProviderSecret(credC.authToken),
        fromNumber: credC.fromNumber,
      },
    });

    // Active workflow for Workspace B (auto-reply disabled) to verify workflow still executes!
    const wfBeta = await Workflow.create({
      clientId: clientB._id,
      name: 'Beta Inbound SMS Workflow',
      status: 'active',
      trigger: { eventType: 'conversation.received' },
      conditions: [],
      actions: [
        {
          id: 'act_beta_notify',
          type: 'create_notification',
          payload: { title: 'SMS received', message: 'Beta SMS workflow triggered' },
          order: 0,
        },
      ],
      executionMode: 'immediate',
      maxExecutionsPerHour: 100,
    });

    const postSignedTwilio = async (
      params: Record<string, string>,
      authToken: string,
      overrideSignature?: string
    ) => {
      const sig =
        overrideSignature !== undefined
          ? overrideSignature
          : computeTwilioSignature(webhookUrl, params, authToken)!;
      return fetch(`${localApiBase.replace('/api/v1', '')}${webhookPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Twilio-Signature': sig,
        },
        body: encodeForm(params),
      });
    };

    // 11 & 12. Invalid Twilio signature rejected even when Workspace A has autoReplyEnabled === true, sending ZERO SMS
    {
      const callsBefore = outboundTwilioCalls.length;
      const badParams = {
        AccountSid: credA.accountSid,
        MessageSid: 'SM_AR_FORGED_001',
        From: '+15559990001',
        To: credA.fromNumber,
        Body: 'Forged SMS targeting enabled workspace',
      };
      const resBad = await postSignedTwilio(badParams, credA.authToken, 'invalid_forged_sig==');
      assert(
        resBad.status === 401 && outboundTwilioCalls.length === callsBefore,
        '11/12. Invalid Twilio signature targeting auto-reply-enabled workspace is rejected with 401 and zero outbound SMS calls',
        `status=${resBad.status}, calls=${outboundTwilioCalls.length - callsBefore}`
      );
    }

    // 1. autoReplyEnabled === true: automatic SMS reply IS sent & bot message saved
    {
      const callsBefore = outboundTwilioCalls.length;
      const paramsA = {
        AccountSid: credA.accountSid,
        MessageSid: 'SM_AR_VALID_A1',
        From: '+15558880001',
        To: credA.fromNumber,
        Body: 'Hello Alpha SMS',
      };
      const resA = await postSignedTwilio(paramsA, credA.authToken);
      const botMsgsA = await Message.countDocuments({
        clientId: clientA._id,
        channel: 'sms',
        senderType: 'bot',
        direction: 'outbound',
      });
      const expectedText =
        "Hi, thanks for contacting FlumenX! We've received your SMS and our team will get back to you shortly.";
      assert(
        resA.status === 200 &&
          outboundTwilioCalls.length === callsBefore + 1 &&
          outboundTwilioCalls[callsBefore].url.includes(credA.accountSid) &&
          decodeURIComponent(outboundTwilioCalls[callsBefore].body.replace(/\+/g, ' ')).includes(
            expectedText
          ) &&
          botMsgsA === 1,
        '1. autoReplyEnabled === true sends existing automatic SMS reply and persists bot message',
        `status=${resA.status}, callsDelta=${outboundTwilioCalls.length - callsBefore}, botMsgs=${botMsgsA}`
      );
    }

    // 2, 5, 6, 7, 8, 9, 10. autoReplyEnabled === false: ZERO auto-reply, SMS persisted, Conversation created/updated, Inbox visible, workflow triggered, staff reply works
    {
      const callsBefore = outboundTwilioCalls.length;
      const paramsB1 = {
        AccountSid: credB.accountSid,
        MessageSid: 'SM_AR_VALID_B1',
        From: '+15558880002',
        To: credB.fromNumber,
        Body: 'First SMS to disabled Beta workspace',
      };
      const resB1 = await postSignedTwilio(paramsB1, credB.authToken);

      const botMsgsB = await Message.countDocuments({
        clientId: clientB._id,
        channel: 'sms',
        senderType: 'bot',
      });
      const inboundMsgB1 = await Message.findOne({
        clientId: clientB._id,
        externalMessageId: 'SM_AR_VALID_B1',
        direction: 'inbound',
      });
      const convB1 = await Conversation.findOne({
        clientId: clientB._id,
        channel: 'sms',
      });

      assert(
        resB1.status === 200 && outboundTwilioCalls.length === callsBefore && botMsgsB === 0,
        '2/5. autoReplyEnabled === false sends zero automatic SMS replies (independent of enabled Workspace A)',
        `status=${resB1.status}, callsDelta=${outboundTwilioCalls.length - callsBefore}, botMsgsB=${botMsgsB}`
      );
      assert(
        inboundMsgB1 !== null &&
          inboundMsgB1.body === 'First SMS to disabled Beta workspace' &&
          convB1 !== null &&
          convB1.status === 'open' &&
          convB1.unreadCount === 1 &&
          convB1.lastMessageSnippet === 'First SMS to disabled Beta workspace',
        '6/8a. Incoming SMS and new Conversation are persisted normally when auto-reply is disabled',
        `msg=${Boolean(inboundMsgB1)}, convUnread=${convB1?.unreadCount}`
      );

      // Second inbound SMS updates existing conversation unreadCount cleanly (2) with zero auto-replies
      const paramsB2 = {
        AccountSid: credB.accountSid,
        MessageSid: 'SM_AR_VALID_B2',
        From: '+15558880002',
        To: credB.fromNumber,
        Body: 'Follow-up SMS to disabled Beta workspace',
      };
      const resB2 = await postSignedTwilio(paramsB2, credB.authToken);
      const convBUpdated = await Conversation.findById(convB1!._id);
      assert(
        resB2.status === 200 &&
          outboundTwilioCalls.length === callsBefore &&
          convBUpdated?.unreadCount === 2 &&
          convBUpdated?.lastMessageSnippet === 'Follow-up SMS to disabled Beta workspace',
        '8b. Subsequent incoming SMS updates existing conversation unreadCount without auto-reply',
        `unread=${convBUpdated?.unreadCount}, callsDelta=${outboundTwilioCalls.length - callsBefore}`
      );

      // Inbox API visibility (Workspace B sees it; Workspace A does not)
      const inboxB = await (
        await fetch(`${localApiBase}/conversations?channel=sms`, {
          headers: { Cookie: cookieB, 'X-Client-Id': clientB._id.toString() },
        })
      ).json();
      const msgsB = await (
        await fetch(`${localApiBase}/conversations/${convB1!._id}/messages`, {
          headers: { Cookie: cookieB, 'X-Client-Id': clientB._id.toString() },
        })
      ).json();
      const inboxA = await (
        await fetch(`${localApiBase}/conversations?channel=sms`, {
          headers: { Cookie: cookieA, 'X-Client-Id': clientA._id.toString() },
        })
      ).json();

      const inInboxB = (inboxB.data?.conversations || []).some(
        (c: any) => c._id === convB1!._id.toString()
      );
      const hasBothInThread = (msgsB.data?.messages || []).some(
        (m: any) => m.externalMessageId === 'SM_AR_VALID_B1'
      );
      const leakedToA = (inboxA.data?.conversations || []).some(
        (c: any) => c._id === convB1!._id.toString()
      );
      assert(
        inInboxB && hasBothInThread && !leakedToA,
        '7. Incoming SMS appears in Workspace B Unified Inbox API and remains isolated from Workspace A',
        `inInboxB=${inInboxB}, hasThread=${hasBothInThread}, leakedToA=${leakedToA}`
      );

      // Existing workflow still triggered
      const wfRunsB = await WorkflowRun.countDocuments({
        clientId: clientB._id,
        workflowId: wfBeta._id,
        eventType: 'conversation.received',
        status: 'completed',
      });
      assert(
        wfRunsB === 2,
        '9. Existing conversation.received workflow still executes when auto-reply is disabled',
        `wfRunsB=${wfRunsB}`
      );

      // Staff outbound SMS reply continues working
      const staffReplyRes = await fetch(`${localApiBase}/conversations/${convB1!._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieB,
          'X-Client-Id': clientB._id.toString(),
        },
        body: JSON.stringify({
          channel: 'sms',
          body: 'Manual staff SMS reply from Inbox',
        }),
      });
      assert(
        staffReplyRes.status === 201 && outboundTwilioCalls.length === callsBefore + 1,
        '10. Staff outbound SMS reply succeeds via mocked Twilio API when auto-reply is disabled',
        `status=${staffReplyRes.status}, callsDelta=${outboundTwilioCalls.length - callsBefore}`
      );
    }

    // 3. Missing autoReplyEnabled setting (undefined): no automatic SMS reply sent
    {
      const callsBefore = outboundTwilioCalls.length;
      const paramsC = {
        AccountSid: credC.accountSid,
        MessageSid: 'SM_AR_VALID_C1',
        From: '+15558880003',
        To: credC.fromNumber,
        Body: 'SMS to workspace without autoReplyEnabled key',
      };
      const resC = await postSignedTwilio(paramsC, credC.authToken);
      const botMsgsC = await Message.countDocuments({ clientId: clientC._id, senderType: 'bot' });
      const inboundMsgC = await Message.findOne({
        clientId: clientC._id,
        externalMessageId: 'SM_AR_VALID_C1',
      });
      assert(
        resC.status === 200 &&
          outboundTwilioCalls.length === callsBefore &&
          botMsgsC === 0 &&
          inboundMsgC !== null,
        '3. Missing autoReplyEnabled setting does not send auto-reply while still saving inbound SMS',
        `status=${resC.status}, callsDelta=${outboundTwilioCalls.length - callsBefore}, botMsgsC=${botMsgsC}`
      );
    }

    // 4. Missing workspace / provider configuration fails safely with zero automatic SMS replies
    {
      const callsBefore = outboundTwilioCalls.length;
      // 4a. Direct service call with missing configuration object on verifiedProviderDoc
      const resDirectMissingCfg = await ConversationWebhookService.processTwilioWebhook(
        {
          AccountSid: 'AC_NO_CFG',
          MessageSid: 'SM_AR_MISSING_CFG_1',
          From: '+15558880004',
          To: '+15551110004',
          Body: 'Direct service check missing config',
        },
        { clientId: clientMissingCfg._id } // configuration intentionally omitted!
      );

      // 4b. HTTP webhook for workspace without any Twilio CommunicationProvider
      const resUnconfiguredHttp = await postSignedTwilio(
        {
          AccountSid: 'AC_UNKNOWN_WORKSPACE',
          MessageSid: 'SM_AR_UNCONFIGURED_HTTP',
          From: '+15558880004',
          To: '+15559997777',
          Body: 'Unconfigured workspace SMS',
        },
        'any_token'
      );

      assert(
        resDirectMissingCfg.handled === true &&
          resUnconfiguredHttp.status === 401 &&
          outboundTwilioCalls.length === callsBefore,
        '4. Missing provider configuration or unconfigured workspace fails safely without sending automatic SMS replies',
        `directHandled=${resDirectMissingCfg.handled}, httpStatus=${resUnconfiguredHttp.status}, callsDelta=${
          outboundTwilioCalls.length - callsBefore
        }`
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

runTwilioAutoReplyTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

