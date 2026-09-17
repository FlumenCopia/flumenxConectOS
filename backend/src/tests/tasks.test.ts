import http from 'http';
import bcrypt from 'bcryptjs';
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
import { TaskEvent } from '../models/TaskEvent';
import { TaskDisposition } from '../models/TaskDisposition';
import { SlaPolicy } from '../models/SlaPolicy';
import { seedDatabase } from '../scripts/seedSuperAdmin';
import { TaskService } from '../services/task.service';
import { TaskAssignmentService } from '../services/taskAssignment.service';
import { TaskAutoFollowupService } from '../services/taskAutoFollowup.service';
import { SlaService } from '../services/sla.service';

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

const runTaskTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 8 Test Suite');
  console.log('Tasks, Lead Follow-ups & SLA Management Engine');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  // Cleanup test artifacts
  await Client.deleteMany({ slug: /^task-test-/ });
  await Task.deleteMany({});
  await TaskEvent.deleteMany({});
  await Lead.deleteMany({ firstName: /^TaskTest/i });

  try {
    await Task.collection.dropIndex('clientId_1_idempotencyKey_1');
  } catch (err) {
    // Index may not exist or already dropped
  }
  await Task.syncIndexes();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  let clientAId: string;
  let clientBId: string;
  let cookieAdminA: string;
  let cookieStaffA: string;
  let cookieAdminB: string;
  let cookieSuperAdmin: string;
  let userStaffAId: string;
  let userAdminAId: string;
  let userStaffA2Id: string;
  let inactiveUserId: string;

  try {
    // -------------------------------------------------------------
    // SETUP: Provision Test Clients, Users, and Roles
    // -------------------------------------------------------------
    console.log('--- Setting up Test Clients and Memberships ---');

    const clientA = await Client.create({
      name: 'Task Client A',
      slug: `task-test-a-${Date.now()}`,
      email: 'admin@task-a.com',
      status: 'active',
      timezone: 'UTC',
      currency: 'USD',
    });
    clientAId = clientA._id.toString();

    const clientB = await Client.create({
      name: 'Task Client B',
      slug: `task-test-b-${Date.now()}`,
      email: 'admin@task-b.com',
      status: 'active',
      timezone: 'UTC',
      currency: 'USD',
    });
    clientBId = clientB._id.toString();

    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    const clientStaffRole = await Role.findOne({ slug: 'client_staff' });
    const testPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Client A Admin
    const userAdminA = await User.create({
      name: 'Task Admin A',
      email: `admin-a-${Date.now()}@tasktest.com`,
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    userAdminAId = userAdminA._id.toString();
    await ClientMembership.create({
      clientId: clientA._id,
      userId: userAdminA._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    // Client A Staff 1
    const userStaffA = await User.create({
      name: 'Task Staff A',
      email: `staff-a-${Date.now()}@tasktest.com`,
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    userStaffAId = userStaffA._id.toString();
    await ClientMembership.create({
      clientId: clientA._id,
      userId: userStaffA._id,
      roleId: clientStaffRole!._id,
      status: 'active',
    });

    // Client A Staff 2 (for assignment testing)
    const userStaffA2 = await User.create({
      name: 'Task Staff A Two',
      email: `staff-a2-${Date.now()}@tasktest.com`,
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    userStaffA2Id = userStaffA2._id.toString();
    await ClientMembership.create({
      clientId: clientA._id,
      userId: userStaffA2._id,
      roleId: clientStaffRole!._id,
      status: 'active',
    });

    // Inactive User in Client A
    const inactiveUser = await User.create({
      name: 'Inactive Staff A',
      email: `inactive-${Date.now()}@tasktest.com`,
      passwordHash,
      status: 'suspended',
      isSuperAdmin: false,
    });
    inactiveUserId = inactiveUser._id.toString();
    await ClientMembership.create({
      clientId: clientA._id,
      userId: inactiveUser._id,
      roleId: clientStaffRole!._id,
      status: 'suspended',
    });

    // Client B Admin
    const userAdminB = await User.create({
      name: 'Task Admin B',
      email: `admin-b-${Date.now()}@tasktest.com`,
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    await ClientMembership.create({
      clientId: clientB._id,
      userId: userAdminB._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    // Helper: Authenticate
    const login = async (email: string): Promise<string> => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: testPassword }),
      });
      const cookie = res.headers.get('set-cookie');
      return cookie ? cookie.split(';')[0] : '';
    };

    // Super Admin login
    const superAdminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: env.INITIAL_ADMIN_EMAIL || 'admin@flumenx.com',
        password: env.INITIAL_ADMIN_PASSWORD || 'FlumenX@2025!',
      }),
    });
    const superAdminCookie = superAdminRes.headers.get('set-cookie');
    cookieSuperAdmin = superAdminCookie ? superAdminCookie.split(';')[0] : '';

    cookieAdminA = await login(userAdminA.email);
    cookieStaffA = await login(userStaffA.email);
    cookieAdminB = await login(userAdminB.email);

    // =============================================================
    // TEST SECTION 1: SEEDED PERMISSIONS & ROLES
    // =============================================================
    console.log('\n--- Section 1: Permissions & Role Seeding ---');

    const expectedTaskPermissions = [
      'tasks.view',
      'tasks.create',
      'tasks.edit',
      'tasks.assign',
      'tasks.complete',
      'tasks.manage_sla',
      'tasks.view_events',
    ];

    for (const permCode of expectedTaskPermissions) {
      const p = await Permission.findOne({ code: permCode });
      assert(!!p, `Permission '${permCode}' exists in system database`);
    }

    const adminRoleDoc = await Role.findOne({ slug: 'client_admin' });
    const hasAdminAllTaskPerms = expectedTaskPermissions.every((c) =>
      adminRoleDoc?.permissionCodes.includes(c)
    );
    assert(hasAdminAllTaskPerms, 'Client Admin role has all 7 task permissions');

    const staffRoleDoc = await Role.findOne({ slug: 'client_staff' });
    assert(
      staffRoleDoc?.permissionCodes.includes('tasks.view') &&
      staffRoleDoc?.permissionCodes.includes('tasks.create') &&
      staffRoleDoc?.permissionCodes.includes('tasks.complete') &&
      !staffRoleDoc?.permissionCodes.includes('tasks.assign') &&
      !staffRoleDoc?.permissionCodes.includes('tasks.manage_sla'),
      'Client Staff role has view/create/complete permissions but lacks assign/manage_sla'
    );

    // =============================================================
    // TEST SECTION 2: TASK CREATION & PRIORITY SLA DEADLINES
    // =============================================================
    console.log('\n--- Section 2: Task Creation & SLA Target Calculations ---');

    // 1. Create urgent task
    const dueTomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const createUrgentRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({
        title: 'Test Urgent Follow-up Call',
        description: 'Lead submitted quote request',
        priority: 'urgent',
        taskType: 'call',
        dueAt: dueTomorrow,
      }),
    });
    const urgentData = await createUrgentRes.json();
    assert(createUrgentRes.status === 201, 'Urgent task created successfully (status 201)');
    assert(urgentData.data.priority === 'urgent', 'Task priority set to urgent');
    assert(urgentData.data.slaTargetMinutes === 15, 'Urgent task SLA target set to 15 minutes');
    const urgentCreatedAt = new Date(urgentData.data.createdAt).getTime();
    const urgentDeadline = new Date(urgentData.data.slaDeadline).getTime();
    const diffMinutesUrgent = Math.round((urgentDeadline - urgentCreatedAt) / 60000);
    assert(diffMinutesUrgent === 15, 'Urgent task deadline is exactly 15 minutes from creation');

    const urgentTaskId = urgentData.data._id;

    // 2. Create high priority task
    const createHighRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({
        title: 'Test High Priority Email Inquiry',
        priority: 'high',
        taskType: 'email',
        dueAt: dueTomorrow,
      }),
    });
    const highData = await createHighRes.json();
    assert(highData.data.slaTargetMinutes === 60, 'High priority task SLA target set to 60 minutes (1 hour)');

    // 3. Create normal priority task
    const createNormalRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({
        title: 'Test Normal Routine Follow-up',
        priority: 'normal',
        taskType: 'follow_up',
        dueAt: dueTomorrow,
      }),
    });
    const normalData = await createNormalRes.json();
    assert(normalData.data.slaTargetMinutes === 240, 'Normal priority task SLA target set to 240 minutes (4 hours)');
    const normalTaskId = normalData.data._id;

    // 4. Create low priority task
    const createLowRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({
        title: 'Test Low Priority Monthly Check',
        priority: 'low',
        taskType: 'review',
        dueAt: dueTomorrow,
      }),
    });
    const lowData = await createLowRes.json();
    assert(lowData.data.slaTargetMinutes === 1440, 'Low priority task SLA target set to 1440 minutes (24 hours)');

    // =============================================================
    // TEST SECTION 3: MULTI-TENANCY & WORKSPACE ISOLATION
    // =============================================================
    console.log('\n--- Section 3: Workspace Isolation & Multi-Tenancy ---');

    // Client B Admin querying Client A's task directly
    const crossClientRes = await fetch(`${baseUrl}/tasks/${urgentTaskId}`, {
      headers: {
        Cookie: cookieAdminB,
        'x-client-id': clientBId,
      },
    });
    assert(
      crossClientRes.status === 404,
      'Cross-tenant task lookup by Client B returns 404 Not Found'
    );

    // Client B trying to list tasks does not see Client A's tasks
    const clientBListRes = await fetch(`${baseUrl}/tasks`, {
      headers: {
        Cookie: cookieAdminB,
        'x-client-id': clientBId,
      },
    });
    const clientBListData = await clientBListRes.json();
    const leakedTasks = (clientBListData.data?.tasks || []).filter(
      (t: any) => t._id === urgentTaskId || t._id === normalTaskId
    );
    assert(
      leakedTasks.length === 0,
      'Client B task list does not include any tasks from Client A'
    );

    // Client B attempting to mutate Client A's task
    const crossMutateRes = await fetch(`${baseUrl}/tasks/${urgentTaskId}/start`, {
      method: 'POST',
      headers: {
        Cookie: cookieAdminB,
        'x-client-id': clientBId,
      },
    });
    assert(
      crossMutateRes.status === 404,
      'Cross-tenant task mutation attempt returns 404 Not Found'
    );

    // =============================================================
    // TEST SECTION 4: RBAC & PERMISSION ENFORCEMENT
    // =============================================================
    console.log('\n--- Section 4: RBAC & Permission Enforcement ---');

    // Staff lacks tasks.assign -> should get 403 Forbidden
    const staffAssignRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieStaffA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({ assignedTo: userStaffAId }),
    });
    assert(
      staffAssignRes.status === 403,
      'Staff member without tasks.assign permission receives 403 Forbidden'
    );

    // Staff lacks tasks.manage_sla -> should get 403 Forbidden
    const defaultPolicy = await SlaPolicy.findOne({ clientId: clientAId, isDefault: true });
    if (defaultPolicy) {
      const staffSlaRes = await fetch(`${baseUrl}/tasks/sla-policies/${defaultPolicy._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieStaffA,
          'x-client-id': clientAId,
        },
        body: JSON.stringify({ urgentTargetMinutes: 20 }),
      });
      assert(
        staffSlaRes.status === 403,
        'Staff member without tasks.manage_sla receives 403 Forbidden'
      );
    }

    // Admin has tasks.assign -> should succeed
    const adminAssignRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({ assignedTo: userStaffAId, reason: 'Initial load distribution' }),
    });
    const adminAssignData = await adminAssignRes.json();
    assert(adminAssignRes.status === 200, 'Admin with tasks.assign assigns task successfully');
    assert(adminAssignData.data.assignedTo._id === userStaffAId, 'Task assignedTo matches target user');

    // =============================================================
    // TEST SECTION 5: ASSIGNMENT VALIDATION & LEAST-OPEN-TASK LOGIC
    // =============================================================
    console.log('\n--- Section 5: Assignment Validation & Team Routing ---');

    // Attempting to assign to suspended / inactive user
    const assignInactiveRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({ assignedTo: inactiveUserId }),
    });
    assert(
      assignInactiveRes.status === 400,
      'Assigning task to suspended/inactive member is rejected with 400 Bad Request'
    );

    // Least-open-task assignment selection
    // Staff 1 has 1 open task (normalTaskId). Staff 2 has 0 open tasks.
    const leastOpenAssignee = await TaskAssignmentService.determineAssignee(clientAId, {
      strategy: 'least_open',
    });
    assert(
      leastOpenAssignee !== userStaffAId &&
        (leastOpenAssignee === userStaffA2Id || leastOpenAssignee === userAdminAId),
      'Least-open task assignment accurately selects an active member with 0 open tasks'
    );

    // =============================================================
    // TEST SECTION 6: LIFECYCLE MUTATIONS & AUDIT EVENTS
    // =============================================================
    console.log('\n--- Section 6: Lifecycle State Transitions & Audit Trail ---');

    // 1. Priority Update (recalculates SLA)
    const updatePriorityRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/priority`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({ priority: 'urgent' }),
    });
    const updatePriorityData = await updatePriorityRes.json();
    assert(updatePriorityData.data.priority === 'urgent', 'Task priority successfully escalated to urgent');
    assert(updatePriorityData.data.slaTargetMinutes === 15, 'SLA target minutes recalculated to 15 on escalation');

    // 2. Start Task (In Progress)
    const startRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/start`, {
      method: 'POST',
      headers: {
        Cookie: cookieStaffA,
        'x-client-id': clientAId,
      },
    });
    const startData = await startRes.json();
    assert(startRes.status === 200, 'Task marked in_progress successfully');
    assert(startData.data.status === 'in_progress', 'Status is in_progress');

    // 3. Snooze Task
    const snoozeUntil = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const snoozeRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/snooze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieStaffA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({ snoozedUntil: snoozeUntil, reason: 'Waiting on client email' }),
    });
    const snoozeData = await snoozeRes.json();
    assert(snoozeRes.status === 200, 'Task snoozed successfully');
    assert(snoozeData.data.status === 'snoozed', 'Status updated to snoozed');
    assert(!!snoozeData.data.snoozedUntil, 'snoozedUntil timestamp recorded');

    // 4. Complete Task
    const completeRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieStaffA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({ completionNotes: 'Client agreed to proposal demo' }),
    });
    const completeData = await completeRes.json();
    assert(completeRes.status === 200, 'Task completed successfully');
    assert(completeData.data.status === 'completed', 'Status updated to completed');
    assert(!!completeData.data.completedAt, 'completedAt timestamp recorded');
    assert(completeData.data.completionNotes === 'Client agreed to proposal demo', 'completionNotes stored');

    // 5. Verify Audit Timeline Events
    const eventsRes = await fetch(`${baseUrl}/tasks/${normalTaskId}/events`, {
      headers: {
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
    });
    const eventsData = await eventsRes.json();
    assert(eventsRes.status === 200, 'Task audit events retrieved successfully');
    const eventTypes = (eventsData.data || []).map((e: any) => e.eventType);
    assert(eventTypes.includes('created'), 'Audit log records created event');
    assert(eventTypes.includes('assigned'), 'Audit log records assigned event');
    assert(eventTypes.includes('priority_changed'), 'Audit log records priority_changed event');
    assert(eventTypes.includes('status_changed'), 'Audit log records status_changed event');
    assert(eventTypes.includes('snoozed'), 'Audit log records snoozed event');
    assert(eventTypes.includes('completed'), 'Audit log records completed event');

    // =============================================================
    // TEST SECTION 7: QUICK DISPOSITIONS & NEXT FOLLOW-UP CREATION
    // =============================================================
    console.log('\n--- Section 7: Quick Dispositions & Rescheduling ---');

    // Create a linked CRM Lead in Client A
    const testLead = await Lead.create({
      clientId: clientA._id,
      fullName: 'TaskTest LeadOne',
      firstName: 'TaskTest',
      lastName: 'LeadOne',
      email: 'tasklead@flumenxtest.com',
      phone: '+15550001111',
      stage: 'new',
      score: 50,
      scoreTier: 'warm',
      source: 'manual',
      intakeMethod: 'manual',
    });

    // Create a task linked to this lead
    const dispTestTask = await Task.create({
      clientId: clientA._id,
      title: 'Test Call with TaskTest Lead',
      taskType: 'call',
      priority: 'normal',
      status: 'open',
      dueAt: dueTomorrow,
      slaDeadline: new Date(Date.now() + 4 * 3600 * 1000),
      slaTargetMinutes: 240,
      leadId: testLead._id,
    });

    // Verify master dispositions endpoint
    const dispListRes = await fetch(`${baseUrl}/tasks/dispositions`, {
      headers: {
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
    });
    const dispListData = await dispListRes.json();
    assert(dispListRes.status === 200, 'Dispositions endpoint returns 200');
    assert(dispListData.data.length >= 8, 'At least 8 standard dispositions available');

    // Apply 'rescheduled' disposition with automatic next follow-up task
    const nextDue = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const applyDispRes = await fetch(`${baseUrl}/tasks/${dispTestTask._id}/disposition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieStaffA,
        'x-client-id': clientAId,
      },
      body: JSON.stringify({
        disposition: 'rescheduled',
        notes: 'Prospect in meeting, asked to call back in 2 days',
        scheduleFollowUp: true,
        followUpDueAt: nextDue,
        followUpTitle: 'Follow-up Call: TaskTest Lead (Rescheduled)',
        followUpType: 'call',
        updateLeadStage: 'contacted',
      }),
    });
    const applyDispData = await applyDispRes.json();
    assert(applyDispRes.status === 200, 'Disposition applied successfully');
    assert(applyDispData.data.task.status === 'completed', 'Current task completed upon disposition');
    assert(applyDispData.data.task.disposition === 'rescheduled', 'Disposition recorded as rescheduled');
    assert(!!applyDispData.data.followUpTask, 'Automatic next follow-up task was generated');
    assert(
      applyDispData.data.followUpTask.title === 'Follow-up Call: TaskTest Lead (Rescheduled)',
      'Generated follow-up task has configured title'
    );
    assert(
      applyDispData.data.followUpTask.status === 'open',
      'Generated follow-up task is open'
    );

    // Verify Lead pipeline stage was updated to 'contacted'
    const updatedLead = await Lead.findById(testLead._id);
    assert(updatedLead?.stage === 'contacted', 'CRM Lead pipeline stage updated to contacted via disposition');

    // =============================================================
    // TEST SECTION 8: AUTOMATED FOLLOW-UP HOOKS & IDEMPOTENCY
    // =============================================================
    console.log('\n--- Section 8: Ingestion Hooks & Follow-up Idempotency ---');

    // Create a new lead
    const autoLead = await Lead.create({
      clientId: clientA._id,
      fullName: 'TaskTest AutoIntake',
      firstName: 'TaskTest',
      lastName: 'AutoIntake',
      email: 'autointake@flumenxtest.com',
      source: 'webhook',
      stage: 'new',
      score: 60,
      scoreTier: 'warm',
      intakeMethod: 'webhook',
    });

    // 1. Generate follow-up task
    const task1 = await TaskAutoFollowupService.generateLeadFollowUpTask({
      clientId: clientAId,
      leadId: autoLead._id.toString(),
      source: 'website_form',
      actorId: userAdminAId,
    });
    assert(!!task1, 'Automatic follow-up task generated successfully');
    assert(task1?.priority === 'urgent', 'Website form follow-up receives urgent priority');
    assert(task1?.slaTargetMinutes === 15, 'Website form follow-up receives 15-minute SLA target');

    // 2. Duplicate generation call with same lead (Idempotency test)
    const task2 = await TaskAutoFollowupService.generateLeadFollowUpTask({
      clientId: clientAId,
      leadId: autoLead._id.toString(),
      source: 'website_form',
      actorId: userAdminAId,
    });
    assert(
      task1?._id.toString() === task2?._id.toString(),
      'Idempotency confirmed: Duplicate trigger returns original task without creating second task'
    );

    const totalAutoTasks = await Task.countDocuments({
      clientId: clientA._id,
      leadId: autoLead._id,
    });
    assert(totalAutoTasks === 1, 'Only 1 follow-up task exists for lead in database');

    // =============================================================
    // TEST SECTION 9: SLA BREACH DETECTION & AGGREGATIONS
    // =============================================================
    console.log('\n--- Section 9: SLA Breach Engine & KPIs Aggregation ---');

    // Create a task in Client A with past SLA deadline
    const breachedTask = await Task.create({
      clientId: clientA._id,
      title: 'Breached Test Follow-up',
      taskType: 'call',
      priority: 'urgent',
      status: 'open',
      dueAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      slaDeadline: new Date(Date.now() - 1800 * 1000), // 30 mins ago
      slaTargetMinutes: 15,
      slaBreached: false,
    });

    // Trigger SLA breach evaluation
    const evaluatedBreach = await SlaService.evaluateTaskSla(breachedTask._id.toString());
    assert(evaluatedBreach?.slaBreached === true, 'SLA service detects and marks past-deadline task as breached');
    assert(!!evaluatedBreach?.slaBreachedAt, 'slaBreachedAt timestamp recorded on breach');

    // Query KPIs
    const kpiRes = await fetch(`${baseUrl}/tasks/kpis`, {
      headers: {
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
    });
    const kpiData = await kpiRes.json();
    assert(kpiRes.status === 200, 'KPIs endpoint returns 200');
    assert(kpiData.data.slaBreachedTasks >= 1, 'KPIs reflect at least 1 SLA breached task');
    assert(kpiData.data.openTasks >= 1, 'KPIs reflect open tasks');
    assert(kpiData.data.completedToday >= 1, 'KPIs reflect completed tasks');

    // Query Daily Agenda
    const agendaRes = await fetch(`${baseUrl}/tasks/agenda`, {
      headers: {
        Cookie: cookieAdminA,
        'x-client-id': clientAId,
      },
    });
    const agendaData = await agendaRes.json();
    assert(agendaRes.status === 200, 'Agenda endpoint returns 200');
    assert(Array.isArray(agendaData.data.overdue), 'Agenda contains overdue section');
    assert(Array.isArray(agendaData.data.dueToday), 'Agenda contains dueToday section');
    assert(Array.isArray(agendaData.data.dueTomorrow), 'Agenda contains dueTomorrow section');
    assert(Array.isArray(agendaData.data.upcoming), 'Agenda contains upcoming section');

    // SLA Policy Management: Admin updates default policy
    if (defaultPolicy) {
      const updateSlaRes = await fetch(`${baseUrl}/tasks/sla-policies/${defaultPolicy._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieAdminA,
          'x-client-id': clientAId,
        },
        body: JSON.stringify({ urgentTargetMinutes: 12 }),
      });
      const updateSlaData = await updateSlaRes.json();
      assert(updateSlaRes.status === 200, 'Admin successfully updates SLA policy');
      assert(updateSlaData.data.urgentTargetMinutes === 12, 'Urgent SLA target updated to 12 minutes');
    }

  } catch (err: any) {
    console.error('\n[UNEXPECTED ERROR IN TEST RUNNER]:', err);
    results.push({ name: 'Task Test Runner Execution', passed: false, error: err.message });
  } finally {
    // Teardown
    await server.close();
    await disconnectDatabase();
  }

  // Print Summary
  console.log('\n==================================================');
  console.log('Release 8 Test Suite Results Summary:');
  console.log('==================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nFailed tests:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`  - ${r.name}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\nAll Release 8 Task & SLA Tests Passed Successfully!\n');
    process.exit(0);
  }
};

runTaskTests();
