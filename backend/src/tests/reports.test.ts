import http from 'http';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../app';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Permission } from '../models/Permission';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { Lead } from '../models/Lead';
import { Task } from '../models/Task';
import { WebsiteForm } from '../models/WebsiteForm';
import { FormSubmission } from '../models/FormSubmission';
import { AdCampaign } from '../models/AdCampaign';
import { AdSpendDaily } from '../models/AdSpendDaily';
import { LeadAttribution } from '../models/LeadAttribution';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { SavedReport } from '../models/SavedReport';
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

const runReportsTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 9 Test Suite');
  console.log('Reporting & Marketing Analytics Engine');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  // Cleanup test artifacts
  await Client.deleteMany({ slug: /^report-test-/ });
  await User.deleteMany({ email: /^report-test-/ });
  await Lead.deleteMany({ fullName: /^ReportTest/i });
  await Task.deleteMany({ title: /^ReportTest/i });
  await WebsiteForm.deleteMany({ title: /^ReportTest/i });
  await FormSubmission.deleteMany({});
  await AdCampaign.deleteMany({ name: /^ReportTest/i });
  await AdSpendDaily.deleteMany({});
  await LeadAttribution.deleteMany({});
  await Conversation.deleteMany({ subject: /^ReportTest/i });
  await Message.deleteMany({});
  await SavedReport.deleteMany({ name: /^ReportTest/i });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  let clientAId: string;
  let clientBId: string;
  let cookieSuperAdmin: string;
  let cookieAdminA: string;
  let cookieStaffA: string;
  let cookieAdminB: string;

  try {
    // -----------------------------------------------------------------------
    // Setup Test Workspaces & Users
    // -----------------------------------------------------------------------
    const clientA = await Client.create({
      name: 'Report Test Client A',
      slug: 'report-test-client-a',
      status: 'active',
    });
    clientAId = clientA._id.toString();

    const clientB = await Client.create({
      name: 'Report Test Client B',
      slug: 'report-test-client-b',
      status: 'active',
    });
    clientBId = clientB._id.toString();

    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    const clientStaffRole = await Role.findOne({ slug: 'client_staff' });
    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Super Admin User
    const superAdminUser = await User.findOne({ isSuperAdmin: true });
    if (!superAdminUser) throw new Error('Super Admin user not found from seed');

    // Client A Admin (has reports.view, reports.export, reports.manage_saved, reports.view_team - NO reports.view_financial)
    const adminUserA = await User.create({
      name: 'Report Admin A',
      email: 'report-test-admin-a@flumenx.com',
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    await ClientMembership.create({
      userId: adminUserA._id,
      clientId: clientA._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    // Client A Staff (has ONLY reports.view)
    const staffUserA = await User.create({
      name: 'Report Staff A',
      email: 'report-test-staff-a@flumenx.com',
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    await ClientMembership.create({
      userId: staffUserA._id,
      clientId: clientA._id,
      roleId: clientStaffRole!._id,
      status: 'active',
    });

    // Client B Admin
    const adminUserB = await User.create({
      name: 'Report Admin B',
      email: 'report-test-admin-b@flumenx.com',
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    await ClientMembership.create({
      userId: adminUserB._id,
      clientId: clientB._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    // Helper to log in and get cookie
    const getAuthCookie = async (email: string, password = 'Password123!'): Promise<string> => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const rawCookie = res.headers.get('set-cookie');
      if (!rawCookie) throw new Error(`No cookie returned for ${email}`);
      return rawCookie.split(';')[0];
    };

    cookieSuperAdmin = await getAuthCookie(
      superAdminUser.email,
      env.INITIAL_ADMIN_PASSWORD || 'FlumenX@2025!'
    );
    cookieAdminA = await getAuthCookie(adminUserA.email);
    cookieStaffA = await getAuthCookie(staffUserA.email);
    cookieAdminB = await getAuthCookie(adminUserB.email);

    // =======================================================================
    // Section 1: Permission Registry Verification
    // =======================================================================
    console.log('--- Section 1: Permission Registry Verification ---');
    const expectedPerms = [
      'reports.view',
      'reports.export',
      'reports.manage_saved',
      'reports.view_team',
      'reports.view_financial',
    ];
    for (const p of expectedPerms) {
      const exists = await Permission.findOne({ code: p });
      assert(!!exists, `Permission '${p}' exists in system database`);
    }

    const totalPermissions = await Permission.countDocuments();
    assert(
      totalPermissions >= 61,
      `Standard system permissions count is accurate (expected >= 61, got ${totalPermissions})`
    );

    const superAdminRole = await Role.findOne({ slug: 'super_admin' });
    assert(
      superAdminRole!.permissionCodes.includes('reports.view_financial'),
      'Super Admin role includes reports.view_financial'
    );
    assert(
      !clientAdminRole!.permissionCodes.includes('reports.view_financial'),
      'Client Admin role does NOT include reports.view_financial by default'
    );
    assert(
      clientAdminRole!.permissionCodes.includes('reports.view_team'),
      'Client Admin role includes reports.view_team'
    );
    assert(
      clientAdminRole!.permissionCodes.includes('reports.export'),
      'Client Admin role includes reports.export'
    );
    assert(
      clientStaffRole!.permissionCodes.includes('reports.view'),
      'Client Staff role includes reports.view'
    );
    assert(
      !clientStaffRole!.permissionCodes.includes('reports.view_team'),
      'Client Staff role does NOT include reports.view_team'
    );
    assert(
      !clientStaffRole!.permissionCodes.includes('reports.export'),
      'Client Staff role does NOT include reports.export'
    );

    // =======================================================================
    // Section 2: Tenant Resolution & Cross-Tenant Security
    // =======================================================================
    console.log('\n--- Section 2: Tenant Resolution & Cross-Tenant Security ---');

    // Client A admin passing Client B's ID in header must be rejected with 403
    const crossTenantHeaderRes = await fetch(`${baseUrl}/reports/overview`, {
      headers: {
        Cookie: cookieAdminA,
        'x-client-id': clientBId,
      },
    });
    assert(
      crossTenantHeaderRes.status === 403,
      'Tenant resolution rejects client-supplied x-client-id outside user memberships with 403 Forbidden'
    );

    // Client A admin passing Client B's ID in query param must also be rejected
    const crossTenantQueryRes = await fetch(`${baseUrl}/reports/overview?clientId=${clientBId}`, {
      headers: { Cookie: cookieAdminA },
    });
    assert(
      crossTenantQueryRes.status === 403,
      'Tenant resolution rejects client-supplied query clientId outside user memberships with 403 Forbidden'
    );

    // Invalid ObjectId format is rejected with 400
    const invalidFormatRes = await fetch(`${baseUrl}/reports/overview`, {
      headers: {
        Cookie: cookieAdminA,
        'x-client-id': 'invalid-not-an-objectid',
      },
    });
    assert(
      invalidFormatRes.status === 400,
      'Malformed clientId header is rejected with 400 Bad Request'
    );

    // Unauthenticated access rejected with 401
    const unauthRes = await fetch(`${baseUrl}/reports/overview`);
    assert(unauthRes.status === 401, 'Unauthenticated access to reporting API returns 401 Unauthorized');

    // =======================================================================
    // Section 3: Seed Analytics Records for Client A & Client B
    // =======================================================================
    console.log('\n--- Section 3: Seeding Tenant Datasets ---');

    // Client A Leads (including formula injection test cases)
    const now = new Date();
    await Lead.create([
      {
        clientId: clientA._id,
        fullName: 'ReportTest Lead 1',
        email: 'lead1@test.com',
        source: 'meta_ads',
        stage: 'won',
        leadScore: 85,
        scoreTier: 'hot',
        estimatedValue: 1500,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        clientId: clientA._id,
        fullName: '-negative_formula',
        email: 'lead2@test.com',
        source: 'google_ads',
        stage: 'contacted',
        leadScore: 60,
        scoreTier: 'warm',
        estimatedValue: 800,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        // Formula injection test lead
        clientId: clientA._id,
        fullName: '=CMD("calc")',
        email: '@malicious@test.com',
        phone: '+15551234567',
        source: 'organic',
        stage: 'qualified',
        leadScore: 40,
        scoreTier: 'cold',
        estimatedValue: 0,
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
    ]);

    // Client B Leads (should NOT leak into Client A)
    await Lead.create({
      clientId: clientB._id,
      fullName: 'ReportTest Client B Lead',
      email: 'clientb@test.com',
      source: 'referral',
      stage: 'won',
      leadScore: 90,
      scoreTier: 'hot',
      estimatedValue: 50000,
      createdAt: now,
    });

    // Client A Tasks
    const taskA1 = await Task.create({
      clientId: clientA._id,
      title: 'ReportTest Task 1',
      taskType: 'call',
      status: 'completed',
      priority: 'urgent',
      assignedTo: adminUserA._id,
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      slaTargetMinutes: 15,
      slaDeadline: new Date(now.getTime() - 10 * 60 * 1000),
      slaBreached: false,
      completedAt: new Date(now.getTime() - 5 * 60 * 1000),
      disposition: 'contacted_interested',
      createdAt: new Date(now.getTime() - 20 * 60 * 1000),
    });

    const taskA2 = await Task.create({
      clientId: clientA._id,
      title: 'ReportTest Task 2',
      taskType: 'email',
      status: 'open',
      priority: 'high',
      assignedTo: staffUserA._id,
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      slaTargetMinutes: 60,
      slaDeadline: new Date(now.getTime() - 120 * 60 * 1000),
      slaBreached: true,
      slaBreachedAt: new Date(now.getTime() - 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - 180 * 60 * 1000),
    });

    // Client A Campaign & Ad Spend
    const campaignA = await AdCampaign.create({
      clientId: clientA._id,
      connectionId: new mongoose.Types.ObjectId(),
      platform: 'meta',
      externalCampaignId: 'meta_camp_123',
      name: 'ReportTest Meta Campaign',
      status: 'ACTIVE',
      currency: 'USD',
    });

    await AdSpendDaily.create({
      clientId: clientA._id,
      connectionId: campaignA.connectionId,
      campaignId: campaignA._id,
      externalCampaignId: campaignA.externalCampaignId,
      platform: 'meta',
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      currency: 'USD',
      spend: 500,
      impressions: 10000,
      clicks: 250,
      leads: 5,
    });

    // Client A Website Form & Submission
    const formA = await WebsiteForm.create({
      clientId: clientA._id,
      name: 'ReportTest Contact Form',
      publicKey: `wf_pk_${Date.now()}`,
      status: 'published',
      submitButtonLabel: 'Submit',
      successMessage: 'Thank you for reaching out.',
      allowedDomains: ['*'],
      viewsCount: 100,
      submissionsCount: 1,
    });

    await FormSubmission.create({
      clientId: clientA._id,
      formId: formA._id,
      submissionId: `sub_test_${Date.now()}`,
      payload: { email: 'submitter@test.com' },
      normalizedPayload: { email: 'submitter@test.com' },
      processingStatus: 'processed',
      spamStatus: 'clean',
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    });

    // =======================================================================
    // Section 4: Overview KPIs & Period-over-Period Comparison
    // =======================================================================
    console.log('\n--- Section 4: Overview KPIs & Aggregation Accuracy ---');

    const overviewResA = await fetch(`${baseUrl}/reports/overview?preset=last_30_days`, {
      headers: { Cookie: cookieAdminA },
    });
    assert(overviewResA.status === 200, 'Client A admin accesses overview KPIs with 200 OK');
    const overviewDataA = (await overviewResA.json()).data;

    assert(overviewDataA.metrics.totalLeads.value === 3, 'Overview total leads matches Client A dataset (3)');
    assert(overviewDataA.metrics.wonLeads.value === 1, 'Overview won leads matches Client A dataset (1)');
    assert(overviewDataA.metrics.conversionRate.value === 33.3, 'Overview conversion rate accurately computed (33.3%)');
    assert(overviewDataA.metrics.formSubmissions.value === 1, 'Overview form submissions count matches (1)');
    assert(overviewDataA.metrics.tasksCompleted.value === 1, 'Overview tasks completed count matches (1)');
    assert(overviewDataA.metrics.slaComplianceRate.value === 100, 'Overview SLA compliance rate accurately computed (100%)');

    // =======================================================================
    // Section 5: Financial Access Enforcement (reports.view_financial)
    // =======================================================================
    console.log('\n--- Section 5: Financial Access Enforcement at Controller & Service Level ---');

    // 1. Client Admin A DOES NOT have reports.view_financial
    assert(
      overviewDataA.metrics.totalSpend === undefined,
      'Financial metric totalSpend is NOT returned to user lacking reports.view_financial'
    );
    assert(
      overviewDataA.metrics.closedRevenue === undefined,
      'Financial metric closedRevenue is NOT returned to user lacking reports.view_financial'
    );
    assert(
      overviewDataA.metrics.roas === undefined,
      'Financial metric roas is NOT returned to user lacking reports.view_financial'
    );

    // 2. Super Admin DOES have reports.view_financial
    const overviewSuperRes = await fetch(
      `${baseUrl}/reports/overview?preset=last_30_days&clientId=${clientAId}`,
      { headers: { Cookie: cookieSuperAdmin } }
    );
    assert(overviewSuperRes.status === 200, 'Super Admin accesses Client A overview with 200 OK');
    const overviewSuperData = (await overviewSuperRes.json()).data;

    assert(
      overviewSuperData.metrics.totalSpend !== undefined,
      'Financial metric totalSpend is included for user with reports.view_financial'
    );
    assert(
      overviewSuperData.metrics.totalSpend.value === 500,
      'totalSpend value accurately reflects recorded spend ($500)'
    );
    assert(
      overviewSuperData.metrics.closedRevenue.value === 1500,
      'closedRevenue accurately reflects won lead value ($1500)'
    );
    assert(
      overviewSuperData.metrics.roas.value === 3,
      'ROAS accurately calculated as revenue/spend ($1500 / $500 = 3.0x)'
    );

    // 3. Campaign analytics financial access check
    const campAdminRes = await fetch(`${baseUrl}/reports/campaigns?preset=last_30_days`, {
      headers: { Cookie: cookieAdminA },
    });
    const campAdminData = (await campAdminRes.json()).data;
    assert(
      campAdminData.campaigns[0].spend === undefined,
      'Campaign spend is NOT returned in campaign analytics without reports.view_financial'
    );

    const campSuperRes = await fetch(
      `${baseUrl}/reports/campaigns?preset=last_30_days&clientId=${clientAId}`,
      { headers: { Cookie: cookieSuperAdmin } }
    );
    const campSuperData = (await campSuperRes.json()).data;
    assert(
      campSuperData.campaigns[0].spend === 500,
      'Campaign spend is included with reports.view_financial ($500)'
    );
    assert(
      campSuperData.campaigns[0].cpl === 100,
      'CPL accurately computed from reliable spend ($500 / 5 leads = $100)'
    );

    // 4. Attribution claims: In absence of reliable spend, returns null instead of fabricated zeros
    const emptyCampaign = await AdCampaign.create({
      clientId: clientA._id,
      connectionId: new mongoose.Types.ObjectId(),
      platform: 'google',
      externalCampaignId: 'g_camp_456',
      name: 'ReportTest Zero Spend Campaign',
      status: 'ACTIVE',
      currency: 'USD',
    });
    // Record impression/clicks but NO spend
    await AdSpendDaily.create({
      clientId: clientA._id,
      connectionId: emptyCampaign.connectionId,
      campaignId: emptyCampaign._id,
      externalCampaignId: emptyCampaign.externalCampaignId,
      platform: 'google',
      date: now.toISOString().split('T')[0],
      currency: 'USD',
      spend: 0,
      impressions: 100,
      clicks: 10,
      leads: 0,
    });

    const campZeroRes = await fetch(
      `${baseUrl}/reports/campaigns?preset=last_30_days&clientId=${clientAId}`,
      { headers: { Cookie: cookieSuperAdmin } }
    );
    const campZeroData = (await campZeroRes.json()).data;
    const zeroCamp = campZeroData.campaigns.find((c: any) => c.campaignId === emptyCampaign._id.toString());
    assert(
      zeroCamp.cpl === null,
      'Attribution metric CPL returns null when reliable spend/leads are absent—never fabricated zeros'
    );

    // =======================================================================
    // Section 6: Team Productivity Access Enforcement (reports.view_team)
    // =======================================================================
    console.log('\n--- Section 6: Team Productivity Permission Enforcement ---');

    // Staff member lacking reports.view_team receives 403
    const teamStaffRes = await fetch(`${baseUrl}/reports/team?preset=last_30_days`, {
      headers: { Cookie: cookieStaffA },
    });
    assert(
      teamStaffRes.status === 403,
      'Staff member without reports.view_team is rejected from /reports/team with 403 Forbidden'
    );

    // Client Admin with reports.view_team gets 200 with team workload metrics
    const teamAdminRes = await fetch(`${baseUrl}/reports/team?preset=last_30_days`, {
      headers: { Cookie: cookieAdminA },
    });
    assert(
      teamAdminRes.status === 200,
      'Client Admin with reports.view_team accesses /reports/team with 200 OK'
    );
    const teamData = (await teamAdminRes.json()).data;
    assert(Array.isArray(teamData.team), 'Team productivity response returns team array');
    const adminAStats = teamData.team.find((m: any) => m.userId === adminUserA._id.toString());
    assert(adminAStats.totalAssigned === 1, 'Admin A assigned task workload accurately aggregated');
    assert(adminAStats.completed === 1, 'Admin A completed task count accurately aggregated');
    assert(adminAStats.completionRate === 100, 'Admin A completion rate accurately computed (100%)');

    const staffAStats = teamData.team.find((m: any) => m.userId === staffUserA._id.toString());
    assert(staffAStats.breached === 1, 'Staff A breached task count accurately identified');

    // =======================================================================
    // Section 7: Export CSV & Formula Injection Defense (OWASP / RFC-4180)
    // =======================================================================
    console.log('\n--- Section 7: CSV Export & Formula Injection Defense ---');

    // Staff lacking reports.export receives 403
    const exportStaffRes = await fetch(`${baseUrl}/reports/export?reportType=leads`, {
      headers: { Cookie: cookieStaffA },
    });
    assert(
      exportStaffRes.status === 403,
      'Staff member without reports.export is rejected from /reports/export with 403 Forbidden'
    );

    // Admin with reports.export receives safe CSV
    const exportAdminRes = await fetch(`${baseUrl}/reports/export?reportType=leads`, {
      headers: { Cookie: cookieAdminA },
    });
    assert(exportAdminRes.status === 200, 'Client Admin with reports.export exports CSV with 200 OK');
    assert(
      exportAdminRes.headers.get('content-type')?.includes('text/csv'),
      'Export response header has Content-Type: text/csv'
    );

    const csvBody = await exportAdminRes.text();

    // Verify formula-injection defense:
    // Lead 3 had fullName '=CMD("calc")', email '@malicious@test.com', source '+organic_search', stage '-qualified'
    assert(
      csvBody.includes("''=CMD") || csvBody.includes("''=CMD(\"\"calc\"\")") || csvBody.includes("'=CMD"),
      'Formula injection: Field starting with = has prepended single quote defense'
    );
    assert(
      csvBody.includes("'@malicious"),
      'Formula injection: Field starting with @ has prepended single quote defense'
    );
    assert(
      csvBody.includes("'+15551234567"),
      'Formula injection: Field starting with + has prepended single quote defense'
    );
    assert(
      csvBody.includes("'-negative_formula"),
      'Formula injection: Field starting with - has prepended single quote defense'
    );

    // Export with limit bounds
    const boundedExportRes = await fetch(`${baseUrl}/reports/export?reportType=leads&limit=1`, {
      headers: { Cookie: cookieAdminA },
    });
    const boundedCsv = await boundedExportRes.text();
    const dataRows = boundedCsv.split('\r\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('Lead ID'));
    assert(dataRows.length === 1, 'CSV export respects limit parameter (bounded to 1 row)');

    // =======================================================================
    // Section 8: Date Range Validation
    // =======================================================================
    console.log('\n--- Section 8: Date Range Validation & Boundaries ---');

    // Custom date range where start > end rejected with 422 Validation Error
    const invalidRangeRes = await fetch(
      `${baseUrl}/reports/overview?preset=custom&startDate=2026-10-01&endDate=2026-09-01`,
      { headers: { Cookie: cookieAdminA } }
    );
    assert(
      invalidRangeRes.status === 422 || invalidRangeRes.status === 400,
      'Custom date range where startDate > endDate is rejected with 422/400 Validation Error'
    );

    // Date range > 366 days rejected with 422 Validation Error
    const excessiveRangeRes = await fetch(
      `${baseUrl}/reports/overview?preset=custom&startDate=2024-01-01&endDate=2026-01-01`,
      { headers: { Cookie: cookieAdminA } }
    );
    assert(
      excessiveRangeRes.status === 422 || excessiveRangeRes.status === 400,
      'Date range exceeding 366 days ceiling is rejected with 422/400 Validation Error'
    );

    // Valid custom date range accepted
    const validCustomRes = await fetch(
      `${baseUrl}/reports/overview?preset=custom&startDate=2026-08-01&endDate=2026-09-01`,
      { headers: { Cookie: cookieAdminA } }
    );
    assert(
      validCustomRes.status === 200,
      'Valid custom date range (31 days) is accepted with 200 OK'
    );

    // =======================================================================
    // Section 9: Saved Reports CRUD & Workspace vs Private Visibility
    // =======================================================================
    console.log('\n--- Section 9: Saved Reports CRUD & Visibility Scoping ---');

    // 1. Staff lacking reports.manage_saved cannot create saved report
    const staffCreateRes = await fetch(`${baseUrl}/reports/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieStaffA },
      body: JSON.stringify({
        name: 'Staff Unauthorized View',
        reportType: 'leads',
      }),
    });
    assert(
      staffCreateRes.status === 403,
      'Staff member without reports.manage_saved cannot create saved report (403 Forbidden)'
    );

    // 2. Admin A creates a WORKSPACE visible saved report
    const createWsRes = await fetch(`${baseUrl}/reports/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA },
      body: JSON.stringify({
        name: 'ReportTest Workspace View',
        reportType: 'leads',
        visibility: 'workspace',
      }),
    });
    assert(createWsRes.status === 201, 'Admin A creates workspace-visible saved report (201 Created)');
    const wsSavedReport = (await createWsRes.json()).data;

    // 3. Staff A (who has reports.view) CAN see workspace saved report
    const staffListRes = await fetch(`${baseUrl}/reports/saved`, {
      headers: { Cookie: cookieStaffA },
    });
    assert(staffListRes.status === 200, 'Staff A can list workspace saved reports');
    const staffListData = (await staffListRes.json()).data;
    assert(
      staffListData.some((r: any) => r._id === wsSavedReport._id),
      'Workspace-visible saved report is accessible to staff in same workspace'
    );

    // 4. Admin A creates a PRIVATE saved report
    const createPrivateRes = await fetch(`${baseUrl}/reports/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA },
      body: JSON.stringify({
        name: 'ReportTest Private View',
        reportType: 'tasks',
        visibility: 'private',
      }),
    });
    assert(createPrivateRes.status === 201, 'Admin A creates private saved report (201 Created)');
    const privSavedReport = (await createPrivateRes.json()).data;

    // 5. Staff A CANNOT see Admin A's private saved report
    const staffListAgainRes = await fetch(`${baseUrl}/reports/saved`, {
      headers: { Cookie: cookieStaffA },
    });
    const staffListAgainData = (await staffListAgainRes.json()).data;
    assert(
      !staffListAgainData.some((r: any) => r._id === privSavedReport._id),
      'Private saved report is NOT visible to other users in same workspace'
    );

    // 6. Cross-tenant isolation: Client B Admin CANNOT see or access Client A's saved report
    const clientBGetRes = await fetch(`${baseUrl}/reports/saved/${wsSavedReport._id}`, {
      headers: { Cookie: cookieAdminB },
    });
    assert(
      clientBGetRes.status === 404,
      'Cross-tenant access to saved report returns 404 Not Found'
    );

    // 7. Admin A updates and deletes saved report
    const updateRes = await fetch(`${baseUrl}/reports/saved/${wsSavedReport._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookieAdminA },
      body: JSON.stringify({ name: 'ReportTest Updated Workspace View' }),
    });
    assert(updateRes.status === 200, 'Admin A updates saved report name successfully');

    const deleteRes = await fetch(`${baseUrl}/reports/saved/${wsSavedReport._id}`, {
      method: 'DELETE',
      headers: { Cookie: cookieAdminA },
    });
    assert(deleteRes.status === 200, 'Admin A deletes saved report successfully');

    // =======================================================================
    // Section 10: Empty Datasets Handling
    // =======================================================================
    console.log('\n--- Section 10: Empty Datasets Graceful Handling ---');

    // Client B currently has zero tasks, forms, conversations, or spend
    const emptyOverviewRes = await fetch(`${baseUrl}/reports/overview?preset=last_30_days`, {
      headers: { Cookie: cookieAdminB },
    });
    assert(emptyOverviewRes.status === 200, 'Empty workspace overview returns 200 OK');
    const emptyOverviewData = (await emptyOverviewRes.json()).data;
    assert(
      emptyOverviewData.metrics.conversionRate.value === 100 || emptyOverviewData.metrics.conversionRate.value === 0,
      'Empty dataset handles conversion rate without NaN'
    );
    assert(
      emptyOverviewData.metrics.slaComplianceRate.value === 100,
      'Empty dataset handles SLA compliance rate cleanly without NaN (100% default)'
    );

    const emptyTaskRes = await fetch(`${baseUrl}/reports/tasks?preset=last_30_days`, {
      headers: { Cookie: cookieAdminB },
    });
    assert(emptyTaskRes.status === 200, 'Empty workspace task analytics returns 200 OK');
    const emptyTaskData = (await emptyTaskRes.json()).data;
    assert(emptyTaskData.avgResolutionMinutes === null, 'Avg resolution minutes returns null cleanly when no tasks completed');

  } catch (err: any) {
    console.error('Test Suite Error:', err);
    results.push({ name: 'Fatal Exception', passed: false, error: err.message });
  } finally {
    // Cleanup
    await Client.deleteMany({ slug: /^report-test-/ });
    await User.deleteMany({ email: /^report-test-/ });
    await Lead.deleteMany({ fullName: /^ReportTest/i });
    await Task.deleteMany({ title: /^ReportTest/i });
    await WebsiteForm.deleteMany({ title: /^ReportTest/i });
    await FormSubmission.deleteMany({});
    await AdCampaign.deleteMany({ name: /^ReportTest/i });
    await AdSpendDaily.deleteMany({});
    await LeadAttribution.deleteMany({});
    await Conversation.deleteMany({ subject: /^ReportTest/i });
    await Message.deleteMany({});
    await SavedReport.deleteMany({ name: /^ReportTest/i });

    server.close();
    await disconnectDatabase();

    // Summary
    console.log('\n==================================================');
    console.log('Release 9 Reporting & Analytics Test Summary:');
    console.log('==================================================');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      console.error('\nFailed Tests:');
      results.filter((r) => !r.passed).forEach((r) => console.error(`  - ${r.name}: ${r.error}`));
      process.exit(1);
    } else {
      console.log('\nAll Release 9 Reporting & Analytics Tests Passed Successfully!');
      process.exit(0);
    }
  }
};

runReportsTests();
