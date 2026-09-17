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
import { AdPlatformConnection } from '../models/AdPlatformConnection';
import { AdCampaign } from '../models/AdCampaign';
import { AdSet } from '../models/AdSet';
import { Ad } from '../models/Ad';
import { AdSpendDaily } from '../models/AdSpendDaily';
import { LeadAttribution } from '../models/LeadAttribution';
import { WebsiteForm } from '../models/WebsiteForm';
import { WebsiteFormField } from '../models/WebsiteFormField';
import { FormSubmission } from '../models/FormSubmission';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import { encrypt, decrypt } from '../utils/crypto';
import { AdConnectionService } from '../services/adConnection.service';
import { AdSyncService } from '../services/adSync.service';
import { AdReportingService } from '../services/adReporting.service';
import { AdAttributionService } from '../services/adAttribution.service';

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

const runAdPlatformTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 7 Test Suite');
  console.log('Campaigns & Ad Platform Integrations');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  // Cleanup test artifacts
  await Client.deleteMany({ slug: /^ad-test-/ });
  await AdPlatformConnection.deleteMany({ accountName: /^Test / });
  await AdCampaign.deleteMany({ name: /Test/i });
  await AdSet.deleteMany({ name: /Test/i });
  await Ad.deleteMany({ name: /Test/i });
  await AdSpendDaily.deleteMany({ externalCampaignId: /^test_/ });
  await LeadAttribution.deleteMany({ utmSource: /test/i });
  await Lead.deleteMany({ fullName: /^Ad Test Lead/ });
  await WebsiteForm.deleteMany({ name: /^Ad Test Form/ });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  try {
    let superAdminCookie = '';
    let clientAdminCookie = '';
    let clientStaffCookie = '';
    let clientBAdminCookie = '';

    // Setup 1: Super Admin Login
    console.log('--- Phase 1: Authentication & Test Fixtures Setup ---');
    const saLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: env.INITIAL_ADMIN_EMAIL || 'admin@flumenx.com',
        password: env.INITIAL_ADMIN_PASSWORD || 'SuperAdminPassword123!',
      }),
    });
    const saSetCookie = saLoginRes.headers.get('set-cookie');
    if (saSetCookie) {
      superAdminCookie = saSetCookie.split(';')[0];
    }
    assert(saLoginRes.status === 200, 'Super admin login succeeds for ad test runner');

    // Setup 2: Create Client Workspace A
    const clientASlug = `ad-test-client-a-${Date.now()}`;
    const clientA = await Client.create({
      name: 'Ad Platform Test Client A',
      slug: clientASlug,
      status: 'active',
      settings: { timezone: 'UTC', currency: 'USD' },
    });

    // Setup 3: Create Client Workspace B (For Tenant Isolation Testing)
    const clientBSlug = `ad-test-client-b-${Date.now()}`;
    const clientB = await Client.create({
      name: 'Ad Platform Test Client B',
      slug: clientBSlug,
      status: 'active',
      settings: { timezone: 'UTC', currency: 'USD' },
    });

    // Create Client A Admin & Staff Users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('ClientAdminPass123!', salt);
    const adminUser = await User.create({
      name: 'Client A Admin',
      email: `client-a-admin-${Date.now()}@flumenx.com`,
      passwordHash,
      isSuperAdmin: false,
      status: 'active',
    });
    const staffUser = await User.create({
      name: 'Client A Staff',
      email: `client-a-staff-${Date.now()}@flumenx.com`,
      passwordHash,
      isSuperAdmin: false,
      status: 'active',
    });
    const clientBAdminUser = await User.create({
      name: 'Client B Admin',
      email: `client-b-admin-${Date.now()}@flumenx.com`,
      passwordHash,
      isSuperAdmin: false,
      status: 'active',
    });

    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    const clientStaffRole = await Role.findOne({ slug: 'client_staff' });

    await ClientMembership.create({
      userId: adminUser._id,
      clientId: clientA._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    await ClientMembership.create({
      userId: staffUser._id,
      clientId: clientA._id,
      roleId: clientStaffRole!._id,
      status: 'active',
    });

    await ClientMembership.create({
      userId: clientBAdminUser._id,
      clientId: clientB._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    // Login Client A Admin
    const aLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminUser.email, password: 'ClientAdminPass123!' }),
    });
    clientAdminCookie = aLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

    // Login Client A Staff
    const staffLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: staffUser.email, password: 'ClientAdminPass123!' }),
    });
    clientStaffCookie = staffLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

    // Login Client B Admin
    const bLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clientBAdminUser.email, password: 'ClientAdminPass123!' }),
    });
    clientBAdminCookie = bLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

    assert(Boolean(clientAdminCookie && clientBAdminCookie && clientStaffCookie), 'All client actors authenticated');

    // -----------------------------------------------------------------------------------------
    // Phase 2: AES-256-GCM Cryptographic Security
    // -----------------------------------------------------------------------------------------
    console.log('\n--- Phase 2: AES-256-GCM Encryption & Credential Security ---');
    const secretSample = 'EAABsbCS789SECRET_TOKEN_VALUE_XYZ';
    const encrypted = encrypt(secretSample);
    const decrypted = decrypt(encrypted);
    assert(decrypted === secretSample, 'AES-256-GCM roundtrip encryption/decryption matches perfectly');
    assert(encrypted !== secretSample, 'Ciphertext is transformed into encrypted iv:authTag:ciphertext format');
    assert(encrypted.split(':').length === 3, 'Ciphertext structure includes IV, Auth Tag, and payload');

    // Tampering test
    let tamperingDetected = false;
    try {
      const parts = encrypted.split(':');
      parts[2] = parts[2].substring(0, parts[2].length - 2) + '00';
      decrypt(parts.join(':'));
    } catch {
      tamperingDetected = true;
    }
    assert(tamperingDetected, 'AES-256-GCM authenticated decryption detects cipher tampering');

    // -----------------------------------------------------------------------------------------
    // Phase 3: Ad Platform Connections & Secret Redaction
    // -----------------------------------------------------------------------------------------
    console.log('\n--- Phase 3: Ad Platform Connection Management & Validation ---');

    // Test: Connect Meta Account with mock credentials
    const createMetaRes = await fetch(`${baseUrl}/ads/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
      body: JSON.stringify({
        platform: 'meta',
        accountName: 'Test Meta Ad Account',
        accountId: 'act_100200300400',
        accessToken: 'mock_meta_token_dev_123',
      }),
    });
    const metaConnData = await createMetaRes.json();
    assert(createMetaRes.status === 201, 'Meta Ad Account connection created with 201 Created');
    assert(metaConnData.data.platform === 'meta', 'Connection platform set to meta');
    assert(metaConnData.data.status === 'active', 'Connection verified and set to active');

    // Critical Security Assertion: Verify secrets are NEVER exposed in response
    assert(metaConnData.data.encryptedAccessToken === undefined, 'Raw or encrypted access token is stripped from API response');
    assert(metaConnData.data.accessToken === undefined, 'Plaintext access token is completely absent from API response');

    const metaConnId = metaConnData.data._id;

    // Test: Connect Google Account with mock credentials
    const createGoogleRes = await fetch(`${baseUrl}/ads/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
      body: JSON.stringify({
        platform: 'google',
        accountName: 'Test Google Ads Account',
        accountId: '999-888-7777',
        accessToken: 'mock_google_token_dev_456',
      }),
    });
    const googleConnData = await createGoogleRes.json();
    assert(createGoogleRes.status === 201, 'Google Ads connection created with 201 Created');
    const googleConnId = googleConnData.data._id;

    // Test: Reject Invalid Provider Credentials
    const createInvalidRes = await fetch(`${baseUrl}/ads/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
      body: JSON.stringify({
        platform: 'meta',
        accountName: 'Test Invalid Account',
        accountId: 'act_invalid',
        accessToken: 'mock_invalid_token_sample',
      }),
    });
    assert(createInvalidRes.status === 400, 'Invalid provider credentials rejected with 400 Bad Request');

    // Test: List Connections & Verify Token Redaction in Database Query
    const listConnRes = await fetch(`${baseUrl}/ads/connections`, {
      headers: {
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
    });
    const listConnData = await listConnRes.json();
    assert(listConnRes.status === 200, 'Connections listed successfully');
    assert(listConnData.data.length >= 2, 'Found at least 2 active connections for Client A');
    assert(listConnData.data.every((c: any) => !c.encryptedAccessToken && !c.accessToken), 'All connections in list have credentials stripped');

    // -----------------------------------------------------------------------------------------
    // Phase 4: Strict Multi-Tenant Isolation
    // -----------------------------------------------------------------------------------------
    console.log('\n--- Phase 4: Multi-Tenant Data Isolation ---');

    // Client B attempts to list Client A's connections
    const clientBListRes = await fetch(`${baseUrl}/ads/connections`, {
      headers: {
        Cookie: clientBAdminCookie,
        'x-client-id': clientB._id.toString(),
      },
    });
    const clientBListData = await clientBListRes.json();
    assert(clientBListData.data.length === 0, 'Client B cannot see any connections of Client A');

    // Client B attempts to sync Client A's connection
    const crossTenantSyncRes = await fetch(`${baseUrl}/ads/connections/${metaConnId}/sync`, {
      method: 'POST',
      headers: {
        Cookie: clientBAdminCookie,
        'x-client-id': clientB._id.toString(),
      },
    });
    assert(crossTenantSyncRes.status === 404, 'Cross-tenant connection sync blocked with 404 Not Found');

    // Client B attempts to revoke Client A's connection
    const crossTenantRevokeRes = await fetch(`${baseUrl}/ads/connections/${metaConnId}`, {
      method: 'DELETE',
      headers: {
        Cookie: clientBAdminCookie,
        'x-client-id': clientB._id.toString(),
      },
    });
    assert(crossTenantRevokeRes.status === 404, 'Cross-tenant connection revocation blocked with 404 Not Found');

    // -----------------------------------------------------------------------------------------
    // Phase 5: Read-Only Ad Platform Sync & Idempotency
    // -----------------------------------------------------------------------------------------
    console.log('\n--- Phase 5: Ad Platform Data Synchronization & Idempotency ---');

    // Sync Meta Connection
    const syncMetaRes = await fetch(`${baseUrl}/ads/connections/${metaConnId}/sync`, {
      method: 'POST',
      headers: {
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
    });
    const syncMetaData = await syncMetaRes.json();
    assert(syncMetaRes.status === 200, 'Meta connection sync completed with 200 OK');
    assert(syncMetaData.data.campaignsCount > 0, 'Meta sync imported campaigns');
    assert(syncMetaData.data.adSetsCount > 0, 'Meta sync imported ad sets');
    assert(syncMetaData.data.adsCount > 0, 'Meta sync imported ads');
    assert(syncMetaData.data.dailySpendEntriesCount > 0, 'Meta sync imported daily spend entries');

    // Sync Google Connection
    const syncGoogleRes = await fetch(`${baseUrl}/ads/connections/${googleConnId}/sync`, {
      method: 'POST',
      headers: {
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
    });
    const syncGoogleData = await syncGoogleRes.json();
    assert(syncGoogleRes.status === 200, 'Google Ads connection sync completed with 200 OK');
    assert(syncGoogleData.data.campaignsCount > 0, 'Google sync imported campaigns');

    // Verify Idempotency: Re-sync Meta and verify counts do not multiply
    const initialCampCount = await AdCampaign.countDocuments({ clientId: clientA._id });
    const initialSpendCount = await AdSpendDaily.countDocuments({ clientId: clientA._id });

    const resyncMetaRes = await fetch(`${baseUrl}/ads/connections/${metaConnId}/sync`, {
      method: 'POST',
      headers: {
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
    });
    assert(resyncMetaRes.status === 200, 'Meta re-sync executed successfully');

    const afterCampCount = await AdCampaign.countDocuments({ clientId: clientA._id });
    const afterSpendCount = await AdSpendDaily.countDocuments({ clientId: clientA._id });
    assert(initialCampCount === afterCampCount, 'Idempotency verified: Campaign count unchanged after duplicate sync');
    assert(initialSpendCount === afterSpendCount, 'Idempotency verified: Daily spend entries updated in place without duplication');

    // Partial Failure Handling Test: Connect account with [MOCK_PARTIAL_FAIL]
    const partialConn = await AdConnectionService.createConnection(
      clientA._id.toString(),
      {
        platform: 'meta',
        accountName: 'Partial Warning Account',
        accountId: 'act_partial_123',
        accessToken: 'mock_token_with_[MOCK_PARTIAL_FAIL]_flag',
      }
    );
    const partialSyncRes = await AdSyncService.syncConnection(clientA._id.toString(), partialConn._id.toString());
    assert(partialSyncRes.status === 'partial', 'Sync with warnings flagged as partial status');
    assert(Boolean(partialSyncRes.warnings && partialSyncRes.warnings.length > 0), 'Warnings captured without fatal crash');

    // -----------------------------------------------------------------------------------------
    // Phase 6: Multi-Touch Lead Attribution Engine
    // -----------------------------------------------------------------------------------------
    console.log('\n--- Phase 6: Multi-Touch Lead Attribution Engine ---');

    // Create a CRM Lead for Attribution
    const lead = await Lead.create({
      clientId: clientA._id,
      fullName: 'Ad Test Lead John Doe',
      email: 'john.doe.adtest@example.com',
      phone: '+15551234567',
      stage: 'new',
      estimatedValue: 2500,
    });

    // Touch 1: First-Touch via Meta Ads (with fbclid & UTM)
    const firstTouch = await AdAttributionService.recordLeadAttribution({
      clientId: clientA._id.toString(),
      leadId: lead._id.toString(),
      clickId: 'fbclid_test_unique_click_101',
      utmParams: {
        utmSource: 'facebook',
        utmMedium: 'cpc',
        utmCampaign: 'Meta Retargeting Leads Q3',
      },
      landingPageUrl: 'https://flumenx.com/lead-magnet?utm_source=facebook&utm_medium=cpc&utm_campaign=Meta%20Retargeting%20Leads%20Q3&fbclid=fbclid_test_unique_click_101',
      referrer: 'https://l.facebook.com/',
      attributionSource: 'click_id',
    });

    assert(firstTouch.touchType === 'first_touch', 'First recorded touchpoint tagged as first_touch');
    assert(firstTouch.platform === 'meta', 'Platform correctly detected as meta from fbclid');
    assert(firstTouch.clickId === 'fbclid_test_unique_click_101', 'Click ID captured accurately');

    // Verify CRM Lead was updated on first touch
    const updatedLead = await Lead.findById(lead._id);
    assert(updatedLead?.source === 'meta_ads', 'CRM Lead source automatically set to meta_ads');
    assert(Boolean(updatedLead?.campaignName), 'CRM Lead campaign name updated from attribution');

    // Touch 2: Subsequent Touch via Google Ads (with gclid)
    const secondTouch = await AdAttributionService.recordLeadAttribution({
      clientId: clientA._id.toString(),
      leadId: lead._id.toString(),
      clickId: 'gclid_test_search_intent_202',
      utmParams: {
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'Google Search High-Intent',
      },
      landingPageUrl: 'https://flumenx.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=Google%20Search%20High-Intent&gclid=gclid_test_search_intent_202',
      referrer: 'https://www.google.com/',
      attributionSource: 'click_id',
    });

    assert(secondTouch.touchType === 'last_touch', 'Subsequent touchpoint tagged as last_touch');
    assert(secondTouch.platform === 'google', 'Platform correctly detected as google from gclid');

    // CRITICAL REQUIREMENT: Verify First-Touch Immutability
    const verifiedFirstTouch = await LeadAttribution.findById(firstTouch._id);
    assert(verifiedFirstTouch?.touchType === 'first_touch', 'First-touch record remains permanently first_touch (immutable)');
    assert(verifiedFirstTouch?.clickId === 'fbclid_test_unique_click_101', 'First-touch click ID was not altered');
    assert(verifiedFirstTouch?.platform === 'meta', 'First-touch platform preserved');

    // Touch 3: Third touchpoint (Demotes previous last_touch to multi_touch)
    const thirdTouch = await AdAttributionService.recordLeadAttribution({
      clientId: clientA._id.toString(),
      leadId: lead._id.toString(),
      utmParams: {
        utmSource: 'newsletter',
        utmMedium: 'email',
        utmCampaign: 'August Promotion',
      },
      referrer: '',
    });

    assert(thirdTouch.touchType === 'last_touch', 'Newest touchpoint becomes the new last_touch');
    const prevSecondTouch = await LeadAttribution.findById(secondTouch._id);
    assert(prevSecondTouch?.touchType === 'multi_touch', 'Previous last_touch cleanly transitioned to multi_touch');

    // -----------------------------------------------------------------------------------------
    // Phase 7: Reporting Metrics & Math Integrity
    // -----------------------------------------------------------------------------------------
    console.log('\n--- Phase 7: Reporting Aggregations & Mathematical Integrity ---');

    const summaryRes = await fetch(`${baseUrl}/ads/reporting/summary`, {
      headers: {
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
    });
    const summaryData = await summaryRes.json();
    assert(summaryRes.status === 200, 'Reporting summary endpoint returns 200 OK');
    const rep = summaryData.data;

    assert(rep.totalSpend > 0, 'Total spend aggregated from daily records');
    assert(rep.totalImpressions > 0, 'Total impressions aggregated');
    assert(rep.totalClicks > 0, 'Total clicks aggregated');

    // Math Assertions
    const expectedCtr = Number(((rep.totalClicks / rep.totalImpressions) * 100).toFixed(2));
    assert(Math.abs(rep.ctr - expectedCtr) < 0.1, `CTR mathematical verification passed (${rep.ctr}% vs expected ${expectedCtr}%)`);

    const expectedCpc = Number((rep.totalSpend / rep.totalClicks).toFixed(2));
    assert(Math.abs(rep.cpc - expectedCpc) < 0.1, `CPC mathematical verification passed ($${rep.cpc} vs expected $${expectedCpc})`);

    // Verify Attributed Leads count
    assert(rep.totalAttributedLeads >= 1, 'Distinct attributed CRM leads counted');

    // ROAS Integrity: Lead is in 'new' stage, so no closed revenue exists
    assert(rep.roas === null, 'Mathematical Integrity: ROAS is strictly null when no closed won revenue exists (no fabrication!)');

    // Now mark the lead as 'won' with verified value
    lead.stage = 'won';
    lead.estimatedValue = 5000;
    await lead.save();

    const wonSummary = await AdReportingService.getExecutiveSummary(clientA._id.toString(), {});
    assert(wonSummary.verifiedRevenue === 5000, 'Verified closed revenue accurately summed from won CRM leads');
    assert(wonSummary.roas !== null && wonSummary.roas > 0, `Verified ROAS calculated accurately (${wonSummary.roas}x)`);

    // Time-series test
    const timeSeriesRes = await fetch(`${baseUrl}/ads/reporting/timeseries`, {
      headers: {
        Cookie: clientAdminCookie,
        'x-client-id': clientA._id.toString(),
      },
    });
    const timeSeriesData = await timeSeriesRes.json();
    assert(timeSeriesRes.status === 200, 'Time-series reporting returns 200 OK');
    assert(Array.isArray(timeSeriesData.data) && timeSeriesData.data.length > 0, 'Time-series returns chronological daily entries');

    // -----------------------------------------------------------------------------------------
    // Phase 8: RBAC Permissions for Ads
    // -----------------------------------------------------------------------------------------
    console.log('\n--- Phase 8: Role-Based Access Control (RBAC) ---');

    // Client Staff has ads.view: can read campaigns
    const staffReadCampRes = await fetch(`${baseUrl}/ads/campaigns`, {
      headers: {
        Cookie: clientStaffCookie,
        'x-client-id': clientA._id.toString(),
      },
    });
    assert(staffReadCampRes.status === 200, 'Client Staff with ads.view permission can view campaigns');

    // Client Staff does NOT have ads.manage_connections: cannot create connection
    const staffCreateConnRes = await fetch(`${baseUrl}/ads/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientStaffCookie,
        'x-client-id': clientA._id.toString(),
      },
      body: JSON.stringify({
        platform: 'meta',
        accountName: 'Unauthorized Staff Account',
        accountId: 'act_unauthorized',
        accessToken: 'mock_token_sample_123',
      }),
    });
    assert(staffCreateConnRes.status === 403, 'Client Staff without ads.manage_connections receives 403 Forbidden');

  } catch (err: any) {
    console.error('Unhandled test suite error:', err);
    results.push({ name: 'Suite Execution', passed: false, error: err.message });
  } finally {
    server.close();
    await disconnectDatabase();
  }

  // Summary
  console.log('\n==================================================');
  console.log('Release 7 Test Results Summary');
  console.log('==================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.error(` - ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\nAll Release 7 tests passed successfully!\n');
    process.exit(0);
  }
};

runAdPlatformTests();
