import http from 'http';
import crypto from 'crypto';
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
import { Contact } from '../models/Contact';
import { Lead } from '../models/Lead';
import { PortalUser } from '../models/PortalUser';
import { PortalInvitation } from '../models/PortalInvitation';
import { CustomerRequest } from '../models/CustomerRequest';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Task } from '../models/Task';
import { TaskEvent } from '../models/TaskEvent';
import { Notification } from '../models/Notification';
import { AuditLog } from '../models/AuditLog';
import { MalwareScannerService } from '../services/malwareScanner.service';
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
    reqHeaders['Cookie'] = cookies.map((c) => c.split(';')[0].trim()).join('; ');
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

  const setCookieHeaders: string[] = typeof (res.headers as any).getSetCookie === 'function'
    ? (res.headers as any).getSetCookie()
    : res.headers.get('set-cookie')
      ? [res.headers.get('set-cookie')!]
      : [];

  const resHeaders: Record<string, string | string[] | undefined> = {
    'set-cookie': setCookieHeaders.length > 0 ? setCookieHeaders : undefined,
  };

  return {
    statusCode: res.status,
    body: parsed,
    headers: resHeaders,
  };
};

const runPortalTestSuite = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 11 Test Suite');
  console.log('Customer Portal & Self-Service Isolation Engine');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  testServer = http.createServer(app);
  await new Promise<void>((resolve) => testServer.listen(0, resolve));
  const port = (testServer.address() as any).port;
  baseUrl = `http://localhost:${port}`;

  // Cleanup test artifacts
  const testClientIds = ['7cc8dff0aa691f601dfa5111', '7cc8dff0aa691f601dfa5112'];
  await Client.deleteMany({ _id: { $in: testClientIds } });
  await ClientMembership.deleteMany({ clientId: { $in: testClientIds } });
  await User.deleteMany({ email: /^portal-test-/ });
  await Contact.deleteMany({ email: /^portal-test-/ });
  await Lead.deleteMany({ email: /^portal-test-/ });
  await PortalUser.deleteMany({ email: /^portal-test-/ });
  await PortalInvitation.deleteMany({ email: /^portal-test-/ });
  await CustomerRequest.deleteMany({ clientId: { $in: testClientIds } });
  await Conversation.deleteMany({ clientId: { $in: testClientIds } });
  await Message.deleteMany({ clientId: { $in: testClientIds } });
  await Task.deleteMany({ clientId: { $in: testClientIds } });
  await Notification.deleteMany({ clientId: { $in: testClientIds } });

  // 1. Seed Workspaces
  const clientA = await Client.create({
    _id: new mongoose.Types.ObjectId(testClientIds[0]),
    name: 'Portal Test Client Alpha',
    slug: 'portal-test-alpha',
    status: 'active',
  });

  const clientB = await Client.create({
    _id: new mongoose.Types.ObjectId(testClientIds[1]),
    name: 'Portal Test Client Beta',
    slug: 'portal-test-beta',
    status: 'active',
  });

  // 2. Seed Staff Users & Roles
  const passwordHash = await bcrypt.hash('StaffPassword123!', 10);
  const staffAdmin = await User.create({
    name: 'Portal Staff Admin',
    email: 'portal-test-admin@test.local',
    passwordHash,
    status: 'active',
    isSuperAdmin: false,
    mustChangePassword: false,
  });

  const staffReadOnly = await User.create({
    name: 'Portal Staff Viewer',
    email: 'portal-test-viewer@test.local',
    passwordHash,
    status: 'active',
    isSuperAdmin: false,
    mustChangePassword: false,
  });

  const clientAdminRole = await Role.findOne({ slug: 'client_admin', clientId: null });
  const clientStaffRole = await Role.findOne({ slug: 'client_staff', clientId: null });

  await ClientMembership.create({
    clientId: clientA._id,
    userId: staffAdmin._id,
    roleId: clientAdminRole!._id,
    status: 'active',
  });

  await ClientMembership.create({
    clientId: clientA._id,
    userId: staffReadOnly._id,
    roleId: clientStaffRole!._id,
    status: 'active',
  });

  // 3. Seed Contacts
  const contactA = await Contact.create({
    clientId: clientA._id,
    name: 'Alice Customer',
    email: 'portal-test-alice@customer.local',
    phone: '+15551234567',
  });

  const contactB = await Contact.create({
    clientId: clientB._id,
    name: 'Bob OtherClient Customer',
    email: 'portal-test-bob@customer.local',
    phone: '+15559876543',
  });

  const contactC = await Contact.create({
    clientId: clientA._id,
    name: 'Charlie SameClient Customer',
    email: 'portal-test-charlie@customer.local',
    phone: '+15553334444',
  });

  const otherCustPasswordHash = await bcrypt.hash('OtherCustomerPassword123!', 10);
  const portalUserC = await PortalUser.create({
    clientId: clientA._id,
    contactId: contactC._id,
    name: 'Charlie SameClient Customer',
    email: 'portal-test-charlie@customer.local',
    passwordHash: otherCustPasswordHash,
    status: 'active',
    tokenVersion: 0,
    consentGiven: true,
  });

  const portalUserB = await PortalUser.create({
    clientId: clientB._id,
    contactId: contactB._id,
    name: 'Bob OtherClient Customer',
    email: 'portal-test-bob@customer.local',
    passwordHash: otherCustPasswordHash,
    status: 'active',
    tokenVersion: 0,
    consentGiven: true,
  });

  // Log in Charlie (Customer C - same tenant, different contact)
  const charlieLoginRes = await makeRequest('POST', '/api/v1/portal/auth/login', {
    email: 'portal-test-charlie@customer.local',
    password: 'OtherCustomerPassword123!',
  });
  const userCCookies = charlieLoginRes.headers['set-cookie'] as string[];
  const userCCsrfToken = charlieLoginRes.body.data?.csrfToken;

  // Log in Bob (Customer B - cross-tenant)
  const bobLoginRes = await makeRequest('POST', '/api/v1/portal/auth/login', {
    email: 'portal-test-bob@customer.local',
    password: 'OtherCustomerPassword123!',
  });
  const userBCookies = bobLoginRes.headers['set-cookie'] as string[];
  const userBCsrfToken = bobLoginRes.body.data?.csrfToken;

  // Staff Login
  const staffLoginRes = await makeRequest('POST', '/api/v1/auth/login', {
    email: 'portal-test-admin@test.local',
    password: 'StaffPassword123!',
  });
  const staffCookies = staffLoginRes.headers['set-cookie'] as string[];
  const staffToken = staffLoginRes.body.data?.token;

  // Viewer Staff Login
  const viewerLoginRes = await makeRequest('POST', '/api/v1/auth/login', {
    email: 'portal-test-viewer@test.local',
    password: 'StaffPassword123!',
  });
  const viewerCookies = viewerLoginRes.headers['set-cookie'] as string[];

  console.log('--- Section 1: Customer Portal Invitation Lifecycle ---');
  let invitationToken = '';
  let invitationId = '';

  // Test 1: Contact Invitation Creation
  const inviteRes = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    {
      contactId: contactA._id.toString(),
      email: contactA.email,
      name: contactA.name,
    },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );

  assert(
    inviteRes.statusCode === 201 && !!inviteRes.body.data?.invitation,
    '1. Contact invitation created successfully',
    JSON.stringify(inviteRes.body)
  );

  invitationId = inviteRes.body.data?.invitation?._id;
  invitationToken = inviteRes.body.data?.rawToken;

  assert(
    typeof invitationToken === 'string' && invitationToken.length >= 32,
    '1b. Non-production rawToken provided for invitation setup'
  );

  const dbInvite = await PortalInvitation.findById(invitationId).select('+tokenHash');
  assert(
    !!dbInvite && !!dbInvite.tokenHash && dbInvite.status === 'pending',
    '1c. Invitation stored in database with SHA-256 tokenHash'
  );

  // Test 2: Duplicate Invitation Revocation & Anti-Collision
  const reInviteRes = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    {
      contactId: contactA._id.toString(),
      email: contactA.email,
    },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );

  assert(
    reInviteRes.statusCode === 201,
    '2. Re-inviting contact succeeds and creates new active invitation'
  );

  const oldInvite = await PortalInvitation.findById(invitationId);
  assert(
    oldInvite?.status === 'revoked',
    '2b. Prior pending invitation automatically revoked upon re-invitation'
  );

  const newInvitationToken = reInviteRes.body.data?.rawToken;

  console.log('--- Section 2: Atomic Invitation Acceptance & Password Validation ---');

  // Test 3: Password Complexity Validation
  const weakPasswordRes = await makeRequest('POST', '/api/v1/portal/auth/accept-invitation', {
    token: newInvitationToken,
    password: 'weakpassword', // No uppercase, no number
  });

  assert(
    weakPasswordRes.statusCode === 422 &&
    weakPasswordRes.body.success === false &&
    Array.isArray(weakPasswordRes.body.errors),
    '3. Password complexity enforced (rejects weak password with 422 Unprocessable Entity)',
    JSON.stringify(weakPasswordRes.body)
  );

  // Test 4: Concurrency Safety - Atomic Acceptance
  // Execute two simultaneous acceptance requests with the same token
  const [acceptRes1, acceptRes2] = await Promise.all([
    makeRequest('POST', '/api/v1/portal/auth/accept-invitation', {
      token: newInvitationToken,
      password: 'StrongPortalPassword123!',
      name: 'Alice Updated Name',
    }),
    makeRequest('POST', '/api/v1/portal/auth/accept-invitation', {
      token: newInvitationToken,
      password: 'StrongPortalPassword123!',
      name: 'Alice Concurrency Race',
    }),
  ]);

  const winner = acceptRes1.statusCode === 201 ? acceptRes1 : acceptRes2;
  const loser = acceptRes1.statusCode === 201 ? acceptRes2 : acceptRes1;

  assert(
    winner.statusCode === 201 && loser.statusCode === 400,
    '4. Invitation acceptance is strictly atomic (one succeeds with 201, concurrent claim rejected with 400)',
    `res1=${acceptRes1.statusCode}, res2=${acceptRes2.statusCode}`
  );

  assert(
    !loser.headers['set-cookie'] || (loser.headers['set-cookie'] as string[]).every((c) => !c.includes('portal_token=eyJ')),
    '4b. Security: No session cookie issued on failed concurrent invitation acceptance'
  );

  const activeUserCount = await PortalUser.countDocuments({
    clientId: clientA._id,
    contactId: contactA._id,
  });
  assert(
    activeUserCount === 1,
    '4c. Database Uniqueness: Exactly one PortalUser created under concurrent invitation claim'
  );

  // Test 5: Re-invitation Prevention for Existing Portal User
  const blockedInviteRes = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    {
      contactId: contactA._id.toString(),
      email: contactA.email,
    },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );

  assert(
    blockedInviteRes.statusCode === 409,
    '5. Conflict (409) returned when attempting to invite an already active portal user'
  );

  console.log('--- Section 3: Customer Portal Authentication & Cross-Role Defense ---');

  // Test 6: Portal Login & Cookie Issuance
  const portalLoginRes = await makeRequest('POST', '/api/v1/portal/auth/login', {
    email: 'portal-test-alice@customer.local',
    password: 'StrongPortalPassword123!',
  });

  assert(
    portalLoginRes.statusCode === 200 && !!portalLoginRes.body.data?.csrfToken,
    '6. Customer portal login successful and issued CSRF token',
    JSON.stringify(portalLoginRes.body)
  );

  const portalCookies = portalLoginRes.headers['set-cookie'] as string[];
  const portalCsrfToken = portalLoginRes.body.data?.csrfToken;
  const portalToken = portalLoginRes.body.data?.token;

  // Test 7: Verify Portal /auth/me
  const portalMeRes = await makeRequest('GET', '/api/v1/portal/auth/me', undefined, portalCookies);
  assert(
    portalMeRes.statusCode === 200 && portalMeRes.body.data?.user?.email === 'portal-test-alice@customer.local',
    '7. GET /portal/auth/me succeeds with valid customer portal session'
  );

  // Test 8: Cross-Role Defense
  // 8a: Portal User token on Staff endpoint
  const crossRoleStaffRes = await makeRequest(
    'GET',
    '/api/v1/auth/me',
    undefined,
    portalCookies,
    { Authorization: `Bearer ${portalToken}` }
  );
  assert(
    crossRoleStaffRes.statusCode === 401 || crossRoleStaffRes.statusCode === 403,
    '8a. Cross-Role Defense: Portal user token strictly rejected on internal staff /auth/me',
    `statusCode=${crossRoleStaffRes.statusCode}`
  );

  // 8b: Staff User token rejected on Customer Portal endpoints
  const portalEndpoints = ['/api/v1/portal/auth/me', '/api/v1/portal/profile', '/api/v1/portal/requests', '/api/v1/portal/tasks'];
  for (const pEp of portalEndpoints) {
    const crossRolePortalRes = await makeRequest(
      'GET',
      pEp,
      undefined,
      staffCookies,
      { Authorization: `Bearer ${staffToken}` }
    );
    assert(
      crossRolePortalRes.statusCode === 401,
      `8b. Cross-Role Defense: Staff token rejected on customer portal route ${pEp} (${crossRolePortalRes.statusCode})`
    );
  }

  // 8c: Portal user token rejected across sensitive internal staff endpoints
  const staffEndpoints = [
    '/api/v1/workflows',
    '/api/v1/reports',
    '/api/v1/ads',
    '/api/v1/admin/clients',
    '/api/v1/admin/audit-logs',
    '/api/v1/client/workspace',
  ];
  for (const ep of staffEndpoints) {
    const epRes = await makeRequest('GET', ep, undefined, undefined, { Authorization: `Bearer ${portalToken}` });
    assert(
      epRes.statusCode === 401 || epRes.statusCode === 403,
      `8c. Cross-Role Defense: Portal token rejected on internal staff route ${ep} (${epRes.statusCode})`
    );
  }

  // Test 9: Session Revocation via tokenVersion increment / Logout
  const logoutRes = await makeRequest(
    'POST',
    '/api/v1/portal/auth/logout',
    {},
    portalCookies,
    { 'x-portal-csrf': portalCsrfToken }
  );
  assert(logoutRes.statusCode === 200, '9. Portal user logout succeeds');

  // Attempt to use previous cookie after logout
  const expiredMeRes = await makeRequest('GET', '/api/v1/portal/auth/me', undefined, portalCookies);
  assert(
    expiredMeRes.statusCode === 401,
    '9b. Session Revocation: Pre-logout token immediately invalidated by tokenVersion increment',
    `statusCode=${expiredMeRes.statusCode}`
  );

  // Re-login to get fresh session for remaining tests
  const freshLoginRes = await makeRequest('POST', '/api/v1/portal/auth/login', {
    email: 'portal-test-alice@customer.local',
    password: 'StrongPortalPassword123!',
  });
  let activePortalCookies = freshLoginRes.headers['set-cookie'] as string[];
  let activeCsrfToken = freshLoginRes.body.data?.csrfToken;

  console.log('--- Section 4: Zero-Enumeration Password Reset & Session Invalidation ---');

  // Test 10: Zero-Enumeration Forgot Password
  const forgotExistingRes = await makeRequest('POST', '/api/v1/portal/auth/forgot-password', {
    email: 'portal-test-alice@customer.local',
  });
  const forgotNonExistentRes = await makeRequest('POST', '/api/v1/portal/auth/forgot-password', {
    email: 'does-not-exist@randomdomain.local',
  });

  assert(
    forgotExistingRes.statusCode === 200 &&
    forgotNonExistentRes.statusCode === 200 &&
    forgotExistingRes.body.message === forgotNonExistentRes.body.message &&
    forgotExistingRes.body.data?.previewToken === undefined,
    '10. Zero-Enumeration: forgot-password returns identical non-sensitive response without exposing token or user existence'
  );

  // Test 10b: Password Reset Execution & Session Invalidation
  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
  await PortalUser.updateOne(
    { email: 'portal-test-alice@customer.local' },
    {
      $set: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetExpires: new Date(Date.now() + 3600000),
      },
    }
  );

  const resetPasswordRes = await makeRequest('POST', '/api/v1/portal/auth/reset-password', {
    token: rawResetToken,
    newPassword: 'BrandNewPortalPassword123!',
  });

  assert(
    resetPasswordRes.statusCode === 200,
    '10b. Password Reset: Succeeded using single-use hashed token'
  );

  // Assert prior active session is immediately revoked due to tokenVersion increment
  const revokedMeRes = await makeRequest('GET', '/api/v1/portal/auth/me', undefined, activePortalCookies);
  assert(
    revokedMeRes.statusCode === 401,
    '10c. Session Invalidation: Pre-reset session immediately revoked upon password reset (tokenVersion incremented)'
  );

  // Re-login with new password to obtain fresh active session
  const postResetLoginRes = await makeRequest('POST', '/api/v1/portal/auth/login', {
    email: 'portal-test-alice@customer.local',
    password: 'BrandNewPortalPassword123!',
  });
  activePortalCookies = postResetLoginRes.headers['set-cookie'] as string[];
  activeCsrfToken = postResetLoginRes.body.data?.csrfToken;

  // Test 10d: CSRF Defense - Cookie-authenticated mutation without x-portal-csrf header rejected
  const csrfBlockedRes = await makeRequest(
    'PATCH',
    '/api/v1/portal/profile',
    { name: 'CSRF Attempt' },
    activePortalCookies
    // deliberately omit x-portal-csrf
  );
  assert(
    csrfBlockedRes.statusCode === 403,
    '10d. CSRF Defense: Cookie-authenticated state mutation strictly rejected (403) when x-portal-csrf header is missing'
  );

  // Test 10e: Authenticated Password Change CSRF Enforcement
  const pwdCsrfBlockedRes = await makeRequest(
    'POST',
    '/api/v1/portal/auth/change-password',
    {
      currentPassword: 'BrandNewPortalPassword123!',
      newPassword: 'BrandNewerPassword456!',
    },
    activePortalCookies
    // deliberately omit x-portal-csrf
  );
  assert(
    pwdCsrfBlockedRes.statusCode === 403,
    '10e. CSRF Defense: Authenticated password change rejected (403) when x-portal-csrf is missing'
  );

  const pwdChangeSuccessRes = await makeRequest(
    'POST',
    '/api/v1/portal/auth/change-password',
    {
      currentPassword: 'BrandNewPortalPassword123!',
      newPassword: 'BrandNewerPassword456!',
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );
  assert(
    pwdChangeSuccessRes.statusCode === 200,
    '10f. Password Change: Authenticated password change succeeds with valid CSRF header'
  );

  if (pwdChangeSuccessRes.headers['set-cookie']) {
    activePortalCookies = pwdChangeSuccessRes.headers['set-cookie'] as string[];
  }
  if (pwdChangeSuccessRes.body.data?.csrfToken) {
    activeCsrfToken = pwdChangeSuccessRes.body.data.csrfToken;
  }

  console.log('--- Section 5: Allowlisted Profile Updates & Change Requests ---');

  // Test 11: Allowlisted Profile Update
  const updateProfileRes = await makeRequest(
    'PATCH',
    '/api/v1/portal/profile',
    {
      name: 'Alice Customer Verified',
      phone: '+15559998888',
      communicationPreferences: {
        email: true,
        sms: false,
        whatsapp: true,
        marketing: false,
      },
      consentGiven: true,
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    updateProfileRes.statusCode === 200 &&
    updateProfileRes.body.data?.name === 'Alice Customer Verified' &&
    updateProfileRes.body.data?.communicationPreferences?.sms === false,
    '11. Allowlisted profile and preferences updated successfully',
    JSON.stringify(updateProfileRes.body)
  );

  // Test 12: Mass Assignment Defense
  const massAssignRes = await makeRequest(
    'PATCH',
    '/api/v1/portal/profile',
    {
      name: 'Hacker Alice',
      clientId: '6bb7dff0aa691f601dfa4112', // Disallowed mass-assignment field
      status: 'active',
      tokenVersion: 99,
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    massAssignRes.statusCode === 422 && massAssignRes.body.success === false,
    '12. Mass Assignment Defense: Strict Zod validation rejects disallowed fields with 422',
    JSON.stringify(massAssignRes.body)
  );

  // Test 13: Profile Change Request
  const changeReqRes = await makeRequest(
    'POST',
    '/api/v1/portal/profile/change-request',
    {
      fieldName: 'email',
      requestedValue: 'alice.newemail@customer.local',
      reason: 'Company domain migration',
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    changeReqRes.statusCode === 201 &&
    changeReqRes.body.data?.category === 'profile_change',
    '13. Sensitive field change request creates profile_change customer request for staff review',
    JSON.stringify(changeReqRes.body)
  );

  console.log('--- Section 6: Scoped Request Idempotency & Attachments ---');
  let customerRequestId = '';

  // Test 14: Scoped Idempotent Customer Request Creation
  const idempotencyKey = `idemp_${Date.now()}`;
  const createReqRes1 = await makeRequest(
    'POST',
    '/api/v1/portal/requests',
    {
      subject: 'Inquiry regarding Service Delivery SLA',
      description: 'Please provide latest deployment timeline and status.',
      category: 'service_request',
      priority: 'high',
      idempotencyKey,
      attachments: [
        {
          id: 'att_1',
          name: 'project_spec.pdf',
          url: 'https://storage.local/project_spec.pdf',
          size: 1024 * 50,
          mimeType: 'application/pdf',
        },
      ],
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    createReqRes1.statusCode === 201 && !!createReqRes1.body.data?.requestNumber,
    '14. Customer request created with scoped idempotency key',
    JSON.stringify(createReqRes1.body)
  );

  customerRequestId = createReqRes1.body.data?._id;

  // Duplicate Submission with identical idempotencyKey
  const createReqRes2 = await makeRequest(
    'POST',
    '/api/v1/portal/requests',
    {
      subject: 'Inquiry regarding Service Delivery SLA',
      description: 'Please provide latest deployment timeline and status.',
      category: 'service_request',
      priority: 'high',
      idempotencyKey,
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    createReqRes2.statusCode === 200 &&
    createReqRes2.body.data?._id === customerRequestId,
    '14b. Scoped Idempotency: Duplicate request submission safely returns existing record without re-creation'
  );

  // Test 14c: Concurrent Duplicate Request Submission
  const concurrentIdempKey = `concurrent_idemp_${Date.now()}`;
  const [concurrentReq1, concurrentReq2] = await Promise.all([
    makeRequest(
      'POST',
      '/api/v1/portal/requests',
      {
        subject: 'Concurrent Request Testing',
        description: 'Testing atomic create-or-return under race condition',
        category: 'support',
        idempotencyKey: concurrentIdempKey,
      },
      activePortalCookies,
      { 'x-portal-csrf': activeCsrfToken }
    ),
    makeRequest(
      'POST',
      '/api/v1/portal/requests',
      {
        subject: 'Concurrent Request Testing',
        description: 'Testing atomic create-or-return under race condition',
        category: 'support',
        idempotencyKey: concurrentIdempKey,
      },
      activePortalCookies,
      { 'x-portal-csrf': activeCsrfToken }
    ),
  ]);

  assert(
    (concurrentReq1.statusCode === 201 || concurrentReq1.statusCode === 200) &&
    (concurrentReq2.statusCode === 201 || concurrentReq2.statusCode === 200) &&
    concurrentReq1.body.data?.requestNumber === concurrentReq2.body.data?.requestNumber,
    '14c. Concurrent Idempotency: Simultaneous duplicate submissions safely resolve to same request without error'
  );

  const concurrentReqDbCount = await CustomerRequest.countDocuments({
    clientId: clientA._id,
    idempotencyKey: concurrentIdempKey,
  });
  const concurrentTaskDbCount = await Task.countDocuments({
    clientId: clientA._id,
    title: { $regex: concurrentReq1.body.data?.requestNumber },
  });
  const concurrentAuditDbCount = await AuditLog.countDocuments({
    clientId: clientA._id,
    action: 'portal.request.create',
    resourceId: concurrentReq1.body.data?._id,
  });

  assert(
    concurrentReqDbCount === 1 && concurrentTaskDbCount === 1 && concurrentAuditDbCount === 1,
    '14d. Concurrency Safety: Zero duplicate CustomerRequest, Task, or Audit records created under race conditions'
  );

  // Test 14e: Conflicting payload with same idempotencyKey returns 409
  const conflictReqRes = await makeRequest(
    'POST',
    '/api/v1/portal/requests',
    {
      subject: 'DIFFERENT CONFLICTING SUBJECT',
      description: 'Testing conflict rejection',
      category: 'billing',
      idempotencyKey: concurrentIdempKey,
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );
  assert(
    conflictReqRes.statusCode === 409,
    '14e. Idempotency Conflict Defense: Conflicting payload with identical idempotencyKey rejected with 409 Conflict'
  );

  // Test 15: Attachment Authorization & Validation
  const dangerousAttachmentRes = await makeRequest(
    'POST',
    '/api/v1/portal/requests',
    {
      subject: 'Test dangerous attachment',
      description: 'Trying to upload script file',
      category: 'support',
      idempotencyKey: `idemp_bad_${Date.now()}`,
      attachments: [
        {
          id: 'bad_1',
          name: 'malware.exe',
          url: 'https://storage.local/malware.exe',
          size: 1024,
          mimeType: 'application/x-msdownload',
        },
      ],
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    dangerousAttachmentRes.statusCode === 422 && dangerousAttachmentRes.body.message.includes('.exe'),
    '15. Attachment Validation: Rejects prohibited executable file extensions (.exe) with 422',
    JSON.stringify(dangerousAttachmentRes.body)
  );

  // Test 15b: Attachment URL Scheme Validation
  const unsafeUrlAttachmentRes = await makeRequest(
    'POST',
    '/api/v1/portal/requests',
    {
      subject: 'Test dangerous url scheme',
      description: 'Trying javascript URL scheme',
      category: 'support',
      idempotencyKey: `idemp_url_${Date.now()}`,
      attachments: [
        {
          id: 'bad_url_1',
          name: 'doc.pdf',
          url: 'javascript:alert(document.cookie)',
          size: 1024,
          mimeType: 'application/pdf',
        },
      ],
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    unsafeUrlAttachmentRes.statusCode === 422,
    '15b. Attachment Protocol Safety: Dangerous URL scheme (javascript:) strictly rejected with 422'
  );

  console.log('--- Section 7: Message Visibility & Internal Note Stripping ---');

  // Test 16: Staff replies with internal note and customer-visible message
  const staffPublicMsgRes = await makeRequest(
    'POST',
    `/api/v1/client/portal/requests/${customerRequestId}/messages`,
    {
      body: 'Hello Alice, we have assigned engineer Dave to handle your delivery.',
      isCustomerVisible: true,
      attachments: [
        {
          id: 'att_public_doc',
          name: 'delivery_schedule.pdf',
          url: 'https://storage.local/delivery_schedule.pdf',
          size: 1024 * 20,
          mimeType: 'application/pdf',
        },
      ],
    },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );

  const staffInternalNoteRes = await makeRequest(
    'POST',
    `/api/v1/client/portal/requests/${customerRequestId}/messages`,
    {
      body: 'INTERNAL NOTE: Check customer billing status before committing to Friday.',
      isCustomerVisible: false,
      attachments: [
        {
          id: 'att_internal_audit_doc',
          name: 'credit_risk_assessment.pdf',
          url: 'https://storage.local/credit_risk_assessment.pdf',
          size: 1024 * 15,
          mimeType: 'application/pdf',
        },
      ],
    },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );

  assert(
    staffPublicMsgRes.statusCode === 201 && staffInternalNoteRes.statusCode === 201,
    '16. Staff adds public reply and internal note to customer request'
  );

  // Customer fetches the request detail
  const customerViewRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}`,
    undefined,
    activePortalCookies
  );

  const customerMessages = customerViewRes.body.data?.messages || [];
  const hasPublicMsg = customerMessages.some((m: any) => m.body.includes('assigned engineer Dave'));
  const hasInternalNote = customerMessages.some((m: any) => m.body.includes('INTERNAL NOTE'));

  assert(
    customerViewRes.statusCode === 200 && hasPublicMsg && !hasInternalNote,
    '16b. Record Visibility: Customer sees public replies but internal notes are strictly stripped',
    `messages=${JSON.stringify(customerMessages)}`
  );

  // Test 16c: Cross-Tenant Request IDOR Defense
  const clientBReq = await CustomerRequest.create({
    clientId: clientB._id,
    portalUserId: new mongoose.Types.ObjectId(),
    contactId: new mongoose.Types.ObjectId(),
    requestNumber: 'REQ-BETA-999',
    subject: 'Client B Confidential Request',
    description: 'Secret information for client B only',
    category: 'support',
    status: 'submitted',
    idempotencyKey: 'idemp_key_beta_999',
  });

  const crossTenantReqRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${clientBReq._id}`,
    undefined,
    activePortalCookies
  );

  assert(
    crossTenantReqRes.statusCode === 404,
    '16c. IDOR Defense: Cross-tenant customer request access returns 404 without leaking existence'
  );

  console.log('--- Section 7b: Direct Attachment Download Authorization ---');

  // Test 16c2: Pending attachment download is rejected with 423
  const pendingDownloadPreRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/att_1/download`,
    undefined,
    activePortalCookies
  );
  assert(
    pendingDownloadPreRes.statusCode === 423,
    '16c2. Malware Gate: Pending attachment download rejected with 423'
  );

  // Transition att_1 to clean via authenticated scanner webhook
  const scanEventTimestampPre = Date.now().toString();
  const scanPayloadPre = {
    eventId: `evt_${Date.now()}_init`,
    timestamp: scanEventTimestampPre,
    clientId: clientA._id.toString(),
    requestId: customerRequestId,
    attachmentId: 'att_1',
    verdict: 'clean' as const,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    scanner: 'ClamAV-Enterprise',
  };
  const scanSigPre = MalwareScannerService.generateWebhookSignature(
    JSON.stringify(scanPayloadPre),
    scanEventTimestampPre
  );

  const webhookPreRes = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    scanPayloadPre,
    undefined,
    {
      'x-scanner-signature': scanSigPre,
      'x-scanner-timestamp': scanEventTimestampPre,
    }
  );
  assert(
    webhookPreRes.statusCode === 200,
    '16c3. Malware Gate Webhook: Authenticated webhook transitions att_1 to clean'
  );

  // Test 16d: Authorized customer downloads primary request attachment
  const authDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/att_1/download`,
    undefined,
    activePortalCookies
  );
  assert(
    authDownloadRes.statusCode === 200 &&
    authDownloadRes.body.data?.name === 'project_spec.pdf' &&
    (authDownloadRes.body.data?.url === 'https://storage.local/project_spec.pdf' ||
      authDownloadRes.body.data?.url?.startsWith('https://storage.local/project_spec.pdf')),
    '16d. Attachment Download Auth: Authorized customer downloads request attachment (200)'
  );

  // Test 16e: Authorized customer downloads message attachment from customer-visible reply
  const msgAttDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/att_public_doc/download`,
    undefined,
    activePortalCookies
  );
  assert(
    msgAttDownloadRes.statusCode === 200 &&
    msgAttDownloadRes.body.data?.name === 'delivery_schedule.pdf' &&
    (msgAttDownloadRes.body.data?.url === 'https://storage.local/delivery_schedule.pdf' ||
      msgAttDownloadRes.body.data?.url?.startsWith('https://storage.local/delivery_schedule.pdf')),
    '16e. Attachment Download Auth: Customer downloads attachment from customer-visible message (200)'
  );

  // Test 16f: Attachment attached to internal note is blocked from customer download
  const internalAttRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/att_internal_audit_doc/download`,
    undefined,
    activePortalCookies
  );
  assert(
    internalAttRes.statusCode === 404,
    '16f. Attachment Download Isolation: Customer cannot download attachment from internal staff note (404)'
  );

  // Test 16g: Same-tenant user from wrong contact cannot download another contact's attachment
  const sameTenantWrongContactRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/att_1/download`,
    undefined,
    userCCookies
  );
  assert(
    sameTenantWrongContactRes.statusCode === 404,
    '16g. Attachment Download Contact Isolation: Same-tenant customer from different contact rejected (404 without leaking metadata)'
  );

  // Test 16h: Cross-tenant portal user cannot download attachment
  const crossTenantAttRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/att_1/download`,
    undefined,
    userBCookies
  );
  assert(
    crossTenantAttRes.statusCode === 404,
    '16h. Attachment Download Tenant Isolation: Cross-tenant portal user rejected (404)'
  );

  // Test 16i: Unauthenticated download request rejected with 401
  const unauthAttRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/att_1/download`
  );
  assert(
    unauthAttRes.statusCode === 401,
    '16i. Attachment Download Auth: Unauthenticated download request rejected with 401'
  );

  // Test 16j: Non-existent or tampered attachmentId returns 404
  const tamperedAttRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${customerRequestId}/attachments/fake_attachment_id/download`,
    undefined,
    activePortalCookies
  );
  assert(
    tamperedAttRes.statusCode === 404,
    '16j. Attachment Download Defense: Tampered or non-existent attachmentId returns 404'
  );

  // Test 17: Customer replies to request thread
  const customerReplyRes = await makeRequest(
    'POST',
    `/api/v1/portal/requests/${customerRequestId}/messages`,
    {
      body: 'Thank you for the update! Looking forward to hearing from Dave.',
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    customerReplyRes.statusCode === 200,
    '17. Customer adds follow-up message to ticket thread'
  );

  console.log('--- Section 8: Conversation Thread Isolation & Inbound Messaging ---');

  // Seed conversation for Contact A
  const convA = await Conversation.create({
    clientId: clientA._id,
    contactId: contactA._id,
    subject: 'Onboarding Assistance',
    channel: 'email',
    status: 'open',
    priority: 'medium',
    isArchived: false,
  });

  // Seed conversation for Contact B (Client B)
  const convB = await Conversation.create({
    clientId: clientB._id,
    contactId: contactB._id,
    subject: 'Client B Support',
    channel: 'email',
    status: 'open',
    priority: 'medium',
    isArchived: false,
  });

  // Seed normal message and internal note in Conv A
  await Message.create({
    clientId: clientA._id,
    conversationId: convA._id,
    contactId: contactA._id,
    senderType: 'user',
    senderName: 'Onboarding Agent',
    channel: 'email',
    direction: 'outbound',
    body: 'Welcome to your onboarding workspace!',
    isInternal: false,
    isCustomerVisible: true,
  });

  await Message.create({
    clientId: clientA._id,
    conversationId: convA._id,
    contactId: contactA._id,
    senderType: 'user',
    senderName: 'Internal Staff',
    channel: 'internal',
    direction: 'outbound',
    body: 'INTERNAL NOTE: Lead might churn if SLA not met.',
    isInternal: true,
    isCustomerVisible: false,
  });

  // Seed legacy message with missing/undefined isCustomerVisible
  await Message.collection.insertOne({
    clientId: clientA._id,
    conversationId: convA._id,
    contactId: contactA._id,
    senderType: 'user',
    senderName: 'Legacy Staff',
    channel: 'email',
    direction: 'outbound',
    body: 'LEGACY UNCLASSIFIED NOTE: Missing visibility field',
    deliveryStatus: 'delivered',
    retryCount: 0,
    attachments: [],
    isInternal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Test 18: Customer lists conversations
  const customerConvListRes = await makeRequest('GET', '/api/v1/portal/conversations', undefined, activePortalCookies);
  const convList = customerConvListRes.body.data || [];

  assert(
    customerConvListRes.statusCode === 200 &&
    convList.some((c: any) => c._id === convA._id.toString()) &&
    !convList.some((c: any) => c._id === convB._id.toString()),
    '18. Conversation Isolation: Customer only sees conversations for their own contactId (cross-tenant leakage prevented)'
  );

  // Test 18b: IDOR Defense - Customer Alice (Client A) cannot read Client B conversation
  const crossTenantConvRes = await makeRequest(
    'GET',
    `/api/v1/portal/conversations/${convB._id}/messages`,
    undefined,
    activePortalCookies
  );
  assert(
    crossTenantConvRes.statusCode === 404,
    '18b. IDOR Defense: Cross-tenant conversation access returns 404 without leaking existence'
  );

  // Test 19: Customer fetches conversation messages (internal messages stripped)
  const convMessagesRes = await makeRequest(
    'GET',
    `/api/v1/portal/conversations/${convA._id}/messages`,
    undefined,
    activePortalCookies
  );
  const convMessages = convMessagesRes.body.data?.messages || [];
  const hasConvPublic = convMessages.some((m: any) => m.body.includes('Welcome to your onboarding'));
  const hasConvInternal = convMessages.some((m: any) => m.body.includes('Lead might churn'));
  const hasLegacyUnclassified = convMessages.some((m: any) => m.body.includes('LEGACY UNCLASSIFIED NOTE'));

  assert(
    hasConvPublic && !hasConvInternal,
    '19. Message Channel Isolation: Internal channel & isInternal=true messages stripped from customer view'
  );

  assert(
    !hasLegacyUnclassified,
    '19b. Safe Default: Legacy message with missing isCustomerVisible field strictly excluded from customer view'
  );

  // Test 20: Inbound Customer Conversation Message
  const sendConvMsgRes = await makeRequest(
    'POST',
    `/api/v1/portal/conversations/${convA._id}/messages`,
    {
      body: 'Can we schedule a kick-off call for tomorrow afternoon?',
    },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    sendConvMsgRes.statusCode === 201 &&
    sendConvMsgRes.body.data?.direction === 'inbound',
    '20. Inbound Conversation Message: Customer message recorded with direction=inbound'
  );

  console.log('--- Section 9: Customer Visible Tasks & Action Completion ---');

  // Seed visible task and internal task
  const visibleTask = await Task.create({
    clientId: clientA._id,
    contactId: contactA._id,
    title: 'Upload Company Certificate of Incorporation',
    description: 'Please submit certificate copy for verification.',
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isCustomerVisible: true,
    customerActionRequired: true,
    customerActionDescription: 'Click Complete Action after attaching document.',
    status: 'open',
    priority: 'high',
    slaTargetMinutes: 1440,
    slaBreached: false,
  });

  const internalTask = await Task.create({
    clientId: clientA._id,
    contactId: contactA._id,
    title: 'Internal Risk Review',
    description: 'Review underwriting score.',
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isCustomerVisible: false,
    customerActionRequired: false,
    status: 'open',
    priority: 'normal',
    slaTargetMinutes: 1440,
    slaBreached: false,
  });

  // Test 21: Task Visibility Boundary
  const customerTasksRes = await makeRequest('GET', '/api/v1/portal/tasks', undefined, activePortalCookies);
  const customerTasks = customerTasksRes.body.data || [];
  const hasVisibleTask = customerTasks.some((t: any) => t._id === visibleTask._id.toString());
  const hasInternalTask = customerTasks.some((t: any) => t._id === internalTask._id.toString());

  assert(
    hasVisibleTask && !hasInternalTask,
    '21. Task Visibility Boundary: Customer only sees tasks where isCustomerVisible=true'
  );

  // Test 22: Atomic Task Completion
  const completeTaskRes = await makeRequest(
    'POST',
    `/api/v1/portal/tasks/${visibleTask._id}/complete`,
    { notes: 'Certificate uploaded to secure drop' },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    completeTaskRes.statusCode === 200 &&
    !!completeTaskRes.body.data?.customerCompletedAt,
    '22. Atomic Task Completion: Customer marks action item complete with notes'
  );

  const updatedTaskDb = await Task.findById(visibleTask._id);
  assert(
    !!updatedTaskDb?.customerCompletedAt,
    '22b. customerCompletedAt timestamp safely persisted in database'
  );

  // Test 22c: Customer cannot complete internal task (isCustomerVisible: false)
  const completeInternalTaskRes = await makeRequest(
    'POST',
    `/api/v1/portal/tasks/${internalTask._id}/complete`,
    { notes: 'Attacking internal task' },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );
  assert(
    completeInternalTaskRes.statusCode === 400,
    '22c. Narrow Task Authorization: Customer cannot complete internal task (isCustomerVisible=false rejected with 400)'
  );

  // Test 22d: Customer cannot complete task where customerActionRequired is false
  const nonActionableTask = await Task.create({
    clientId: clientA._id,
    contactId: contactA._id,
    title: 'Review Deliverable',
    description: 'Internal staff deliverable review',
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isCustomerVisible: true,
    customerActionRequired: false,
    status: 'open',
    priority: 'normal',
    slaTargetMinutes: 1440,
    slaBreached: false,
  });

  const completeNonActionableRes = await makeRequest(
    'POST',
    `/api/v1/portal/tasks/${nonActionableTask._id}/complete`,
    { notes: 'Attacking non-actionable task' },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );
  assert(
    completeNonActionableRes.statusCode === 400,
    '22d. Narrow Task Authorization: Customer cannot complete task where customerActionRequired=false (rejected with 400)'
  );

  // Test 23: Task Comment
  const commentTaskRes = await makeRequest(
    'POST',
    `/api/v1/portal/tasks/${visibleTask._id}/comments`,
    { comment: 'Please let me know if an apostille certificate is required.' },
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );

  assert(
    commentTaskRes.statusCode === 200,
    '23. Customer Task Comment: Comment logged to task event history'
  );

  const taskCommentEvent = await TaskEvent.findOne({
    taskId: visibleTask._id,
    eventType: 'customer_comment',
  });
  assert(
    !!taskCommentEvent && taskCommentEvent.description.includes('apostille'),
    '23b. TaskEvent recorded for customer comment'
  );

  console.log('--- Section 10: In-Portal Notifications ---');

  // Seed notification for portal user
  const portalUser = await PortalUser.findOne({ email: 'portal-test-alice@customer.local' });
  const notif = await Notification.create({
    clientId: clientA._id,
    recipientUserId: portalUser!._id,
    recipientType: 'portal_user',
    type: 'request_reply',
    title: 'New Reply Received',
    message: 'Staff replied to your request.',
    severity: 'info',
    sourceType: 'system',
  });

  // Test 24: Customer lists notifications
  const notifListRes = await makeRequest('GET', '/api/v1/portal/notifications', undefined, activePortalCookies);
  assert(
    notifListRes.statusCode === 200 && notifListRes.body.data?.length > 0,
    '24. Customer retrieves portal notifications'
  );

  // Test 25: Mark notification read
  const markReadRes = await makeRequest(
    'PATCH',
    `/api/v1/portal/notifications/${notif._id}/read`,
    {},
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );
  assert(
    markReadRes.statusCode === 200 && !!markReadRes.body.data?.readAt,
    '25. Customer marks notification as read'
  );

  // Test 26: Mark all notifications read
  const markAllReadRes = await makeRequest(
    'POST',
    '/api/v1/portal/notifications/read-all',
    {},
    activePortalCookies,
    { 'x-portal-csrf': activeCsrfToken }
  );
  assert(
    markAllReadRes.statusCode === 200,
    '26. Customer marks all notifications as read'
  );

  console.log('--- Section 11: Staff Management & RBAC Permissions ---');

  // Test 27: Staff with portal.view can list portal users & requests
  const staffListUsersRes = await makeRequest(
    'GET',
    '/api/v1/client/portal/users',
    undefined,
    viewerCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    staffListUsersRes.statusCode === 200 && staffListUsersRes.body.data?.users?.length > 0,
    '27. Staff with portal.view can list customer portal users'
  );

  const staffListReqsRes = await makeRequest(
    'GET',
    '/api/v1/client/portal/requests',
    undefined,
    viewerCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    staffListReqsRes.statusCode === 200,
    '27b. Staff with portal.view can list customer requests'
  );

  // Test 28: Staff without portal.manage cannot invite or suspend
  const unauthorizedInviteRes = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    { contactId: contactA._id.toString(), email: 'portal-test-extra@test.local' },
    viewerCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    unauthorizedInviteRes.statusCode === 403,
    '28. RBAC: Staff without portal.manage permission rejected (403) from inviting customers'
  );

  // Test 29: Staff with portal.manage can suspend portal user & revoke session
  const suspendUserRes = await makeRequest(
    'PATCH',
    `/api/v1/client/portal/users/${portalUser!._id}/status`,
    { status: 'suspended' },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );

  assert(
    suspendUserRes.statusCode === 200 && suspendUserRes.body.data?.user?.status === 'suspended',
    '29. Staff with portal.manage suspends portal user'
  );

  // Verify suspended portal user is immediately rejected
  const suspendedMeRes = await makeRequest('GET', '/api/v1/portal/auth/me', undefined, activePortalCookies);
  assert(
    suspendedMeRes.statusCode === 401 || suspendedMeRes.statusCode === 403,
    '29b. Suspended customer user session immediately blocked'
  );

  console.log('--- Section 11b: Comprehensive Invitation Lifecycle Coverage ---');

  // Test 30: Re-invitation after suspension is rejected (409 Conflict)
  const reinviteSuspendedRes = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    { contactId: contactA._id.toString(), email: contactA.email },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    reinviteSuspendedRes.statusCode === 409,
    '30. Invitation Lifecycle: Re-invitation of suspended customer rejected (409 Conflict)'
  );

  // Test 31: Staff reactivates portal user
  const reactivateUserRes = await makeRequest(
    'PATCH',
    `/api/v1/client/portal/users/${portalUser!._id}/status`,
    { status: 'active' },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    reactivateUserRes.statusCode === 200 && reactivateUserRes.body.data?.user?.status === 'active',
    '31. Staff with portal.manage reactivates portal user'
  );

  // Test 32: Re-invitation after reactivation is rejected (409 Conflict)
  const reinviteActiveRes = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    { contactId: contactA._id.toString(), email: contactA.email },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    reinviteActiveRes.statusCode === 409,
    '32. Invitation Lifecycle: Re-invitation of reactivated customer rejected (409 Conflict)'
  );

  // Test 33: Duplicate email invitation across different contacts in same workspace rejected
  const dupEmailInviteRes = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    { contactId: contactC._id.toString(), email: contactA.email },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    dupEmailInviteRes.statusCode === 409,
    '33. Invitation Lifecycle: Invitation with duplicate active email rejected (409 Conflict)'
  );

  // Test 34: Replacement / automatic revocation of older pending invitations
  const contactD = await Contact.create({
    clientId: clientA._id,
    name: 'Dana Unaccepted Contact',
    email: 'portal-test-dana@customer.local',
  });

  const invite1Res = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    { contactId: contactD._id.toString(), email: contactD.email },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  const invite1Id = invite1Res.body.data?.invitation?._id;

  const invite2Res = await makeRequest(
    'POST',
    '/api/v1/client/portal/invitations',
    { contactId: contactD._id.toString(), email: contactD.email },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  const invite2Id = invite2Res.body.data?.invitation?._id;

  const prevInviteDb = await PortalInvitation.findById(invite1Id);
  const currInviteDb = await PortalInvitation.findById(invite2Id);

  assert(
    prevInviteDb?.status === 'revoked' && currInviteDb?.status === 'pending',
    '34. Invitation Lifecycle: Older pending invitation automatically revoked upon re-invitation'
  );

  // Test 35: Unique Compound Index enforcement at Database Level
  let dbDuplicateEmailError: any;
  try {
    await PortalUser.create({
      clientId: clientA._id,
      contactId: new mongoose.Types.ObjectId(),
      name: 'Duplicate Email Attempt',
      email: contactA.email,
      passwordHash: 'dummy_hash',
      status: 'active',
      tokenVersion: 0,
      consentGiven: true,
    });
  } catch (err: any) {
    dbDuplicateEmailError = err;
  }
  assert(
    dbDuplicateEmailError?.code === 11000,
    '35. Database Uniqueness: Direct creation with duplicate email rejected by Mongo unique index (code 11000)'
  );

  let dbDuplicateContactError: any;
  try {
    await PortalUser.create({
      clientId: clientA._id,
      contactId: contactA._id,
      name: 'Duplicate Contact Attempt',
      email: 'unique-random-email-xyz@test.local',
      passwordHash: 'dummy_hash',
      status: 'active',
      tokenVersion: 0,
      consentGiven: true,
    });
  } catch (err: any) {
    dbDuplicateContactError = err;
  }
  assert(
    dbDuplicateContactError?.code === 11000,
    '35b. Database Uniqueness: Direct creation with duplicate contactId rejected by Mongo unique index (code 11000)'
  );

  // Test 36: Zero token leakage in responses and audit logs
  const inviteAudit = await AuditLog.findOne({
    clientId: clientA._id,
    action: 'portal.invitation.create',
    resourceId: invite2Id,
  });
  assert(
    inviteAudit !== null &&
    !JSON.stringify(inviteAudit).includes(invite2Res.body.data?.rawToken || 'NEVER_MATCH') &&
    invite2Res.body.data?.invitation?.tokenHash === undefined,
    '36. Invitation Security: Raw token and tokenHash are never leaked in response bodies or audit logs'
  );

  console.log('--- Section 12: Comprehensive CSRF Mutation Matrix ---');

  // Re-login Alice to get fresh active session and CSRF token
  const matrixLoginRes = await makeRequest('POST', '/api/v1/portal/auth/login', {
    email: 'portal-test-alice@customer.local',
    password: 'BrandNewerPassword456!',
  });
  let matrixCookies = matrixLoginRes.headers['set-cookie'] as string[];
  let matrixCsrfToken = matrixLoginRes.body.data?.csrfToken;
  const matrixBearerToken = matrixLoginRes.body.data?.token;

  // Seed actionable task for matrix completion test
  const matrixTask = await Task.create({
    clientId: clientA._id,
    contactId: contactA._id,
    title: 'CSRF Matrix Action Item',
    description: 'Complete this action item',
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    taskType: 'other',
    priority: 'normal',
    isCustomerVisible: true,
    customerActionRequired: true,
    status: 'open',
  });

  // Seed notification for matrix read test
  const matrixNotif = await Notification.create({
    clientId: clientA._id,
    recipientUserId: portalUser!._id,
    recipientType: 'portal_user',
    type: 'request_reply',
    title: 'CSRF Matrix Notification',
    message: 'Testing notification read in matrix',
    severity: 'info',
    sourceType: 'system',
  });

  // 1. Read-only requests remain unaffected by CSRF requirements
  const readOnlyEndpoints = [
    '/api/v1/portal/profile',
    '/api/v1/portal/requests',
    '/api/v1/portal/tasks',
    '/api/v1/portal/conversations',
    '/api/v1/portal/notifications',
  ];
  for (const rEp of readOnlyEndpoints) {
    const readOnlyRes = await makeRequest('GET', rEp, undefined, matrixCookies);
    assert(
      readOnlyRes.statusCode === 200,
      `CSRF Matrix [Read-Only Safe]: GET ${rEp} with cookie succeeds (200) without CSRF header`
    );
  }

  // 2. Bearer-token requests remain exempt without cookies
  const bearerProfileRes = await makeRequest(
    'PATCH',
    '/api/v1/portal/profile',
    { name: 'Alice Bearer Verified' },
    undefined,
    { Authorization: `Bearer ${matrixBearerToken}` }
  );
  assert(
    bearerProfileRes.statusCode === 200,
    'CSRF Matrix [Bearer Exemption]: Authorization Bearer mutation without cookie succeeds without CSRF header'
  );

  const bearerReqRes = await makeRequest(
    'POST',
    '/api/v1/portal/requests',
    {
      subject: 'Bearer Token Request',
      description: 'Submitted via bearer auth',
      category: 'support',
      idempotencyKey: 'bearer_req_' + Date.now(),
    },
    undefined,
    { Authorization: `Bearer ${matrixBearerToken}` }
  );
  assert(
    bearerReqRes.statusCode === 201,
    'CSRF Matrix [Bearer Exemption]: Bearer request creation succeeds without CSRF header'
  );

  interface MutationCase {
    routeId: string;
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;
    payload: Record<string, any>;
  }

  const mutationMatrix: MutationCase[] = [
    {
      routeId: 'M1. Profile Update',
      method: 'PATCH',
      path: '/api/v1/portal/profile',
      payload: { name: 'Alice Matrix Verified' },
    },
    {
      routeId: 'M2. Profile Change Request',
      method: 'POST',
      path: '/api/v1/portal/profile/change-request',
      payload: { fieldName: 'phone', requestedValue: '+15550001111', reason: 'Phone update' },
    },
    {
      routeId: 'M3. Request Creation (with attachment)',
      method: 'POST',
      path: '/api/v1/portal/requests',
      payload: {
        subject: 'Matrix CSRF Test Request',
        description: 'Testing CSRF validation on request creation',
        category: 'support',
        idempotencyKey: 'matrix_req_csrf_' + Date.now(),
        attachments: [
          {
            id: 'att_matrix_req',
            name: 'matrix_doc.pdf',
            url: 'https://storage.local/matrix_doc.pdf',
            size: 2048,
            mimeType: 'application/pdf',
          },
        ],
      },
    },
    {
      routeId: 'M4. Request Message Reply (with attachment)',
      method: 'POST',
      path: `/api/v1/portal/requests/${customerRequestId}/messages`,
      payload: {
        body: 'Matrix message with attachment reply',
        attachments: [
          {
            id: 'att_matrix_reply',
            name: 'matrix_reply.pdf',
            url: 'https://storage.local/matrix_reply.pdf',
            size: 4096,
            mimeType: 'application/pdf',
          },
        ],
      },
    },
    {
      routeId: 'M5. Conversation Message',
      method: 'POST',
      path: `/api/v1/portal/conversations/${convA._id}/messages`,
      payload: { body: 'Matrix conversation message test' },
    },
    {
      routeId: 'M6. Task Action Completion',
      method: 'POST',
      path: `/api/v1/portal/tasks/${matrixTask._id}/complete`,
      payload: { notes: 'Completed in matrix' },
    },
    {
      routeId: 'M7. Task Comment',
      method: 'POST',
      path: `/api/v1/portal/tasks/${visibleTask._id}/comments`,
      payload: { comment: 'Matrix task comment verification' },
    },
    {
      routeId: 'M8. Notification Mark Read',
      method: 'PATCH',
      path: `/api/v1/portal/notifications/${matrixNotif._id}/read`,
      payload: {},
    },
    {
      routeId: 'M9. Notifications Mark All Read',
      method: 'POST',
      path: '/api/v1/portal/notifications/read-all',
      payload: {},
    },
    {
      routeId: 'M10. Authenticated Password Change',
      method: 'POST',
      path: '/api/v1/portal/auth/change-password',
      payload: {
        currentPassword: 'BrandNewerPassword456!',
        newPassword: 'MatrixFinalPassword123!',
      },
    },
    {
      routeId: 'M11. Logout',
      method: 'POST',
      path: '/api/v1/portal/auth/logout',
      payload: {},
    },
  ];

  for (const mCase of mutationMatrix) {
    // a) Missing CSRF header rejected with 403
    const missingCsrfRes = await makeRequest(
      mCase.method,
      mCase.path,
      mCase.payload,
      matrixCookies
    );
    assert(
      missingCsrfRes.statusCode === 403,
      `CSRF Matrix [${mCase.routeId}]: Missing x-portal-csrf header strictly rejected with 403`
    );

    // b) Incorrect / invalid CSRF header rejected with 403
    const invalidCsrfRes = await makeRequest(
      mCase.method,
      mCase.path,
      mCase.payload,
      matrixCookies,
      { 'x-portal-csrf': 'invalid_forged_csrf_token_xyz' }
    );
    assert(
      invalidCsrfRes.statusCode === 403,
      `CSRF Matrix [${mCase.routeId}]: Forged/invalid x-portal-csrf header strictly rejected with 403`
    );

    // c) Cross-session CSRF token rejected with 403
    const crossSessionCsrfRes = await makeRequest(
      mCase.method,
      mCase.path,
      mCase.payload,
      matrixCookies,
      { 'x-portal-csrf': userCCsrfToken }
    );
    assert(
      crossSessionCsrfRes.statusCode === 403,
      `CSRF Matrix [${mCase.routeId}]: Cross-session CSRF token from another user strictly rejected with 403`
    );

    // d) Correct per-session CSRF token succeeds
    const validCsrfRes = await makeRequest(
      mCase.method,
      mCase.path,
      mCase.payload,
      matrixCookies,
      { 'x-portal-csrf': matrixCsrfToken }
    );
    assert(
      validCsrfRes.statusCode === 200 || validCsrfRes.statusCode === 201,
      `CSRF Matrix [${mCase.routeId}]: Valid per-session CSRF token succeeds (${validCsrfRes.statusCode})`
    );

    // If cookies were refreshed (e.g. on password change), update matrix cookies and CSRF token
    if (validCsrfRes.headers['set-cookie']) {
      matrixCookies = validCsrfRes.headers['set-cookie'] as string[];
    }
    if (validCsrfRes.body.data?.csrfToken) {
      matrixCsrfToken = validCsrfRes.body.data.csrfToken;
    }
  }

  console.log('\n--- Section 13: Production Malware-Scanning Gate & Quarantine Verification ---');

  // Re-authenticate Alice after matrix password update and logout
  const reAuthRes = await makeRequest('POST', '/api/v1/portal/auth/login', {
    email: 'portal-test-alice@customer.local',
    password: 'MatrixFinalPassword123!',
  });
  assert(reAuthRes.statusCode === 200, 'Section 13 Re-Auth: Alice logs in with MatrixFinalPassword123!');
  const gatePortalCookies = reAuthRes.headers['set-cookie'] as string[];
  const gateCsrfToken = reAuthRes.body.data?.csrfToken;

  // Test 26a: Create request with pending attachment in quarantine
  const gatePendingReqRes = await makeRequest(
    'POST',
    '/api/v1/portal/requests',
    {
      subject: 'Security Scan Verification Ticket',
      description: 'Attachment test ticket for quarantine and scanning verification.',
      category: 'support',
      priority: 'normal',
      idempotencyKey: `idemp_gate_${Date.now()}`,
      attachments: [
        {
          id: 'att_gate_pending',
          name: 'financial_records.pdf',
          url: 'https://storage.local/financial_records.pdf',
          size: 1024 * 60,
          mimeType: 'application/pdf',
        },
      ],
    },
    gatePortalCookies,
    { 'x-portal-csrf': gateCsrfToken }
  );
  const gateRequestId = gatePendingReqRes.body.data?._id;
  assert(
    gatePendingReqRes.statusCode === 201 && !!gateRequestId,
    '26a. Malware Gate: Request created with quarantined attachment in pending status'
  );

  // Test 26b: Pending attachment download rejected with 423
  const pendingGateDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_pending/download`,
    undefined,
    gatePortalCookies
  );
  assert(
    pendingGateDownloadRes.statusCode === 423,
    '26b. Malware Gate: Pending attachment download strictly rejected with 423 Locked'
  );

  // Test 26c: Unauthorized scan callback rejected (missing header)
  const unauthWebhookRes1 = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    {
      eventId: `evt_${Date.now()}_unauth`,
      timestamp: Date.now().toString(),
      clientId: clientA._id.toString(),
      requestId: gateRequestId,
      attachmentId: 'att_gate_pending',
      verdict: 'clean',
    }
  );
  assert(
    unauthWebhookRes1.statusCode === 401,
    '26c. Malware Gate Webhook: Missing signature headers rejected with 401'
  );

  // Test 26d: Unauthorized scan callback rejected (forged signature)
  const unauthWebhookRes2 = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    {
      eventId: `evt_${Date.now()}_forged`,
      timestamp: Date.now().toString(),
      clientId: clientA._id.toString(),
      requestId: gateRequestId,
      attachmentId: 'att_gate_pending',
      verdict: 'clean',
    },
    undefined,
    {
      'x-scanner-signature': '0000000000000000000000000000000000000000000000000000000000000000',
      'x-scanner-timestamp': Date.now().toString(),
    }
  );
  assert(
    unauthWebhookRes2.statusCode === 401,
    '26d. Malware Gate Webhook: Forged signature strictly rejected with 401'
  );

  // Test 26e: Unauthorized scan callback rejected (stale timestamp > 5 min)
  const staleTimestamp = (Date.now() - 10 * 60 * 1000).toString();
  const stalePayload = {
    eventId: `evt_${Date.now()}_stale`,
    timestamp: staleTimestamp,
    clientId: clientA._id.toString(),
    requestId: gateRequestId,
    attachmentId: 'att_gate_pending',
    verdict: 'clean' as const,
  };
  const staleSig = MalwareScannerService.generateWebhookSignature(JSON.stringify(stalePayload), staleTimestamp);
  const staleWebhookRes = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    stalePayload,
    undefined,
    {
      'x-scanner-signature': staleSig,
      'x-scanner-timestamp': staleTimestamp,
    }
  );
  assert(
    staleWebhookRes.statusCode === 401,
    '26e. Malware Gate Webhook: Stale timestamp rejected with 401'
  );

  // Test 26f: Callback cannot mark an attachment clean without a valid scanner event (invalid verdict)
  const invalidVerdictTimestamp = Date.now().toString();
  const invalidVerdictPayload = {
    eventId: `evt_${Date.now()}_invalid_v`,
    timestamp: invalidVerdictTimestamp,
    clientId: clientA._id.toString(),
    requestId: gateRequestId,
    attachmentId: 'att_gate_pending',
    verdict: 'bypass_unapproved' as any,
  };
  const invalidVerdictSig = MalwareScannerService.generateWebhookSignature(
    JSON.stringify(invalidVerdictPayload),
    invalidVerdictTimestamp
  );
  const invalidVerdictRes = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    invalidVerdictPayload,
    undefined,
    {
      'x-scanner-signature': invalidVerdictSig,
      'x-scanner-timestamp': invalidVerdictTimestamp,
    }
  );
  assert(
    invalidVerdictRes.statusCode === 422,
    '26f. Malware Gate Webhook: Invalid scanner verdict rejected with 422'
  );

  // Test 26g: Callback cannot alter an attachment in another tenant
  const crossTenantCbTimestamp = Date.now().toString();
  const crossTenantCbPayload = {
    eventId: `evt_${Date.now()}_cross_tenant`,
    timestamp: crossTenantCbTimestamp,
    clientId: clientB._id.toString(), // clientB instead of clientA
    requestId: gateRequestId,
    attachmentId: 'att_gate_pending',
    verdict: 'clean' as const,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  };
  const crossTenantCbSig = MalwareScannerService.generateWebhookSignature(
    JSON.stringify(crossTenantCbPayload),
    crossTenantCbTimestamp
  );
  const crossTenantCbRes = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    crossTenantCbPayload,
    undefined,
    {
      'x-scanner-signature': crossTenantCbSig,
      'x-scanner-timestamp': crossTenantCbTimestamp,
    }
  );
  assert(
    crossTenantCbRes.statusCode === 404,
    '26g. Malware Gate Webhook: Tenant mismatch callback rejected with 404'
  );

  // Test 26h: Authorized scan callback marks attachment clean
  const cleanCbTimestamp = Date.now().toString();
  const cleanSha256 = crypto.createHash('sha256').update('att_gate_pending_clean_file').digest('hex');
  const cleanCbPayload = {
    eventId: `evt_${Date.now()}_clean`,
    timestamp: cleanCbTimestamp,
    clientId: clientA._id.toString(),
    requestId: gateRequestId,
    attachmentId: 'att_gate_pending',
    verdict: 'clean' as const,
    sha256: cleanSha256,
    scanner: 'ClamAV-Enterprise',
  };
  const cleanCbSig = MalwareScannerService.generateWebhookSignature(
    JSON.stringify(cleanCbPayload),
    cleanCbTimestamp
  );
  const cleanCbRes = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    cleanCbPayload,
    undefined,
    {
      'x-scanner-signature': cleanCbSig,
      'x-scanner-timestamp': cleanCbTimestamp,
    }
  );
  assert(
    cleanCbRes.statusCode === 200 && cleanCbRes.body.data?.verdict === 'clean',
    '26h. Malware Gate Webhook: Authenticated callback marks attachment clean (200)'
  );

  // Test 26i: Replay of the same scan callback is idempotent
  const replayCbRes = await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    cleanCbPayload,
    undefined,
    {
      'x-scanner-signature': cleanCbSig,
      'x-scanner-timestamp': cleanCbTimestamp,
    }
  );
  assert(
    replayCbRes.statusCode === 200 && replayCbRes.body.data?.status === 'idempotent_noop',
    '26i. Malware Gate Webhook: Replay of identical scan event is idempotent (status: idempotent_noop)'
  );

  // Test 26j: Clean attachment download succeeds for authorized user with short-lived URL
  const cleanDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_pending/download`,
    undefined,
    gatePortalCookies
  );
  assert(
    cleanDownloadRes.statusCode === 200 &&
      cleanDownloadRes.body.data?.name === 'financial_records.pdf' &&
      cleanDownloadRes.body.data?.url?.includes('downloadToken=') &&
      cleanDownloadRes.body.data?.url?.includes('expires='),
    '26j. Malware Gate: Clean attachment download succeeds with short-lived tokenized URL (200)'
  );

  // Test 26k: Malicious attachment callback and download rejection (403)
  const msgMaliciousRes = await makeRequest(
    'POST',
    `/api/v1/portal/requests/${gateRequestId}/messages`,
    {
      body: 'Here is the questionable archive requested.',
      attachments: [
        {
          id: 'att_gate_malicious',
          name: 'malware_sample.pdf',
          url: 'https://storage.local/malware_sample.pdf',
          size: 1024 * 30,
          mimeType: 'application/pdf',
        },
      ],
    },
    gatePortalCookies,
    { 'x-portal-csrf': gateCsrfToken }
  );
  assert(msgMaliciousRes.statusCode === 200, '26k. Setup: Customer added message with att_gate_malicious');

  const malCbTimestamp = Date.now().toString();
  const malCbPayload = {
    eventId: `evt_${Date.now()}_malicious`,
    timestamp: malCbTimestamp,
    clientId: clientA._id.toString(),
    requestId: gateRequestId,
    attachmentId: 'att_gate_malicious',
    verdict: 'malicious' as const,
    signature: 'Win32.Trojan.Generic',
    scanner: 'ClamAV-Enterprise',
  };
  const malCbSig = MalwareScannerService.generateWebhookSignature(
    JSON.stringify(malCbPayload),
    malCbTimestamp
  );
  await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    malCbPayload,
    undefined,
    {
      'x-scanner-signature': malCbSig,
      'x-scanner-timestamp': malCbTimestamp,
    }
  );

  const maliciousDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_malicious/download`,
    undefined,
    gatePortalCookies
  );
  assert(
    maliciousDownloadRes.statusCode === 403,
    '26l. Malware Gate: Malicious attachment download strictly rejected with 403 Forbidden'
  );

  // Test 26m: Scan failure download rejected (423)
  const msgFailedRes = await makeRequest(
    'POST',
    `/api/v1/portal/requests/${gateRequestId}/messages`,
    {
      body: 'Here is another file where scan engine will fail.',
      attachments: [
        {
          id: 'att_gate_failed',
          name: 'corrupt_doc.pdf',
          url: 'https://storage.local/corrupt_doc.pdf',
          size: 1024 * 10,
          mimeType: 'application/pdf',
        },
      ],
    },
    gatePortalCookies,
    { 'x-portal-csrf': gateCsrfToken }
  );
  assert(msgFailedRes.statusCode === 200, '26m. Setup: Customer added message with att_gate_failed');

  const failedCbTimestamp = Date.now().toString();
  const failedCbPayload = {
    eventId: `evt_${Date.now()}_failed`,
    timestamp: failedCbTimestamp,
    clientId: clientA._id.toString(),
    requestId: gateRequestId,
    attachmentId: 'att_gate_failed',
    verdict: 'scan_failed' as const,
    error: 'Scanner service timeout after 30s',
  };
  const failedCbSig = MalwareScannerService.generateWebhookSignature(
    JSON.stringify(failedCbPayload),
    failedCbTimestamp
  );
  await makeRequest(
    'POST',
    '/api/v1/portal/webhooks/malware-scan',
    failedCbPayload,
    undefined,
    {
      'x-scanner-signature': failedCbSig,
      'x-scanner-timestamp': failedCbTimestamp,
    }
  );

  const failedDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_failed/download`,
    undefined,
    gatePortalCookies
  );
  assert(
    failedDownloadRes.statusCode === 423,
    '26n. Malware Gate: Scan failed attachment download strictly rejected with 423 Locked'
  );

  // Test 26o: Expired scan verdict download rejected (423)
  await CustomerRequest.updateOne(
    { _id: gateRequestId, 'attachments.id': 'att_gate_pending' },
    { $set: { 'attachments.$.scanExpiresAt': new Date(Date.now() - 60000) } } // expired 1 min ago
  );
  const expiredDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_pending/download`,
    undefined,
    gatePortalCookies
  );
  assert(
    expiredDownloadRes.statusCode === 423,
    '26o. Malware Gate: Expired scan verdict download strictly rejected with 423 Locked'
  );

  // Restore clean unexpired state for isolation checks
  await CustomerRequest.updateOne(
    { _id: gateRequestId, 'attachments.id': 'att_gate_pending' },
    { $set: { 'attachments.$.scanExpiresAt': new Date(Date.now() + 86400000) } }
  );

  // Test 26p: Same-tenant wrong-contact download rejected (404)
  const sameTenantWrongContactGateRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_pending/download`,
    undefined,
    userCCookies
  );
  assert(
    sameTenantWrongContactGateRes.statusCode === 404,
    '26p. Malware Gate Isolation: Same-tenant wrong-contact download rejected with 404'
  );

  // Test 26q: Cross-tenant download rejected (404)
  const crossTenantGateRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_pending/download`,
    undefined,
    userBCookies
  );
  assert(
    crossTenantGateRes.statusCode === 404,
    '26q. Malware Gate Isolation: Cross-tenant download rejected with 404'
  );

  // Test 26r: Internal staff-note attachment download rejected (404)
  const staffInternalNoteGateRes = await makeRequest(
    'POST',
    `/api/v1/client/portal/requests/${gateRequestId}/messages`,
    {
      body: 'INTERNAL NOTE: Sensitive staff notes with internal doc.',
      isCustomerVisible: false,
      attachments: [
        {
          id: 'att_gate_internal',
          name: 'internal_security_audit.pdf',
          url: 'https://storage.local/internal_security_audit.pdf',
          size: 1024 * 12,
          mimeType: 'application/pdf',
        },
      ],
    },
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(staffInternalNoteGateRes.statusCode === 201, '26r. Setup: Staff added internal note with attachment');

  const internalNoteDownloadRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}/attachments/att_gate_internal/download`,
    undefined,
    gatePortalCookies
  );
  assert(
    internalNoteDownloadRes.statusCode === 404,
    '26s. Malware Gate Isolation: Customer downloading internal staff-note attachment rejected with 404'
  );

  // Test 26t: Quarantine storage key is never directly exposed in API responses
  const getReqDetailRes = await makeRequest(
    'GET',
    `/api/v1/portal/requests/${gateRequestId}`,
    undefined,
    gatePortalCookies
  );
  const rawResponseString = JSON.stringify(getReqDetailRes.body);
  assert(
    getReqDetailRes.statusCode === 200 &&
      !rawResponseString.includes('quarantineKey') &&
      !rawResponseString.includes('cleanStorageKey') &&
      !rawResponseString.includes('quarantineBucket'),
    '26t. Information Disclosure Defense: Quarantine and clean storage keys are never exposed in API responses'
  );

  // Test 26u: Staff attachment download succeeds for clean attachment and rejects malicious/pending
  const staffCleanDownloadRes = await makeRequest(
    'GET',
    `/api/v1/client/portal/requests/${gateRequestId}/attachments/att_gate_pending/download`,
    undefined,
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    staffCleanDownloadRes.statusCode === 200 &&
      staffCleanDownloadRes.body.data?.name === 'financial_records.pdf' &&
      staffCleanDownloadRes.body.data?.url?.includes('downloadToken='),
    '26u. Staff Malware Gate: Staff download of clean attachment succeeds with signed URL'
  );

  const staffMaliciousDownloadRes = await makeRequest(
    'GET',
    `/api/v1/client/portal/requests/${gateRequestId}/attachments/att_gate_malicious/download`,
    undefined,
    staffCookies,
    { 'x-client-id': clientA._id.toString() }
  );
  assert(
    staffMaliciousDownloadRes.statusCode === 403,
    '26v. Staff Malware Gate: Staff download of malicious attachment strictly rejected with 403'
  );

  // Test summary
  console.log('\n==================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Test Results: ${passedCount} passed, ${failedCount} failed of ${results.length} assertions`);
  console.log('==================================================\n');

  testServer.close();
  await disconnectDatabase();

  if (failedCount > 0) {
    process.exit(1);
  }
};

runPortalTestSuite().catch((err) => {
  console.error('Fatal error running portal test suite:', err);
  if (testServer) testServer.close();
  process.exit(1);
});
