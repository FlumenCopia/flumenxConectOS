// Force an isolated ephemeral test database before loading env/db config
process.env.MONGODB_URI =
  process.env.CRIT06_TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/flumenx_qa_crit06';

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
import { BroadcastCampaign } from '../models/BroadcastCampaign';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import {
  decryptProviderConfiguration,
  decryptProviderSecret,
  isEncryptedValue,
} from '../utils/crypto';
import { ProviderManager } from '../services/providers/provider.manager';
import { InstagramProvider } from '../services/providers/instagram.provider';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface MockGraphCall {
  url: string;
  method: string;
  authorization?: string;
  contentType?: string;
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

const extractAuthCookie = (res: Response): string => {
  const rawCookie = res.headers.get('set-cookie');
  return rawCookie ? rawCookie.split(';')[0] : '';
};

const runCrit06Tests = async () => {
  console.log('\n==================================================');
  console.log('Running CRIT-06 Meta Credential & Tenant Isolation Suite');
  console.log('==================================================\n');

  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }

  if (mongoose.connection.name !== 'flumenx_qa_crit06') {
    throw new Error(
      `Refusing to run destructive test fixture setup on non-isolated database: ${mongoose.connection.name}`
    );
  }

  await seedDatabase();

  // Clean ephemeral test collections
  await Promise.all([
    CommunicationProvider.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Contact.deleteMany({}),
    BroadcastCampaign.deleteMany({}),
    Client.deleteMany({ slug: /^crit06-/ }),
    User.deleteMany({ email: /^crit06-/ }),
  ]);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  const previousMetaAppSecret = process.env.META_APP_SECRET;
  const previousMetaIgAppSecret = process.env.META_INSTAGRAM_APP_SECRET;
  const testMetaAppSecret = 'test_crit06_meta_app_secret_only';
  process.env.META_APP_SECRET = testMetaAppSecret;
  delete process.env.META_INSTAGRAM_APP_SECRET;

  const signMetaBody = (rawJson: string): string =>
    `sha256=${crypto.createHmac('sha256', testMetaAppSecret).update(Buffer.from(rawJson, 'utf8')).digest('hex')}`;

  // Intercept all outbound Meta Graph API HTTP calls so zero live requests leave the process
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Pass local HTTP test server requests straight through native fetch
    if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith(`http://localhost:${port}`)) {
      return nativeFetch(input as any, init);
    }

    if (!url.includes('graph.facebook.com')) {
      throw new Error(`Unexpected external fetch intercepted in CRIT-06 test suite: ${url}`);
    }

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const method = (init?.method || 'GET').toUpperCase();
    const bodyText = typeof init?.body === 'string' ? init.body : init?.body ? '[binary-or-form-body]' : undefined;

    graphCalls.push({
      url,
      method,
      authorization: headers.get('authorization') || undefined,
      contentType: headers.get('content-type') || undefined,
      body: bodyText,
    });

    // Mock WhatsApp message templates listing
    if (url.includes('/message_templates')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 'tpl_alpha_001',
              name: 'alpha_welcome_tpl',
              status: 'APPROVED',
              category: 'MARKETING',
              language: 'en_US',
              components: [
                { type: 'BODY', text: 'Hello {{1}}, welcome to Alpha Studio!' },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mock WhatsApp business profile GET / POST
    if (url.includes('/whatsapp_business_profile')) {
      return new Response(
        JSON.stringify({
          data: [
            {
              about: 'Alpha Workspace Support',
              description: 'Isolated tenant A WhatsApp desk',
              websites: ['https://alpha.example.test'],
              vertical: 'PROF_SERVICES',
            },
          ],
          success: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mock WhatsApp profile picture resumable upload session + binary upload
    if (url.includes('/uploads') && !url.includes('upload:')) {
      return new Response(JSON.stringify({ id: 'upload:alpha_session_01' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/upload:alpha_session_01')) {
      return new Response(JSON.stringify({ h: '4::alphaMockUploadHandle' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mock WhatsApp phone health GET
    if (url.includes('fields=verified_name')) {
      return new Response(
        JSON.stringify({
          id: 'wa_phone_alpha_001',
          verified_name: 'Alpha Studio WA',
          display_phone_number: '+1 555-010-0001',
          quality_rating: 'GREEN',
          status: 'CONNECTED',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mock outbound Graph API message dispatch (WhatsApp, IG, Messenger)
    if (url.endsWith('/messages')) {
      return new Response(
        JSON.stringify({
          messages: [{ id: 'wamid.mock_alpha_outbound_001' }],
          message_id: 'mid.mock_alpha_outbound_001',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mock IG/Messenger user profile lookup
    if (url.includes('fields=name,username,profile_pic') || url.includes('fields=first_name,last_name,profile_pic')) {
      return new Response(
        JSON.stringify({
          name: 'Mock Meta Contact',
          username: 'mock_meta_user',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ id: 'mock_graph_ok', success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    // Seed Workspaces A (configured) and B (unconfigured)
    const clientA = await Client.create({
      name: 'Alpha Workspace',
      slug: 'crit06-alpha-workspace',
      status: 'active',
      health: 'healthy',
    });
    const clientB = await Client.create({
      name: 'Beta Workspace',
      slug: 'crit06-beta-workspace',
      status: 'active',
      health: 'healthy',
    });

    const clientAId = clientA._id.toString();
    const clientBId = clientB._id.toString();
    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    if (!clientAdminRole) {
      throw new Error('client_admin role missing from seeded database');
    }

    const passwordHash = await bcrypt.hash(env.INITIAL_ADMIN_PASSWORD, 10);
    const adminA = await User.create({
      name: 'Alpha Admin',
      email: 'crit06-alpha-admin@example.test',
      passwordHash,
      isSuperAdmin: false,
      status: 'active',
    });
    const adminB = await User.create({
      name: 'Beta Admin',
      email: 'crit06-beta-admin@example.test',
      passwordHash,
      isSuperAdmin: false,
      status: 'active',
    });

    await ClientMembership.create([
      { clientId: clientA._id, userId: adminA._id, roleId: clientAdminRole._id, status: 'active' },
      { clientId: clientB._id, userId: adminB._id, roleId: clientAdminRole._id, status: 'active' },
    ]);

    // Authenticate Alpha Admin and Beta Admin
    const loginA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'crit06-alpha-admin@example.test',
        password: env.INITIAL_ADMIN_PASSWORD,
      }),
    });
    const alphaCookie = extractAuthCookie(loginA);

    const loginB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'crit06-beta-admin@example.test',
        password: env.INITIAL_ADMIN_PASSWORD,
      }),
    });
    const betaCookie = extractAuthCookie(loginB);

    assert(Boolean(alphaCookie && betaCookie), 'Authenticate Workspace A & B admins');

    // =========================================================================
    // GROUP 1: Provider Encryption at Rest & Masked API Responses
    // =========================================================================
    const mockWaToken = 'MOCK_WA_TOKEN_ALPHA_SECRET_123';
    const mockIgToken = 'MOCK_IG_TOKEN_ALPHA_SECRET_456';
    const mockFbToken = 'MOCK_FB_TOKEN_ALPHA_SECRET_789';

    const saveWaRes = await fetch(`${baseUrl}/conversations/providers?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
      body: JSON.stringify({
        providerType: 'whatsapp',
        displayName: 'Alpha WhatsApp Cloud',
        isDefault: true,
        configuration: {
          phoneNumberId: 'wa_phone_alpha_001',
          wabaId: 'waba_alpha_001',
          appId: 'app_alpha_001',
          accessToken: mockWaToken,
        },
      }),
    });
    const saveWaJson: any = await saveWaRes.json();
    assert(saveWaRes.status === 201 || saveWaRes.status === 200, 'Save WhatsApp provider for Workspace A');
    assert(
      saveWaJson?.data?.configuration?.accessToken === '••••••••' &&
        !JSON.stringify(saveWaJson).includes(mockWaToken),
      'POST /conversations/providers masks secret accessToken in response'
    );

    const getProvidersRes = await fetch(`${baseUrl}/conversations/providers?clientId=${clientAId}`, {
      headers: { Cookie: alphaCookie },
    });
    const getProvidersJson: any = await getProvidersRes.json();
    const returnedWa = (getProvidersJson?.data || []).find((p: any) => p.providerType === 'whatsapp');
    assert(
      getProvidersRes.status === 200 &&
        returnedWa?.configuration?.accessToken === '••••••••' &&
        returnedWa?.configuration?.phoneNumberId === 'wa_phone_alpha_001' &&
        returnedWa?.configuration?.wabaId === 'waba_alpha_001' &&
        returnedWa?.configuration?.appId === 'app_alpha_001',
      'GET /conversations/providers masks secret token while returning public identifiers'
    );

    const storedWaDoc = await CommunicationProvider.findOne({
      clientId: clientA._id,
      providerType: 'whatsapp',
    }).lean();
    assert(
      Boolean(
        storedWaDoc &&
          isEncryptedValue(storedWaDoc.configuration?.accessToken) &&
          storedWaDoc.configuration?.accessToken !== mockWaToken &&
          decryptProviderSecret(storedWaDoc.configuration?.accessToken) === mockWaToken
      ),
      'CommunicationProvider stores accessToken AES-256-GCM encrypted at rest and decrypts accurately'
    );

    // Updating provider with masked placeholder keeps encrypted secret intact
    const preserveMaskRes = await fetch(`${baseUrl}/conversations/providers?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
      body: JSON.stringify({
        providerType: 'whatsapp',
        displayName: 'Alpha WhatsApp Cloud Updated',
        isDefault: true,
        configuration: {
          phoneNumberId: 'wa_phone_alpha_001',
          wabaId: 'waba_alpha_001',
          appId: 'app_alpha_001',
          accessToken: '••••••••',
        },
      }),
    });
    const storedAfterMaskUpdate = await CommunicationProvider.findOne({
      clientId: clientA._id,
      providerType: 'whatsapp',
    }).lean();
    assert(
      preserveMaskRes.status === 200 &&
        decryptProviderSecret(storedAfterMaskUpdate?.configuration?.accessToken) === mockWaToken,
      'Submitting masked placeholder "••••••••" preserves stored encrypted secret'
    );

    // Verify legacy plaintext DB doc compatibility
    const legacyDecrypted = decryptProviderConfiguration({
      phoneNumberId: 'legacy_phone',
      accessToken: 'LEGACY_PLAIN_VALUE',
    });
    assert(
      legacyDecrypted.accessToken === 'LEGACY_PLAIN_VALUE',
      'decryptProviderConfiguration remains backward compatible with legacy unencrypted config values'
    );

    // Save Instagram & Messenger providers for Workspace A too
    await fetch(`${baseUrl}/conversations/providers?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
      body: JSON.stringify({
        providerType: 'meta_instagram',
        displayName: 'Alpha Instagram',
        isDefault: true,
        configuration: {
          instagramAccountId: 'ig_alpha_001',
          pageAccessToken: mockIgToken,
        },
      }),
    });
    await fetch(`${baseUrl}/conversations/providers?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
      body: JSON.stringify({
        providerType: 'meta_messenger',
        displayName: 'Alpha Messenger',
        isDefault: true,
        configuration: {
          pageId: 'fb_alpha_001',
          pageAccessToken: mockFbToken,
        },
      }),
    });

    // =========================================================================
    // GROUP 2: Scenario A — Configured Workspace A Behaviour (Mocked Graph API)
    // =========================================================================
    graphCalls.length = 0;

    const tplResA = await fetch(`${baseUrl}/conversations/templates?clientId=${clientAId}`, {
      headers: { Cookie: alphaCookie },
    });
    const tplJsonA: any = await tplResA.json();
    assert(
      tplResA.status === 200 &&
        tplJsonA?.data?.configured === true &&
        Array.isArray(tplJsonA?.data?.templates) &&
        tplJsonA.data.templates.some((t: any) => t.name === 'alpha_welcome_tpl') &&
        graphCalls.some(
          (c) =>
            c.url.includes('/waba_alpha_001/message_templates') &&
            c.authorization === `Bearer ${mockWaToken}`
        ),
      'Scenario A: GET /templates queries Workspace A wabaId & encrypted token'
    );

    graphCalls.length = 0;
    const profResA = await fetch(`${baseUrl}/conversations/whatsapp/profile?clientId=${clientAId}`, {
      headers: { Cookie: alphaCookie },
    });
    const profJsonA: any = await profResA.json();
    assert(
      profResA.status === 200 &&
        profJsonA?.data?.configured === true &&
        profJsonA?.data?.profile?.about === 'Alpha Workspace Support' &&
        graphCalls.some(
          (c) =>
            c.url.includes('/wa_phone_alpha_001/whatsapp_business_profile') &&
            c.authorization === `Bearer ${mockWaToken}`
        ),
      'Scenario A: GET /whatsapp/profile queries Workspace A phoneNumberId & token'
    );

    graphCalls.length = 0;
    const healthResA = await fetch(`${baseUrl}/conversations/whatsapp/health?clientId=${clientAId}`, {
      headers: { Cookie: alphaCookie },
    });
    const healthJsonA: any = await healthResA.json();
    assert(
      healthResA.status === 200 &&
        healthJsonA?.data?.configured === true &&
        healthJsonA?.data?.health?.verified_name === 'Alpha Studio WA' &&
        graphCalls.some(
          (c) =>
            c.url.includes('/wa_phone_alpha_001?fields=verified_name') &&
            c.authorization === `Bearer ${mockWaToken}`
        ),
      'Scenario A: GET /whatsapp/health queries Workspace A phoneNumberId & token'
    );

    graphCalls.length = 0;
    const picResA = await fetch(`${baseUrl}/conversations/whatsapp/profile-picture?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
      body: JSON.stringify({
        base64Data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        mimeType: 'image/png',
        fileName: 'logo.png',
      }),
    });
    assert(
      picResA.status === 200 &&
        graphCalls.some(
          (c) =>
            c.url.includes('/app_alpha_001/uploads') &&
            c.authorization === `Bearer ${mockWaToken}` &&
            !c.url.includes('access_token=')
        ) &&
        graphCalls.some(
          (c) =>
            c.url.includes('/wa_phone_alpha_001/whatsapp_business_profile') &&
            c.method === 'POST' &&
            c.authorization === `Bearer ${mockWaToken}`
        ),
      'Scenario A: POST /whatsapp/profile-picture uses Workspace A appId & Authorization Bearer header (no token in URL query)'
    );

    // Outbound message via Workspace A providers for WhatsApp, Instagram, Messenger
    graphCalls.length = 0;
    const contactA = await Contact.create({
      clientId: clientA._id,
      name: 'Alpha Lead',
      phone: '919876543210',
      metadata: {
        instagramId: 'ig_sender_901',
        messengerId: 'fb_sender_902',
      },
    });
    const convWaA = await Conversation.create({
      clientId: clientA._id,
      contactId: contactA._id,
      channel: 'whatsapp',
      subject: 'Alpha WA Thread',
    });

    const sendWaResA = await fetch(`${baseUrl}/conversations/${convWaA._id}/messages?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
      body: JSON.stringify({
        channel: 'whatsapp',
        body: 'Hello from Alpha workspace',
      }),
    });
    assert(
      sendWaResA.status === 201 &&
        graphCalls.some(
          (c) =>
            c.url.includes('/wa_phone_alpha_001/messages') &&
            c.authorization === `Bearer ${mockWaToken}`
        ),
      'Scenario A: Outbound WhatsApp message dispatches with Workspace A phoneNumberId & token'
    );

    // Verify IG & Messenger adapters require configured metadata and never send miscarchive/misc_website_view
    graphCalls.length = 0;
    const igAdapterA = await ProviderManager.getProvider(clientAId, 'meta_instagram');
    const fbAdapterA = await ProviderManager.getProvider(clientAId, 'meta_messenger');
    await igAdapterA.sendMessage({ to: 'ig_sender_901', channel: 'meta_instagram', body: 'IG plain reply' });
    await fbAdapterA.sendMessage({ to: 'fb_sender_902', channel: 'meta_messenger', body: 'FB plain reply' });
    assert(
      graphCalls.some(
        (c) =>
          c.url.includes('/ig_alpha_001/messages') &&
          c.authorization === `Bearer ${mockIgToken}` &&
          !c.body?.includes('miscarchive') &&
          !c.body?.includes('misc_website_view')
      ) &&
        graphCalls.some(
          (c) =>
            c.url.includes('/fb_alpha_001/messages') &&
            c.authorization === `Bearer ${mockFbToken}` &&
            !c.body?.includes('miscarchive') &&
            !c.body?.includes('misc_website_view')
        ),
      'Scenario A: Instagram & Messenger adapters use Workspace A IDs/tokens with zero miscarchive payloads'
    );

    // Verify IG template mode without websiteUrl falls back to plain text instead of hardcoded miscarchive card;
    // with explicit websiteUrl metadata, sends dynamic template card for Workspace A
    graphCalls.length = 0;
    const igWithoutUrl = await igAdapterA.sendMessage({
      to: 'ig_sender_901',
      channel: 'meta_instagram',
      body: 'Plain fallback message',
      metadata: { templateName: 'promo_tpl' },
    });
    const igWithUrl = await igAdapterA.sendMessage({
      to: 'ig_sender_901',
      channel: 'meta_instagram',
      body: 'Dynamic card fallback',
      metadata: { templateName: 'promo_tpl', websiteUrl: 'https://alpha.example.test' },
    });
    assert(
      igWithoutUrl.success &&
        graphCalls.some(
          (c) =>
            c.url.includes('/ig_alpha_001/messages') &&
            c.body?.includes('Plain fallback message') &&
            !c.body?.includes('miscarchive') &&
            !c.body?.includes('"template_type":"generic"')
        ) &&
        igWithUrl.success &&
        graphCalls.some(
          (c) =>
            c.url.includes('/ig_alpha_001/messages') &&
            c.body?.includes('"template_type":"generic"') &&
            c.body?.includes('https://alpha.example.test') &&
            !c.body?.includes('miscarchive')
        ),
      'Instagram template mode omits hardcoded miscarchive card and uses workspace websiteUrl when provided'
    );

    // =========================================================================
    // GROUP 3: Scenario B — Unconfigured Workspace B (Zero External Requests)
    // =========================================================================
    graphCalls.length = 0;

    const tplResB = await fetch(`${baseUrl}/conversations/templates?clientId=${clientBId}`, {
      headers: { Cookie: betaCookie },
    });
    const tplJsonB: any = await tplResB.json();
    assert(
      tplResB.status === 200 &&
        tplJsonB?.data?.configured === false &&
        Array.isArray(tplJsonB?.data?.templates) &&
        tplJsonB.data.templates.length === 0,
      'Scenario B: Unconfigured Workspace B GET /templates returns { configured: false, templates: [] }'
    );

    const profResB = await fetch(`${baseUrl}/conversations/whatsapp/profile?clientId=${clientBId}`, {
      headers: { Cookie: betaCookie },
    });
    const profJsonB: any = await profResB.json();
    assert(
      profResB.status === 200 &&
        profJsonB?.data?.configured === false &&
        profJsonB?.data?.profile === null,
      'Scenario B: Unconfigured Workspace B GET /whatsapp/profile returns { configured: false, profile: null }'
    );

    const healthResB = await fetch(`${baseUrl}/conversations/whatsapp/health?clientId=${clientBId}`, {
      headers: { Cookie: betaCookie },
    });
    const healthJsonB: any = await healthResB.json();
    assert(
      healthResB.status === 200 &&
        healthJsonB?.data?.configured === false &&
        healthJsonB?.data?.health === null,
      'Scenario B: Unconfigured Workspace B GET /whatsapp/health returns { configured: false, health: null }'
    );

    const updateProfResB = await fetch(`${baseUrl}/conversations/whatsapp/profile?clientId=${clientBId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: betaCookie },
      body: JSON.stringify({ about: 'Should fail safely' }),
    });
    assert(
      updateProfResB.status >= 400 && updateProfResB.status < 500,
      'Scenario B: Unconfigured Workspace B POST /whatsapp/profile returns 4xx without falling back'
    );

    const adapterWaB = await ProviderManager.getProvider(clientBId, 'whatsapp');
    const adapterIgB = await ProviderManager.getProvider(clientBId, 'meta_instagram');
    const adapterFbB = await ProviderManager.getProvider(clientBId, 'meta_messenger');
    assert(
      adapterWaB.providerType === 'mock' &&
        adapterIgB.providerType === 'mock' &&
        adapterFbB.providerType === 'mock',
      'Scenario B: ProviderManager falls back to Mock adapter for unconfigured Workspace B instead of Workspace A providers'
    );

    assert(
      graphCalls.length === 0,
      `Scenario B: Unconfigured Workspace B triggers zero external Meta Graph API calls (observed: ${graphCalls.length})`
    );

    // =========================================================================
    // GROUP 4: Scenario C — Cross-Workspace Authorization (403 Forbidden)
    // =========================================================================
    graphCalls.length = 0;

    const crossGetProv = await fetch(`${baseUrl}/conversations/providers?clientId=${clientAId}`, {
      headers: { Cookie: betaCookie },
    });
    const crossSaveProv = await fetch(`${baseUrl}/conversations/providers?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: betaCookie },
      body: JSON.stringify({
        providerType: 'whatsapp',
        displayName: 'Hijacked',
        configuration: { accessToken: 'hijack', phoneNumberId: '1' },
      }),
    });
    const crossTpl = await fetch(`${baseUrl}/conversations/templates?clientId=${clientAId}`, {
      headers: { Cookie: betaCookie },
    });
    const crossProf = await fetch(`${baseUrl}/conversations/whatsapp/profile?clientId=${clientAId}`, {
      headers: { Cookie: betaCookie },
    });
    const crossHealth = await fetch(`${baseUrl}/conversations/whatsapp/health?clientId=${clientAId}`, {
      headers: { Cookie: betaCookie },
    });
    const crossSendMsg = await fetch(`${baseUrl}/conversations/${convWaA._id}/messages?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: betaCookie },
      body: JSON.stringify({ channel: 'whatsapp', body: 'Unauthorized cross-tenant attempt' }),
    });
    const crossBroadcast = await fetch(`${baseUrl}/broadcasts?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: betaCookie },
      body: JSON.stringify({
        name: 'Hijack Blast',
        channel: 'whatsapp',
        messageBody: 'Unauthorized blast',
        recipients: [{ name: 'Victim', phone: '919999999999' }],
      }),
    });

    assert(
      crossGetProv.status === 403 &&
        crossSaveProv.status === 403 &&
        crossTpl.status === 403 &&
        crossProf.status === 403 &&
        crossHealth.status === 403 &&
        crossSendMsg.status === 403 &&
        crossBroadcast.status === 403 &&
        graphCalls.length === 0,
      'Scenario C: Workspace B Admin receives 403 across all Workspace A endpoints with zero Graph API calls'
    );

    // =========================================================================
    // GROUP 5: Scenario D — Broadcast Provider Selection Isolation
    // =========================================================================
    graphCalls.length = 0;
    const broadcastResA = await fetch(`${baseUrl}/broadcasts?clientId=${clientAId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
      body: JSON.stringify({
        name: 'Alpha Configured Campaign',
        channel: 'whatsapp',
        messageBody: 'Hi {{1}}, Alpha offer inside!',
        templateName: 'alpha_welcome_tpl',
        templateLanguage: 'en_US',
        recipients: [{ name: 'Alice', phone: '919876500001' }],
      }),
    });
    assert(
      broadcastResA.status === 201 &&
        graphCalls.some(
          (c) =>
            c.url.includes('/wa_phone_alpha_001/messages') &&
            c.authorization === `Bearer ${mockWaToken}`
        ),
      'Scenario D: Workspace A broadcast dispatches using Workspace A WhatsApp provider credentials'
    );

    graphCalls.length = 0;
    const broadcastResB = await fetch(`${baseUrl}/broadcasts?clientId=${clientBId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: betaCookie },
      body: JSON.stringify({
        name: 'Beta Mock Campaign',
        channel: 'whatsapp',
        messageBody: 'Hi {{1}}, Beta internal test!',
        recipients: [{ name: 'Bob', phone: '919876500002' }],
      }),
    });
    assert(
      broadcastResB.status === 201 && graphCalls.length === 0,
      'Scenario D: Unconfigured Workspace B broadcast uses Mock provider with zero Meta Graph API calls'
    );

    // =========================================================================
    // GROUP 6: Scenario E — Webhook-to-Workspace Mapping & No Fallback
    // =========================================================================
    graphCalls.length = 0;

    // 6a. Unknown WhatsApp phone_number_id must be ignored cleanly (no fallback to Workspace A)
    const unknownWaPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_unknown_999',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'wa_phone_unknown_999' },
                contacts: [{ wa_id: '919900001111', profile: { name: 'Stranger WA' } }],
                messages: [
                  {
                    id: 'wamid.unknown_999',
                    from: '919900001111',
                    type: 'text',
                    text: { body: 'Should be ignored' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const unknownWaWebhookRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signMetaBody(unknownWaPayload),
      },
      body: unknownWaPayload,
    });
    const unknownWaWebhookJson: any = await unknownWaWebhookRes.json();
    const leakedUnknownWaMsg = await Message.findOne({ externalMessageId: 'wamid.unknown_999' });
    assert(
      unknownWaWebhookRes.status === 200 &&
        Array.isArray(unknownWaWebhookJson?.data?.results) &&
        unknownWaWebhookJson.data.results.length === 0 &&
        !leakedUnknownWaMsg &&
        graphCalls.length === 0,
      'Scenario E: Unknown WhatsApp phone_number_id webhook is rejected without cross-tenant fallback'
    );

    // 6b. Unknown Instagram recipient ID must be ignored cleanly
    const unknownIgPayload = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'ig_unknown_999',
          messaging: [
            {
              sender: { id: 'ig_stranger_1' },
              recipient: { id: 'ig_unknown_999' },
              message: { mid: 'ig_mid_unknown_999', text: 'Should be ignored' },
            },
          ],
        },
      ],
    });
    const unknownIgWebhookRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signMetaBody(unknownIgPayload),
      },
      body: unknownIgPayload,
    });
    const unknownIgWebhookJson: any = await unknownIgWebhookRes.json();
    const leakedUnknownIgMsg = await Message.findOne({ externalMessageId: 'ig_mid_unknown_999' });
    assert(
      unknownIgWebhookRes.status === 200 &&
        Array.isArray(unknownIgWebhookJson?.data?.results) &&
        unknownIgWebhookJson.data.results.length === 0 &&
        !leakedUnknownIgMsg &&
        graphCalls.length === 0,
      'Scenario E: Unknown Instagram recipient webhook is rejected without cross-tenant fallback'
    );

    // 6c. Unknown Messenger page ID must be ignored cleanly
    const unknownFbPayload = JSON.stringify({
      object: 'page',
      entry: [
        {
          id: 'fb_unknown_999',
          messaging: [
            {
              sender: { id: 'fb_stranger_1' },
              recipient: { id: 'fb_unknown_999' },
              message: { mid: 'fb_mid_unknown_999', text: 'Should be ignored' },
            },
          ],
        },
      ],
    });
    const unknownFbWebhookRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signMetaBody(unknownFbPayload),
      },
      body: unknownFbPayload,
    });
    const unknownFbWebhookJson: any = await unknownFbWebhookRes.json();
    const leakedUnknownFbMsg = await Message.findOne({ externalMessageId: 'fb_mid_unknown_999' });
    assert(
      unknownFbWebhookRes.status === 200 &&
        Array.isArray(unknownFbWebhookJson?.data?.results) &&
        unknownFbWebhookJson.data.results.length === 0 &&
        !leakedUnknownFbMsg &&
        graphCalls.length === 0,
      'Scenario E: Unknown Messenger recipient webhook is rejected without cross-tenant fallback'
    );

    // 6d. Matched Workspace A WhatsApp webhook routes strictly to clientA and triggers ZERO blind auto-reply
    graphCalls.length = 0;
    const validWaPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_alpha_001',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'wa_phone_alpha_001' },
                contacts: [{ wa_id: '919911223344', profile: { name: 'Alpha Inbound Customer' } }],
                messages: [
                  {
                    id: 'wamid.alpha_inbound_001',
                    from: '919911223344',
                    type: 'text',
                    text: { body: 'Interested in pricing' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const validWaWebhookRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signMetaBody(validWaPayload),
      },
      body: validWaPayload,
    });
    const validWaWebhookJson: any = await validWaWebhookRes.json();
    const routedWaMsg = await Message.findOne({ externalMessageId: 'wamid.alpha_inbound_001' });
    assert(
      validWaWebhookRes.status === 200 &&
        validWaWebhookJson?.data?.results?.length === 1 &&
        routedWaMsg?.clientId?.toString() === clientAId &&
        graphCalls.length === 0,
      'Scenario E: Valid Workspace A WhatsApp webhook routes to Workspace A and disables default miscarchive auto-reply'
    );

    // 6e. Matched Workspace A Instagram webhook fetches profile via Bearer header (not query string) & respects default off auto-reply
    graphCalls.length = 0;
    const validIgPayload = JSON.stringify({
      object: 'instagram',
      entry: [
        {
          id: 'ig_alpha_001',
          messaging: [
            {
              sender: { id: 'ig_customer_555' },
              recipient: { id: 'ig_alpha_001' },
              message: { mid: 'ig_mid_alpha_001', text: 'DM question' },
            },
          ],
        },
      ],
    });
    const validIgWebhookRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signMetaBody(validIgPayload),
      },
      body: validIgPayload,
    });
    const validIgWebhookJson: any = await validIgWebhookRes.json();
    const routedIgMsg = await Message.findOne({ externalMessageId: 'ig_mid_alpha_001' });
    assert(
      validIgWebhookRes.status === 200 &&
        validIgWebhookJson?.data?.results?.length === 1 &&
        routedIgMsg?.clientId?.toString() === clientAId &&
        graphCalls.some(
          (c) =>
            c.url.includes('/ig_customer_555?fields=name,username,profile_pic') &&
            c.authorization === `Bearer ${mockIgToken}` &&
            !c.url.includes('access_token=')
        ) &&
        !graphCalls.some((c) => c.url.endsWith('/messages')),
      'Scenario E: Valid Workspace A Instagram webhook uses Bearer header for profile fetch and disables default auto-reply'
    );

    // 6f. Opt-in auto-reply only triggers when providerDoc.configuration.autoReplyEnabled === true
    await CommunicationProvider.updateOne(
      { clientId: clientA._id, providerType: 'whatsapp' },
      {
        $set: {
          'configuration.autoReplyEnabled': true,
          'configuration.autoReplyMessage': 'Alpha custom acknowledgement',
        },
      }
    );
    graphCalls.length = 0;
    const optInWaPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_alpha_001',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'wa_phone_alpha_001' },
                contacts: [{ wa_id: '919911223344', profile: { name: 'Alpha Inbound Customer' } }],
                messages: [
                  {
                    id: 'wamid.alpha_inbound_002',
                    from: '919911223344',
                    type: 'text',
                    text: { body: 'Follow up question' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const optInWaWebhookRes = await fetch(`${baseUrl}/conversations/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signMetaBody(optInWaPayload),
      },
      body: optInWaPayload,
    });
    assert(
      optInWaWebhookRes.status === 200 &&
        graphCalls.some(
          (c) =>
            c.url.includes('/wa_phone_alpha_001/messages') &&
            c.authorization === `Bearer ${mockWaToken}` &&
            c.body?.includes('Alpha custom acknowledgement') &&
            !c.body?.includes('miscarchive') &&
            !c.body?.includes('misc_website_view')
        ),
      'Scenario E: Opt-in autoReplyEnabled sends workspace-configured message via Workspace A credentials'
    );

    // Scenario F: Instagram outbound /me/messages fallback, IGAA graph.instagram.com routing & missing IGSID guard
    {
      const savedMockFetch = globalThis.fetch;
      const fallbackUrls: string[] = [];
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.startsWith('https://graph.facebook.com/') || url.startsWith('https://graph.instagram.com/')) {
          fallbackUrls.push(url);
          if (url.endsWith('/ig_alpha_001/messages')) {
            return new Response(
              JSON.stringify({
                error: { message: '(#100) The requested user cannot be found.', code: 100 },
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
          if (url === 'https://graph.facebook.com/v21.0/me/messages') {
            return new Response(
              JSON.stringify({ message_id: 'mid.me_fallback_001' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          if (url.startsWith('https://graph.instagram.com/v21.0/')) {
            return new Response(
              JSON.stringify({ message_id: 'mid.ig_login_001' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
        return savedMockFetch(input as any, init);
      }) as typeof fetch;

      try {
        const igFallbackResult = await igAdapterA.sendMessage({
          to: 'ig_sender_901',
          channel: 'meta_instagram',
          body: 'Reply via /me/messages fallback',
        });
        assert(
          igFallbackResult.success === true &&
            igFallbackResult.externalMessageId === 'mid.me_fallback_001' &&
            fallbackUrls.includes('https://graph.facebook.com/v21.0/ig_alpha_001/messages') &&
            fallbackUrls.includes('https://graph.facebook.com/v21.0/me/messages'),
          'Scenario F: InstagramProvider falls back cleanly to /me/messages when /{igAccountId}/messages returns #100'
        );

        const igLoginProvider = new InstagramProvider({
          instagramAccountId: 'ig_login_acct_001',
          pageAccessToken: 'IGAA_test_instagram_login_token',
        });
        const igLoginResult = await igLoginProvider.sendMessage({
          to: 'ig_scoped_login_01',
          channel: 'meta_instagram',
          body: 'Hello via graph.instagram.com',
        });
        assert(
          igLoginResult.success === true &&
            igLoginResult.externalMessageId === 'mid.ig_login_001' &&
            fallbackUrls.includes('https://graph.instagram.com/v21.0/ig_login_acct_001/messages'),
          'Scenario F: InstagramProvider uses graph.instagram.com for IGAA Instagram Login tokens'
        );
      } finally {
        globalThis.fetch = savedMockFetch;
      }

      // Phone-only contact must fail safely without dispatching phone number as Instagram recipient ID
      graphCalls.length = 0;
      const phoneOnlyContact = await Contact.create({
        clientId: clientA._id,
        name: 'Phone Only Lead',
        phone: '918888777666',
      });
      const phoneOnlyConv = await Conversation.create({
        clientId: clientA._id,
        contactId: phoneOnlyContact._id,
        channel: 'whatsapp',
        subject: 'Phone Only Thread',
      });
      const missingIgsidRes = await fetch(
        `${baseUrl}/conversations/${phoneOnlyConv._id}/messages?clientId=${clientAId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
          body: JSON.stringify({
            channel: 'meta_instagram',
            body: 'Attempt IG reply on phone-only contact',
          }),
        }
      );
      const missingIgsidJson = (await missingIgsidRes.json()) as any;
      assert(
        missingIgsidRes.status === 201 &&
          missingIgsidJson.data?.deliveryStatus === 'failed' &&
          missingIgsidJson.data?.failureReason?.includes('Instagram recipient user ID is required') &&
          graphCalls.length === 0,
        'Scenario F: MessageService rejects meta_instagram dispatch on phone-only contact without sending phone to Graph API'
      );

      // Contact with instagramScopedId dispatches cleanly via Workspace A IG credentials
      graphCalls.length = 0;
      const igScopedContact = await Contact.create({
        clientId: clientA._id,
        name: 'NIDHIN Test',
        metadata: { instagramScopedId: 'ig_scoped_nidhin_001' },
      });
      const igScopedConv = await Conversation.create({
        clientId: clientA._id,
        contactId: igScopedContact._id,
        channel: 'meta_instagram',
        subject: 'IG chat with NIDHIN Test',
      });
      const igReplyRes = await fetch(
        `${baseUrl}/conversations/${igScopedConv._id}/messages?clientId=${clientAId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: alphaCookie },
          body: JSON.stringify({
            channel: 'meta_instagram',
            body: 'Hello NIDHIN from Inbox',
          }),
        }
      );
      const igReplyJson = (await igReplyRes.json()) as any;
      assert(
        igReplyRes.status === 201 &&
          igReplyJson.data?.deliveryStatus === 'delivered' &&
          graphCalls.some(
            (c) =>
              c.url.includes('/ig_alpha_001/messages') &&
              c.authorization === `Bearer ${mockIgToken}` &&
              c.body?.includes('ig_scoped_nidhin_001')
          ),
        'Scenario F: MessageService delivers meta_instagram reply cleanly using metadata.instagramScopedId'
      );
    }
  } finally {
    if (previousMetaAppSecret !== undefined) process.env.META_APP_SECRET = previousMetaAppSecret;
    else delete process.env.META_APP_SECRET;
    if (previousMetaIgAppSecret !== undefined) process.env.META_INSTAGRAM_APP_SECRET = previousMetaIgAppSecret;
    else delete process.env.META_INSTAGRAM_APP_SECRET;
    globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === 'flumenx_qa_crit06') {
      await mongoose.connection.dropDatabase();
    }
    await disconnectDatabase();
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log('\n--------------------------------------------------');
  console.log(`CRIT-06 Results: ${passedCount} passed, ${failedCount} failed (Total: ${results.length})`);
  console.log('--------------------------------------------------\n');

  if (failedCount > 0) {
    process.exit(1);
  }
};

runCrit06Tests().catch((err) => {
  console.error('CRIT-06 Test Suite fatal error:', err);
  process.exit(1);
});
