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
import { Notification } from '../models/Notification';
import { Workflow } from '../models/Workflow';
import { WorkflowRun } from '../models/WorkflowRun';
import { LeadActivity } from '../models/LeadActivity';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import { EventDispatcher } from '../services/eventDispatcher.service';
import { ConditionEvaluator } from '../services/conditionEvaluator.service';
import { WorkflowExecutionService } from '../services/workflowExecution.service';
import { WorkflowService } from '../services/workflow.service';
import { NotificationService } from '../services/notification.service';
import { ActionExecutor } from '../services/actionExecutor.service';

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

let baseUrl = '';
let testServer: http.Server;

const makeRequest = async (
  method: string,
  path: string,
  body?: any,
  cookies?: string[],
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: any; headers: Record<string, string | string[] | undefined> }> => {
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (cookies && cookies.length > 0) {
    reqHeaders['Cookie'] = cookies.join('; ');
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  let parsed: any;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = text;
  }

  const rawSetCookie = res.headers.get('set-cookie');
  const resHeaders: Record<string, string | string[] | undefined> = {
    'set-cookie': rawSetCookie ? [rawSetCookie.split(';')[0]] : undefined,
  };

  return {
    statusCode: res.status,
    body: parsed,
    headers: resHeaders,
  };
};

const runWorkflowsTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 10 Test Suite');
  console.log('Workflow Automation & Notifications Engine');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(0, resolve));
  const port = (testServer.address() as any).port;
  baseUrl = `http://localhost:${port}`;

  // Cleanup test artifacts
  await Client.deleteMany({ _id: { $in: ['6bb7dff0aa691f601dfa4111', '6bb7dff0aa691f601dfa4112'] } });
  await Client.deleteMany({ slug: /^wf-test-/ });
  await ClientMembership.deleteMany({ clientId: { $in: ['6bb7dff0aa691f601dfa4111', '6bb7dff0aa691f601dfa4112'] } });
  await User.deleteMany({ email: /^wf-test-/ });
  await Lead.deleteMany({ fullName: /^WfTest/i });
  await Task.deleteMany({ title: /^WfTest/i });
  await Notification.deleteMany({ clientId: { $in: ['6bb7dff0aa691f601dfa4111', '6bb7dff0aa691f601dfa4112'] } });
  await Workflow.deleteMany({ name: /^WfTest/i });
  await WorkflowRun.deleteMany({});
  await LeadActivity.deleteMany({ description: /WfTest/i });

  // 1. Seed Workspaces
  const clientA = await Client.create({
    _id: new mongoose.Types.ObjectId('6bb7dff0aa691f601dfa4111'),
    name: 'WfTest Client Alpha',
    slug: 'wf-test-alpha',
    status: 'active',
  });

  const clientB = await Client.create({
    _id: new mongoose.Types.ObjectId('6bb7dff0aa691f601dfa4112'),
    name: 'WfTest Client Beta',
    slug: 'wf-test-beta',
    status: 'active',
  });

  // 2. Seed Users
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const superAdminRole = await Role.findOne({ slug: 'super_admin' });
  const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
  const clientStaffRole = await Role.findOne({ slug: 'client_staff' });

  const superAdminUser = await User.create({
    name: 'Super Admin User',
    email: 'wf-test-super@example.com',
    passwordHash,
    roleId: superAdminRole!._id,
    isSuperAdmin: true,
    status: 'active',
  });

  const clientAdminAUser = await User.create({
    name: 'Client Admin A',
    email: 'wf-test-admin-a@example.com',
    passwordHash,
    roleId: clientAdminRole!._id,
    status: 'active',
  });

  const clientStaffAUser = await User.create({
    name: 'Client Staff A',
    email: 'wf-test-staff-a@example.com',
    passwordHash,
    roleId: clientStaffRole!._id,
    status: 'active',
  });

  const clientAdminBUser = await User.create({
    name: 'Client Admin B',
    email: 'wf-test-admin-b@example.com',
    passwordHash,
    roleId: clientAdminRole!._id,
    status: 'active',
  });

  // Memberships
  await ClientMembership.create({
    clientId: clientA._id,
    userId: clientAdminAUser._id,
    roleId: clientAdminRole!._id,
    status: 'active',
  });

  await ClientMembership.create({
    clientId: clientA._id,
    userId: clientStaffAUser._id,
    roleId: clientStaffRole!._id,
    status: 'active',
  });

  await ClientMembership.create({
    clientId: clientB._id,
    userId: clientAdminBUser._id,
    roleId: clientAdminRole!._id,
    status: 'active',
  });

  // Login sessions
  const loginUser = async (email: string) => {
    const res = await makeRequest('POST', '/api/v1/auth/login', {
      email,
      password: 'Password123!',
    });
    const setCookie = res.headers['set-cookie'];
    return Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  };

  const superAdminCookies = await loginUser('wf-test-super@example.com');
  const adminACookies = await loginUser('wf-test-admin-a@example.com');
  const staffACookies = await loginUser('wf-test-staff-a@example.com');
  const adminBCookies = await loginUser('wf-test-admin-b@example.com');

  const clientAHeaders = { 'x-client-id': clientA._id.toString() };
  const clientBHeaders = { 'x-client-id': clientB._id.toString() };

  // --- SECTION 1: System Permissions & Seeding Verification ---
  console.log('\n--- Section 1: System Permissions & Seeding Verification ---');
  const seededPermissions = await Permission.find({
    code: {
      $in: [
        'workflows.view',
        'workflows.create',
        'workflows.edit',
        'workflows.delete',
        'workflows.enable',
        'workflows.execute',
        'workflows.view_runs',
        'notifications.view',
        'notifications.manage',
      ],
    },
  });
  assert(seededPermissions.length === 9, 'All 9 Release 10 workflow and notification permissions are seeded');

  const refetchedClientAdmin = await Role.findOne({ slug: 'client_admin' });
  const refetchedClientStaff = await Role.findOne({ slug: 'client_staff' });
  assert(
    refetchedClientAdmin!.permissionCodes.includes('workflows.create') &&
      refetchedClientAdmin!.permissionCodes.includes('notifications.manage'),
    'Client Admin role includes all workflow & notification permissions'
  );
  assert(
    refetchedClientStaff!.permissionCodes.includes('workflows.view') &&
      refetchedClientStaff!.permissionCodes.includes('workflows.view_runs') &&
      refetchedClientStaff!.permissionCodes.includes('notifications.view') &&
      !refetchedClientStaff!.permissionCodes.includes('workflows.create') &&
      !refetchedClientStaff!.permissionCodes.includes('notifications.manage'),
    'Client Staff role has view-only workflow & notification access'
  );

  // --- SECTION 2: Workflow Creation & Validation ---
  console.log('\n--- Section 2: Workflow Creation & Validation ---');

  // Test Zod validation rejection for empty actions
  const invalidRes = await makeRequest(
    'POST',
    '/api/v1/workflows',
    {
      name: 'Invalid Empty Actions',
      trigger: { eventType: 'lead.created' },
      actions: [],
    },
    adminACookies,
    clientAHeaders
  );
  assert(invalidRes.statusCode === 422 || invalidRes.statusCode === 400, 'Zod rejects workflow without actions (422/400)');

  // Test creation of valid workflow
  const createRes = await makeRequest(
    'POST',
    '/api/v1/workflows',
    {
      name: 'WfTest Lead Auto Responder',
      description: 'Auto-create high priority task when lead arrives with score > 50',
      status: 'draft',
      trigger: { eventType: 'lead.created' },
      conditions: [
        { field: 'lead.leadScore', operator: 'greater_than', value: 50, logicalOperator: 'and' },
      ],
      actions: [
        {
          id: 'act_task_1',
          type: 'create_task',
          payload: {
            title: 'Call {{lead.fullName}} ASAP',
            priority: 'urgent',
            taskType: 'call',
            dueInHours: 2,
          },
          order: 0,
        },
        {
          id: 'act_notif_1',
          type: 'create_notification',
          payload: {
            title: 'Urgent Lead Arrived',
            message: 'Lead {{lead.fullName}} scored above 50.',
            severity: 'warning',
          },
          order: 1,
        },
      ],
      maxExecutionsPerHour: 50,
    },
    adminACookies,
    clientAHeaders
  );
  assert(createRes.statusCode === 201, 'Client Admin creates valid workflow (201 Created)');
  const createdWfId = createRes.body?.data?._id;
  assert(!!createdWfId, 'Workflow ID is returned');

  // --- SECTION 3: Workflow Update & Status Transitions ---
  console.log('\n--- Section 3: Workflow Update & Status Transitions ---');

  const updateRes = await makeRequest(
    'PUT',
    `/api/v1/workflows/${createdWfId}`,
    {
      name: 'WfTest Lead Auto Responder - Active V2',
      maxExecutionsPerHour: 75,
    },
    adminACookies,
    clientAHeaders
  );
  assert(updateRes.statusCode === 200, 'Workflow details updated successfully (200 OK)');
  assert(updateRes.body.data.name === 'WfTest Lead Auto Responder - Active V2', 'Workflow name updated');
  assert(updateRes.body.data.maxExecutionsPerHour === 75, 'Hourly execution limit updated to 75');

  // Activate workflow via status endpoint
  const activateRes = await makeRequest(
    'PATCH',
    `/api/v1/workflows/${createdWfId}/status`,
    { status: 'active' },
    adminACookies,
    clientAHeaders
  );
  assert(activateRes.statusCode === 200, 'Workflow activated via status endpoint');
  assert(activateRes.body.data.status === 'active', 'Workflow status is now active');

  // Pause workflow
  const pauseRes = await makeRequest(
    'PATCH',
    `/api/v1/workflows/${createdWfId}/status`,
    { status: 'paused' },
    adminACookies,
    clientAHeaders
  );
  assert(pauseRes.statusCode === 200, 'Workflow paused via status endpoint');
  assert(pauseRes.body.data.status === 'paused', 'Workflow status is now paused');

  // Reactivate for subsequent execution tests
  await makeRequest(
    'PATCH',
    `/api/v1/workflows/${createdWfId}/status`,
    { status: 'active' },
    adminACookies,
    clientAHeaders
  );

  // --- SECTION 4: Permission Enforcement & Tenant Isolation ---
  console.log('\n--- Section 4: Permission Enforcement & Tenant Isolation ---');

  // Staff without workflows.create tries creating a workflow
  const staffCreateRes = await makeRequest(
    'POST',
    '/api/v1/workflows',
    {
      name: 'Staff Unauthorized Workflow',
      trigger: { eventType: 'lead.created' },
      actions: [{ id: '1', type: 'create_task', payload: { title: 'Test' } }],
    },
    staffACookies,
    clientAHeaders
  );
  assert(staffCreateRes.statusCode === 403, 'Staff without workflows.create is rejected with 403 Forbidden');

  // Staff with workflows.view can list workflows
  const staffListRes = await makeRequest('GET', '/api/v1/workflows', undefined, staffACookies, clientAHeaders);
  assert(staffListRes.statusCode === 200, 'Staff with workflows.view can list workflows (200 OK)');

  // Cross-tenant access: Admin B tries accessing Admin A workflow
  const crossTenantRes = await makeRequest(
    'GET',
    `/api/v1/workflows/${createdWfId}`,
    undefined,
    adminBCookies,
    clientBHeaders
  );
  assert(crossTenantRes.statusCode === 404, 'Cross-tenant workflow query returns 404 Not Found');

  // Cross-tenant mutation: Admin B tries updating Admin A workflow
  const crossTenantUpdate = await makeRequest(
    'PUT',
    `/api/v1/workflows/${createdWfId}`,
    { name: 'Hacked Workflow' },
    adminBCookies,
    clientBHeaders
  );
  assert(crossTenantUpdate.statusCode === 404, 'Cross-tenant workflow update returns 404 Not Found');

  // Untrusted client header check: Admin A tries passing client B ID
  const untrustedTenantRes = await makeRequest(
    'GET',
    '/api/v1/workflows',
    undefined,
    adminACookies,
    { 'x-client-id': clientB._id.toString() }
  );
  assert(untrustedTenantRes.statusCode === 403, 'Untrusted client header rejected without membership (403)');

  // --- SECTION 5: Condition Evaluation Engine (All 8 Operators) ---
  console.log('\n--- Section 5: Condition Evaluation Engine (All 8 Operators) ---');

  const testContext = {
    lead: {
      leadScore: 85,
      stage: 'new',
      source: 'Google Ads',
      tags: ['vip', 'enterprise'],
      email: 'lead@example.com',
    },
    task: {
      priority: 'high',
      status: 'open',
    },
  };

  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.stage', operator: 'equals', value: 'new' }, testContext),
    'Condition equals operator matches string'
  );
  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.stage', operator: 'not_equals', value: 'won' }, testContext),
    'Condition not_equals operator succeeds'
  );
  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.tags', operator: 'contains', value: 'vip' }, testContext),
    'Condition contains operator matches array inclusion'
  );
  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.source', operator: 'starts_with', value: 'Google' }, testContext),
    'Condition starts_with operator matches prefix'
  );
  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.leadScore', operator: 'greater_than', value: 80 }, testContext),
    'Condition greater_than operator validates numbers'
  );
  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.leadScore', operator: 'less_than', value: 100 }, testContext),
    'Condition less_than operator validates numbers'
  );
  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.stage', operator: 'in_list', value: 'new, contacted, qualified' }, testContext),
    'Condition in_list operator matches comma-separated list'
  );
  assert(
    ConditionEvaluator.evaluateCondition({ field: 'lead.email', operator: 'exists' }, testContext),
    'Condition exists operator verifies presence'
  );

  // Unsafe injection rejection
  assert(
    !ConditionEvaluator.evaluateCondition(
      { field: 'lead.stage', operator: 'equals', value: { $where: 'sleep(1000)' } },
      testContext
    ),
    'Condition evaluator safely rejects MongoDB query operators ($where) in value'
  );
  assert(
    ConditionEvaluator.extractFieldValue(testContext, 'lead.__proto__.polluted') === undefined,
    'Condition evaluator rejects prototype traversal attempts'
  );

  // --- SECTION 6: Trigger Event Dispatch & Action Execution ---
  console.log('\n--- Section 6: Trigger Event Dispatch & Action Execution ---');

  // Create a test lead in Client A
  const testLead = await Lead.create({
    clientId: clientA._id,
    fullName: 'WfTest Alex Mercer',
    email: 'alex.mercer@test.flumenx',
    stage: 'new',
    leadScore: 90,
  });

  // Dispatch event `lead.created`
  const dispatchRes = await EventDispatcher.dispatch({
    clientId: clientA._id.toString(),
    eventType: 'lead.created',
    eventId: `evt_lead_${testLead._id}_1`,
    entityId: testLead._id.toString(),
    entityType: 'lead',
    payload: {
      lead: testLead.toObject(),
    },
    actor: { id: clientAdminAUser._id.toString(), name: 'Admin A' },
  });
  assert(dispatchRes.dispatchedCount === 1, 'EventDispatcher dispatched lead.created to 1 active workflow');

  // Check generated WorkflowRun
  const runsAfterDispatch = await WorkflowRun.find({
    clientId: clientA._id,
    workflowId: createdWfId,
  });
  assert(runsAfterDispatch.length === 1, 'WorkflowRun persisted in database');
  const run1 = runsAfterDispatch[0];
  assert(run1.status === 'completed', 'WorkflowRun status is completed');
  assert(run1.actionResults.length === 2, 'Two actions executed successfully in pipeline');

  // Verify Side-Effect 1: Created Task
  const generatedTask = await Task.findOne({
    clientId: clientA._id,
    'metadata.workflowRunId': run1._id.toString(),
  });
  assert(!!generatedTask, 'Task was created by automated workflow');
  assert(generatedTask?.title === 'Call WfTest Alex Mercer ASAP', 'Task title interpolated lead template: Call {{lead.fullName}} ASAP');
  assert(generatedTask?.priority === 'urgent', 'Task priority set to urgent');

  // Verify Side-Effect 2: In-App Notification
  const generatedNotification = await Notification.findOne({
    clientId: clientA._id,
    'metadata.workflowRunId': run1._id.toString(),
  });
  assert(!!generatedNotification, 'In-app notification created by automated workflow');
  assert(generatedNotification?.title === 'Urgent Lead Arrived', 'Notification title matches action definition');
  assert(generatedNotification?.message === 'Lead WfTest Alex Mercer scored above 50.', 'Notification message interpolated lead name');

  // --- SECTION 7: Idempotency & Duplicate Prevention ---
  console.log('\n--- Section 7: Idempotency & Duplicate Prevention ---');

  // Re-dispatch exact same event
  const duplicateDispatch = await EventDispatcher.dispatch({
    clientId: clientA._id.toString(),
    eventType: 'lead.created',
    eventId: `evt_lead_${testLead._id}_1`, // SAME EVENT ID
    entityId: testLead._id.toString(),
    entityType: 'lead',
    payload: {
      lead: testLead.toObject(),
    },
  });
  assert(duplicateDispatch.dispatchedCount === 1, 'EventDispatcher processed event safely');

  const runsAfterDuplicate = await WorkflowRun.find({
    clientId: clientA._id,
    workflowId: createdWfId,
  });
  assert(runsAfterDuplicate.length === 1, 'No duplicate WorkflowRun created for identical event (Idempotent)');

  // Verify tasks count didn't duplicate
  const tasksCount = await Task.countDocuments({
    clientId: clientA._id,
    'metadata.workflowRunId': run1._id.toString(),
  });
  assert(tasksCount === 1, 'Task was not duplicated upon repeated event processing');

  // --- SECTION 8: Race-Safe Concurrency & Execution Limits ---
  console.log('\n--- Section 8: Race-Safe Concurrency & Execution Limits ---');

  // Create workflow with limit = 3 executions per hour
  const rateLimitedWf = await Workflow.create({
    clientId: clientA._id,
    name: 'WfTest Rate Limited Workflow',
    status: 'active',
    trigger: { eventType: 'lead.updated' },
    conditions: [],
    actions: [
      {
        id: 'act_note',
        type: 'add_crm_note',
        payload: { note: 'Auto audit note' },
        order: 0,
      },
    ],
    maxExecutionsPerHour: 3,
  });

  // Concurrently dispatch 5 unique events using Promise.all
  const concurrentDispatches = await Promise.all(
    [1, 2, 3, 4, 5].map((num) =>
      EventDispatcher.dispatch({
        clientId: clientA._id.toString(),
        eventType: 'lead.updated',
        eventId: `concurrent_evt_${num}`,
        payload: { lead: testLead.toObject() },
      })
    )
  );
  assert(concurrentDispatches.length === 5, '5 concurrent event dispatches completed without uncaught race conditions');

  const runsForRateLimited = await WorkflowRun.find({ workflowId: rateLimitedWf._id });
  assert(runsForRateLimited.length === 5, 'All 5 runs recorded for auditability');

  const completedCount = runsForRateLimited.filter((r) => r.status === 'completed').length;
  const skippedCount = runsForRateLimited.filter((r) => r.status === 'skipped').length;
  assert(completedCount <= 3, `Atomic race-safe hourly limit strictly bounded executions (Completed: ${completedCount} <= 3)`);
  assert(skippedCount >= 2, `Surplus executions marked skipped due to hourly limit (Skipped: ${skippedCount})`);

  // --- SECTION 9: Loop Prevention Safeguard ---
  console.log('\n--- Section 9: Loop Prevention Safeguard ---');

  const loopWorkflow = await Workflow.create({
    clientId: clientA._id,
    name: 'WfTest Recursive Workflow',
    status: 'active',
    trigger: { eventType: 'task.completed' },
    conditions: [],
    actions: [{ id: 'a1', type: 'create_notification', payload: { title: 'Loop Alert' }, order: 0 }],
  });

  // Dispatch event with cascading depth = 3 (loop detection ceiling)
  const loopRun = await WorkflowExecutionService.executeWorkflow(loopWorkflow, {
    clientId: clientA._id.toString(),
    eventType: 'task.completed',
    eventId: 'loop_detect_evt_1',
    occurredAt: new Date(),
    payload: {},
    depth: 3, // Depth limit!
  });
  assert(loopRun.status === 'skipped', 'Workflow execution at depth 3 is aborted with status: skipped');
  assert(
    loopRun.error?.includes('Loop prevention'),
    'Run error record explicitly notes Loop prevention depth ceiling'
  );

  // --- SECTION 10: Email Safeguard & Recipient Policy ---
  console.log('\n--- Section 10: Email Safeguard & Recipient Policy ---');

  const emailWorkflow = await Workflow.create({
    clientId: clientA._id,
    name: 'WfTest Email Sender',
    status: 'active',
    trigger: { eventType: 'manual.trigger' },
    conditions: [],
    actions: [
      {
        id: 'email_act_1',
        type: 'send_email',
        payload: {
          to: 'lead_email',
          subject: 'Welcome to flumenx',
          body: 'Hello {{lead.fullName}}, welcome aboard!',
        },
        order: 0,
      },
    ],
  });

  // 1. Send to verified lead email (Allowed)
  const validEmailRun = await WorkflowExecutionService.executeWorkflow(emailWorkflow, {
    clientId: clientA._id.toString(),
    eventType: 'manual.trigger',
    eventId: 'email_valid_evt_1',
    occurredAt: new Date(),
    payload: { lead: { email: 'alex.mercer@test.flumenx', fullName: 'Alex Mercer' } },
  });
  assert(validEmailRun.status === 'completed', 'Email action sent to verified lead email succeeds');
  assert(validEmailRun.actionResults[0].status === 'success', 'Action result status is success');

  // 2. Send to arbitrary external address (Policy Violation - Rejected)
  const spamEmailWorkflow = await Workflow.create({
    clientId: clientA._id,
    name: 'WfTest Arbitrary Email Sender',
    status: 'active',
    trigger: { eventType: 'manual.trigger' },
    conditions: [],
    actions: [
      {
        id: 'spam_act_1',
        type: 'send_email',
        payload: {
          to: 'external-stranger@unauthorized-domain.com',
          subject: 'Spam alert',
          body: 'Spam body',
        },
        order: 0,
      },
    ],
  });

  const spamEmailRun = await WorkflowExecutionService.executeWorkflow(spamEmailWorkflow, {
    clientId: clientA._id.toString(),
    eventType: 'manual.trigger',
    eventId: 'email_spam_evt_1',
    occurredAt: new Date(),
    payload: { lead: { email: 'alex.mercer@test.flumenx' } },
  });
  assert(spamEmailRun.status === 'failed', 'Email to unverified external address is rejected by policy');
  assert(
    spamEmailRun.actionResults[0].error?.includes('Email policy violation'),
    'Action error records explicit email policy violation'
  );

  // --- SECTION 11: Manual Execution & Testing Endpoints ---
  console.log('\n--- Section 11: Manual Execution & Testing Endpoints ---');

  // 1. Test Conditions endpoint
  const testCondRes = await makeRequest(
    'POST',
    `/api/v1/workflows/${createdWfId}/test-conditions`,
    {
      payload: { lead: { leadScore: 99 } },
    },
    adminACookies,
    clientAHeaders
  );
  assert(testCondRes.statusCode === 200, 'Test conditions endpoint returns 200 OK');
  assert(testCondRes.body.data.passed === true, 'Conditions test passed for score 99 > 50');

  // 2. Staff without workflows.execute cannot manually run workflow
  const staffExecRes = await makeRequest(
    'POST',
    `/api/v1/workflows/${createdWfId}/execute`,
    { payload: {} },
    staffACookies,
    clientAHeaders
  );
  assert(staffExecRes.statusCode === 403, 'Staff without workflows.execute is rejected from manual run (403)');

  // 3. Admin A executes workflow manually
  const manualExecRes = await makeRequest(
    'POST',
    `/api/v1/workflows/${createdWfId}/execute`,
    {
      payload: { lead: { fullName: 'WfTest Manual Lead', leadScore: 100 } },
      eventId: 'manual_test_run_1',
    },
    adminACookies,
    clientAHeaders
  );
  assert(manualExecRes.statusCode === 200, 'Manual workflow execution succeeds with 200 OK');
  assert(manualExecRes.body.data.status === 'completed', 'Manual run completed successfully');

  // --- SECTION 12: Notification Management & Read Status ---
  console.log('\n--- Section 12: Notification Management & Read Status ---');

  // 1. Get Unread Count for Admin A
  const unreadCountRes = await makeRequest(
    'GET',
    '/api/v1/notifications/unread-count',
    undefined,
    adminACookies,
    clientAHeaders
  );
  assert(unreadCountRes.statusCode === 200, 'Get unread notification count returns 200 OK');
  assert(unreadCountRes.body.data.unreadCount >= 1, 'Unread notification count reflects generated alerts');

  // 2. List notifications
  const listNotifsRes = await makeRequest(
    'GET',
    '/api/v1/notifications',
    undefined,
    adminACookies,
    clientAHeaders
  );
  assert(listNotifsRes.statusCode === 200, 'List notifications returns 200 OK');
  const userNotif = listNotifsRes.body.data[0];
  assert(!!userNotif, 'Notification is returned in list');

  // 3. Staff without notifications.manage tries marking read
  const staffMarkRead = await makeRequest(
    'PATCH',
    `/api/v1/notifications/${userNotif._id}/read`,
    {},
    staffACookies,
    clientAHeaders
  );
  assert(staffMarkRead.statusCode === 403, 'Staff without notifications.manage rejected with 403 Forbidden');

  // 4. Admin A marks single notification as read
  const markReadRes = await makeRequest(
    'PATCH',
    `/api/v1/notifications/${userNotif._id}/read`,
    {},
    adminACookies,
    clientAHeaders
  );
  assert(markReadRes.statusCode === 200, 'Mark notification as read succeeds with 200 OK');
  assert(!!markReadRes.body.data.readAt, 'readAt timestamp is populated');

  // 5. Admin A marks all notifications read
  const markAllRes = await makeRequest(
    'POST',
    '/api/v1/notifications/mark-all-read',
    {},
    adminACookies,
    clientAHeaders
  );
  assert(markAllRes.statusCode === 200, 'Mark all notifications as read succeeds with 200 OK');

  const afterMarkAllCount = await makeRequest(
    'GET',
    '/api/v1/notifications/unread-count',
    undefined,
    adminACookies,
    clientAHeaders
  );
  assert(afterMarkAllCount.body.data.unreadCount === 0, 'Unread count is 0 after markAllAsRead');

  // --- SECTION 13: Empty Workflow Behavior ---
  console.log('\n--- Section 13: Empty Workflow Behavior ---');

  const emptyWorkflow = await Workflow.create({
    clientId: clientA._id,
    name: 'WfTest Empty Workflow',
    status: 'active',
    trigger: { eventType: 'lead.created' },
    conditions: [],
    actions: [], // No actions
  });

  const emptyRun = await WorkflowExecutionService.executeWorkflow(emptyWorkflow, {
    clientId: clientA._id.toString(),
    eventType: 'lead.created',
    eventId: 'empty_wf_evt_1',
    occurredAt: new Date(),
    payload: {},
  });
  assert(emptyRun.status === 'completed', 'Empty workflow gracefully records completed status without hanging');

  // Disconnect Database & Server
  if (testServer) testServer.close();
  await disconnectDatabase();

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n==================================================');
  console.log('Release 10 Workflow Automation Test Summary:');
  console.log('==================================================');
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}\n`);

  if (failedCount > 0) {
    console.error(`ERROR: ${failedCount} tests failed!`);
    process.exit(1);
  } else {
    console.log('All Release 10 Workflow Automation & Notification Tests Passed Successfully!\n');
  }
};

runWorkflowsTests().catch((err) => {
  console.error('Fatal error running workflow tests:', err);
  process.exit(1);
});
