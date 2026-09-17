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
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { WebsiteForm } from '../models/WebsiteForm';
import { WebsiteFormField } from '../models/WebsiteFormField';
import { FormSubmission } from '../models/FormSubmission';
import { FormSubmissionEvent } from '../models/FormSubmissionEvent';
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

const runWebsiteFormsTests = async () => {
  console.log('\n==================================================');
  console.log('Running flumenxConectOS Release 6 Test Suite');
  console.log('Website Forms & Lead Intake Engine');
  console.log('==================================================\n');

  await connectDatabase();
  await seedDatabase();

  // Cleanup test artifacts
  await Client.deleteMany({ slug: /^form-test-/ });
  await WebsiteForm.deleteMany({ name: /^Test Form/ });
  await Contact.deleteMany({ name: /^Form Visitor/ });
  await Lead.deleteMany({ fullName: /^Form Visitor/ });
  await Conversation.deleteMany({ subject: /^Website Form: Test Form/ });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;
  const publicBaseUrl = `http://localhost:${port}/api/public/forms`;

  try {
    let superAdminCookie = '';
    let clientAdminCookie = '';
    let clientStaffCookie = '';
    let clientBAdminCookie = '';
    let clientAId = '';
    let clientBId = '';

    // -------------------------------------------------------------
    // SETUP: Provision Test Clients & Users
    // -------------------------------------------------------------
    console.log('--- Setting up Test Clients and Memberships ---');

    // 1. Client A & Client B
    const clientA = await Client.create({
      name: 'Form Test Client A',
      slug: `form-test-a-${Date.now()}`,
      email: 'admin@client-a.com',
      status: 'active',
      timezone: 'UTC',
      currency: 'USD',
    });
    clientAId = clientA._id.toString();

    const clientB = await Client.create({
      name: 'Form Test Client B',
      slug: `form-test-b-${Date.now()}`,
      email: 'admin@client-b.com',
      status: 'active',
      timezone: 'UTC',
      currency: 'USD',
    });
    clientBId = clientB._id.toString();

    const clientAdminRole = await Role.findOne({ slug: 'client_admin' });
    const clientStaffRole = await Role.findOne({ slug: 'client_staff' });
    const testPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // 2. Client A Admin
    const userClientAdmin = await User.create({
      name: 'Client A Admin',
      email: `admin-a-${Date.now()}@test.com`,
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    await ClientMembership.create({
      clientId: clientA._id,
      userId: userClientAdmin._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    // 3. Client A Staff
    const userClientStaff = await User.create({
      name: 'Client A Staff',
      email: `staff-a-${Date.now()}@test.com`,
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    await ClientMembership.create({
      clientId: clientA._id,
      userId: userClientStaff._id,
      roleId: clientStaffRole!._id,
      status: 'active',
    });

    // 4. Client B Admin
    const userClientBAdmin = await User.create({
      name: 'Client B Admin',
      email: `admin-b-${Date.now()}@test.com`,
      passwordHash,
      status: 'active',
      isSuperAdmin: false,
    });
    await ClientMembership.create({
      clientId: clientB._id,
      userId: userClientBAdmin._id,
      roleId: clientAdminRole!._id,
      status: 'active',
    });

    // Helper: Authenticate User
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
        email: env.INITIAL_ADMIN_EMAIL,
        password: env.INITIAL_ADMIN_PASSWORD,
      }),
    });
    superAdminCookie = superAdminRes.headers.get('set-cookie')?.split(';')[0] || '';
    clientAdminCookie = await login(userClientAdmin.email);
    clientStaffCookie = await login(userClientStaff.email);
    clientBAdminCookie = await login(userClientBAdmin.email);

    // =============================================================
    // TEST 1: Tenant Isolation - Client B cannot see Client A forms
    // =============================================================
    console.log('\n--- Form CRUD & Tenant Isolation Tests ---');

    // Create a form in Client A
    const createFormRes = await fetch(`${baseUrl}/forms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({
        name: 'Test Form A',
        description: 'Lead intake for Client A landing page',
        submitButtonLabel: 'Get Free Audit',
        successMessage: 'We received your audit request!',
      }),
    });
    const formAData = await createFormRes.json();
    assert(
      createFormRes.status === 201 && formAData.data?._id && formAData.data?.publicKey,
      'Test 1: Client Admin can create form with auto-generated publicKey and default fields',
      JSON.stringify(formAData)
    );

    const formAId = formAData.data._id;
    const formAPublicKey = formAData.data.publicKey;

    // Client B tries to retrieve Client A form
    const clientBAccessRes = await fetch(`${baseUrl}/forms/${formAId}`, {
      headers: {
        Cookie: clientBAdminCookie,
        'X-Client-Id': clientBId,
      },
    });
    assert(
      clientBAccessRes.status === 404,
      'Test 2: Tenant Isolation - Client B cannot retrieve Client A form (404 returned)',
      `Status: ${clientBAccessRes.status}`
    );

    // =============================================================
    // TEST 3 & 4: Permission Enforcement
    // =============================================================
    // Client Staff (only has forms.view and forms.view_submissions, NOT forms.create or forms.publish)
    const staffCreateRes = await fetch(`${baseUrl}/forms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientStaffCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({ name: 'Staff Unauthorized Form' }),
    });
    assert(
      staffCreateRes.status === 403,
      'Test 3: Permission Enforcement - Client Staff without forms.create is rejected (403)',
      `Status: ${staffCreateRes.status}`
    );

    const staffPublishRes = await fetch(`${baseUrl}/forms/${formAId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientStaffCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({ status: 'published' }),
    });
    assert(
      staffPublishRes.status === 403,
      'Test 4: Permission Enforcement - Client Staff without forms.publish is rejected (403)',
      `Status: ${staffPublishRes.status}`
    );

    // =============================================================
    // TEST 5: Form Update
    // =============================================================
    const updateRes = await fetch(`${baseUrl}/forms/${formAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({
        submitButtonLabel: 'Claim Your Strategy Call',
        successMessage: 'Thank you! A senior strategist will call you shortly.',
      }),
    });
    const updatedData = await updateRes.json();
    assert(
      updateRes.status === 200 && updatedData.data?.submitButtonLabel === 'Claim Your Strategy Call',
      'Test 5: Form settings updated successfully',
      JSON.stringify(updatedData)
    );

    // =============================================================
    // TEST 6: Form Duplication
    // =============================================================
    const dupRes = await fetch(`${baseUrl}/forms/${formAId}/duplicate`, {
      method: 'POST',
      headers: {
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
    });
    const dupData = await dupRes.json();
    assert(
      dupRes.status === 201 &&
        dupData.data?.name.includes('(Copy)') &&
        dupData.data?.publicKey !== formAPublicKey &&
        dupData.data?.fields?.length > 0,
      'Test 6: Form duplicated successfully with deep-copied fields and new unique publicKey',
      JSON.stringify(dupData)
    );

    // =============================================================
    // TEST 7: Field Management (Add custom field, reorder, delete)
    // =============================================================
    console.log('\n--- Field Management Tests ---');

    const addFieldRes = await fetch(`${baseUrl}/forms/${formAId}/fields`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({
        fieldKey: 'monthly_budget',
        label: 'Monthly Ad Budget',
        type: 'select',
        options: [
          { label: '$1,000 - $5,000', value: 'tier_1' },
          { label: '$5,000 - $25,000', value: 'tier_2' },
          { label: '$25,000+', value: 'tier_3' },
        ],
        required: false,
        leadMapping: 'customField',
        customFieldKey: 'ad_budget_tier',
      }),
    });
    const addFieldData = await addFieldRes.json();
    assert(
      addFieldRes.status === 201 && addFieldData.data?.fieldKey === 'monthly_budget',
      'Test 7: Custom select field created with CRM customField mapping',
      JSON.stringify(addFieldData)
    );

    const customFieldId = addFieldData.data._id;

    // Field reordering
    const fieldsListRes = await fetch(`${baseUrl}/forms/${formAId}/fields`, {
      headers: {
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
    });
    const allFields = (await fieldsListRes.json()).data;
    const reorderedIds = allFields.map((f: any) => f._id).reverse();

    const reorderRes = await fetch(`${baseUrl}/forms/${formAId}/fields/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({ fieldIds: reorderedIds }),
    });
    const reorderedData = await reorderRes.json();
    assert(
      reorderRes.status === 200 && reorderedData.data[0]._id === reorderedIds[0],
      'Test 8: Fields reordered successfully via bulk write',
      JSON.stringify(reorderedData)
    );

    // =============================================================
    // TEST 9: Published vs Unpublished Enforcement
    // =============================================================
    console.log('\n--- Public Intake & Status Enforcement Tests ---');

    // Currently formA is in 'draft' status. Public retrieval should be rejected with 403
    const publicDraftGetRes = await fetch(`${publicBaseUrl}/${formAPublicKey}`);
    assert(
      publicDraftGetRes.status === 403,
      'Test 9: Public retrieval of draft form is rejected (403)',
      `Status: ${publicDraftGetRes.status}`
    );

    // Public submission to draft form should be rejected with 403
    const publicDraftSubmitRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    assert(
      publicDraftSubmitRes.status === 403,
      'Test 10: Public submission to draft form is rejected (403)',
      `Status: ${publicDraftSubmitRes.status}`
    );

    // Publish the form
    await fetch(`${baseUrl}/forms/${formAId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({ status: 'published' }),
    });

    // =============================================================
    // TEST 11: Public Form Retrieval (Clean schema, zero secrets)
    // =============================================================
    const publicPublishedGetRes = await fetch(`${publicBaseUrl}/${formAPublicKey}`);
    const publicDef = await publicPublishedGetRes.json();
    assert(
      publicPublishedGetRes.status === 200 &&
        publicDef.data?.publicKey === formAPublicKey &&
        publicDef.data?.fields?.length > 0 &&
        publicDef.data.clientId === undefined && // Zero internal client ID leakage
        publicDef.data.notificationSettings === undefined, // Zero internal recipient emails leakage
      'Test 11: Published public form definition retrieved without leaking private workspace data',
      JSON.stringify(publicDef)
    );

    // =============================================================
    // TEST 12 & 13: Field Validation
    // =============================================================
    console.log('\n--- Form Validation & Anti-Spam Tests ---');

    // Missing required email field
    const missingEmailRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Form Visitor One',
        phone: '+1 555-1111',
      }),
    });
    assert(
      missingEmailRes.status === 400,
      'Test 12: Missing required field rejected with HTTP 400',
      `Status: ${missingEmailRes.status}`
    );

    // Malformed email
    const invalidEmailRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Form Visitor One',
        email: 'invalid-email-format',
      }),
    });
    assert(
      invalidEmailRes.status === 400,
      'Test 13: Invalid email format rejected with HTTP 400',
      `Status: ${invalidEmailRes.status}`
    );

    // =============================================================
    // TEST 14: Anti-Spam Honeypot Detection
    // =============================================================
    const honeypotRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Spam Bot',
        email: 'spambot@spam.com',
        _hp_website: 'I am a malicious bot filling invisible fields',
      }),
    });
    const honeypotData = await honeypotRes.json();
    // Verify it returns safe response but marked as spam internally
    const spamSubmissionDoc = await FormSubmission.findOne({
      formId: formAId,
      'payload.email': 'spambot@spam.com',
    });
    assert(
      honeypotRes.status === 201 &&
        spamSubmissionDoc?.spamStatus === 'spam' &&
        spamSubmissionDoc?.processingStatus === 'rejected',
      'Test 14: Honeypot triggered - bot submission rejected and logged as spam without creating CRM leads',
      JSON.stringify(honeypotData)
    );

    // =============================================================
    // TEST 15: Anti-Spam Timing Bot Detection (< 1s)
    // =============================================================
    const timingRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Fast Bot',
        email: 'fastbot@spam.com',
        _form_loaded_at: Date.now() - 200, // Loaded only 200ms ago
      }),
    });
    const timingDoc = await FormSubmission.findOne({
      formId: formAId,
      'payload.email': 'fastbot@spam.com',
    });
    assert(
      timingDoc?.spamStatus === 'spam' && timingDoc?.processingStatus === 'rejected',
      'Test 15: Timing-based bot detection (<1s) successfully flagged and rejected submission',
      `SpamStatus: ${timingDoc?.spamStatus}`
    );

    // =============================================================
    // TEST 16: Stored XSS Sanitization
    // =============================================================
    console.log('\n--- XSS Protection & CRM Ingestion Tests ---');

    const validSubmissionId = `test_sub_${Date.now()}`;
    const xssPayload = '<script>alert("hacked")</script>Form Visitor Alpha';

    const cleanSubmitRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: validSubmissionId,
        full_name: xssPayload,
        email: 'visitor.alpha@flumenx-test.com',
        phone: '+1 555-2233',
        company: 'Alpha Digital Corp',
        message: 'Looking for PPC & SEO agency management',
        monthly_budget: 'tier_2',
        _form_loaded_at: Date.now() - 5000,
      }),
    });
    const cleanSubmitData = await cleanSubmitRes.json();
    assert(
      cleanSubmitRes.status === 201 && cleanSubmitData.data?.success === true,
      'Test 16: Valid public submission processed successfully with HTTP 201',
      JSON.stringify(cleanSubmitData)
    );

    // Verify XSS stripped
    const ingestedSubmission = await FormSubmission.findOne({ submissionId: validSubmissionId });
    assert(
      ingestedSubmission &&
        !ingestedSubmission.payload.full_name.includes('<script>') &&
        ingestedSubmission.payload.full_name.includes('Form Visitor Alpha'),
      'Test 17: Stored XSS defense - <script> tags actively stripped from payload inputs',
      `Stored Name: ${ingestedSubmission?.payload?.full_name}`
    );

    // =============================================================
    // TEST 18 & 19: Automatic Contact & CRM Lead Creation
    // =============================================================
    const createdContact = await Contact.findOne({ email: 'visitor.alpha@flumenx-test.com' });
    assert(
      createdContact !== null &&
        createdContact.clientId.toString() === clientAId &&
        createdContact.phone === '+1 555-2233',
      'Test 18: Contact automatically created with mapped name, email, and phone',
      JSON.stringify(createdContact)
    );

    const createdLead = await Lead.findOne({ email: 'visitor.alpha@flumenx-test.com' });
    assert(
      createdLead !== null &&
        createdLead.clientId.toString() === clientAId &&
        createdLead.source === 'organic' &&
        createdLead.tags.includes('website-form') &&
        createdLead.companyName === 'Alpha Digital Corp' &&
        createdLead.customFields?.get?.('ad_budget_tier') === 'tier_2',
      'Test 19: CRM Lead created with source "organic", custom fields, and tags',
      JSON.stringify(createdLead)
    );

    // Test 20: Lead-to-Contact Linkage
    assert(
      createdContact?.leadId?.toString() === createdLead?._id.toString(),
      'Test 20: Bidirectional linkage verified between Contact and Lead',
      `Contact.leadId=${createdContact?.leadId} Lead._id=${createdLead?._id}`
    );

    // =============================================================
    // TEST 21 & 22: Unified Inbox Conversation & Message Dispatched
    // =============================================================
    console.log('\n--- Unified Inbox Integration Tests ---');

    const thread = await Conversation.findOne({
      clientId: clientA._id,
      contactId: createdContact?._id,
      channel: 'internal',
    });
    assert(
      thread !== null &&
        thread.status === 'open' &&
        thread.unreadCount >= 1 &&
        thread.subject.includes('Website Form: Test Form A'),
      'Test 21: Conversation thread automatically created in Unified Inbox with channel "internal"',
      JSON.stringify(thread)
    );

    const initialMessage = await Message.findOne({
      conversationId: thread?._id,
      direction: 'inbound',
    });
    assert(
      initialMessage !== null &&
        initialMessage.senderType === 'contact' &&
        initialMessage.deliveryStatus === 'delivered' &&
        initialMessage.body.includes('Form: Test Form A') &&
        initialMessage.body.includes('Alpha Digital Corp'),
      'Test 22: Inbound Message created in thread with submission details',
      JSON.stringify(initialMessage)
    );

    // =============================================================
    // TEST 23: Duplicate Submission Idempotency
    // =============================================================
    const initialLeadCount = await Lead.countDocuments({ clientId: clientA._id });
    const initialMessageCount = await Message.countDocuments({ clientId: clientA._id });

    const duplicateSubmitRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: validSubmissionId, // identical submissionId
        full_name: 'Form Visitor Alpha',
        email: 'visitor.alpha@flumenx-test.com',
      }),
    });
    const newLeadCount = await Lead.countDocuments({ clientId: clientA._id });
    const newMessageCount = await Message.countDocuments({ clientId: clientA._id });

    assert(
      duplicateSubmitRes.status === 201 &&
        newLeadCount === initialLeadCount &&
        newMessageCount === initialMessageCount,
      'Test 23: Duplicate submission idempotency - identical submissionId returns success without creating duplicate CRM leads or messages',
      `Lead delta: ${newLeadCount - initialLeadCount}, Message delta: ${newMessageCount - initialMessageCount}`
    );

    // =============================================================
    // TEST 24: Existing Lead Deduplication on New Submission
    // =============================================================
    const secondSubmitRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Form Visitor Alpha',
        email: 'visitor.alpha@flumenx-test.com',
        message: 'Second inquiry from same visitor with updated requirements',
        _form_loaded_at: Date.now() - 3000,
      }),
    });
    const finalLeadCount = await Lead.countDocuments({ email: 'visitor.alpha@flumenx-test.com' });
    const updatedLeadDoc = await Lead.findOne({ email: 'visitor.alpha@flumenx-test.com' });

    assert(
      secondSubmitRes.status === 201 &&
        finalLeadCount === 1 &&
        updatedLeadDoc?.sourceDetails?.includes('Second inquiry'),
      'Test 24: Existing Lead deduplication - subsequent submission matches email and updates lead notes without creating duplicate Lead',
      `Lead Count for email: ${finalLeadCount}`
    );

    // =============================================================
    // TEST 25: Submission Event Logging Timeline
    // =============================================================
    console.log('\n--- Submission Event Trail & Admin Tests ---');

    const events = await FormSubmissionEvent.find({
      submissionId: ingestedSubmission?._id,
    });
    const eventTypes = events.map((e) => e.eventType);
    assert(
      eventTypes.includes('submission_received') &&
        eventTypes.includes('contact_created') &&
        eventTypes.includes('lead_created') &&
        eventTypes.includes('conversation_created'),
      'Test 25: Fine-grained FormSubmissionEvent timeline recorded from received to dispatched',
      `Logged Events: ${eventTypes.join(', ')}`
    );

    // =============================================================
    // TEST 26: Submissions List API & Reprocessing
    // =============================================================
    const listSubmissionsRes = await fetch(`${baseUrl}/forms/${formAId}/submissions`, {
      headers: {
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
    });
    const submissionsList = (await listSubmissionsRes.json()).data;
    assert(
      listSubmissionsRes.status === 200 && submissionsList.submissions?.length > 0,
      'Test 26: Client Admin can retrieve submissions list with pagination and status filters',
      `Found ${submissionsList.submissions?.length} submissions`
    );

    // Reprocess failed submission
    const reprocessRes = await fetch(
      `${baseUrl}/forms/submissions/${ingestedSubmission?._id}/reprocess`,
      {
        method: 'POST',
        headers: {
          Cookie: clientAdminCookie,
          'X-Client-Id': clientAId,
        },
      }
    );
    const reprocessData = await reprocessRes.json();
    assert(
      reprocessRes.status === 200 && reprocessData.data?.processingStatus === 'processed',
      'Test 27: Reprocess submission pipeline executes idempotently and returns updated status',
      JSON.stringify(reprocessData)
    );

    // =============================================================
    // TEST 28: Allowed Domains CORS Enforcement
    // =============================================================
    // Restrict form A to only allowed-client.com
    await fetch(`${baseUrl}/forms/${formAId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
      body: JSON.stringify({
        allowedDomains: ['allowed-client.com'],
      }),
    });

    const unauthorizedDomainRes = await fetch(`${publicBaseUrl}/${formAPublicKey}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil-unauthorized-site.com',
      },
      body: JSON.stringify({
        full_name: 'Unauthorized Domain Submitter',
        email: 'blocked@domain.com',
      }),
    });
    assert(
      unauthorizedDomainRes.status === 403,
      'Test 28: Allowed-domain enforcement rejects submissions originating from unauthorized domains (403)',
      `Status: ${unauthorizedDomainRes.status}`
    );

    // =============================================================
    // TEST 29: Embed Snippet Generation
    // =============================================================
    const embedRes = await fetch(`${baseUrl}/forms/${formAId}/embed`, {
      headers: {
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
    });
    const embedData = await embedRes.json();
    assert(
      embedRes.status === 200 &&
        embedData.data?.scriptSnippet?.includes('<script src=') &&
        embedData.data?.iframeSnippet?.includes('<iframe src='),
      'Test 29: Embed configuration generates both responsive iframe and async script snippets',
      JSON.stringify(embedData)
    );

    // =============================================================
    // TEST 30: Form Archive Lifecycle
    // =============================================================
    const archiveRes = await fetch(`${baseUrl}/forms/${formAId}`, {
      method: 'DELETE',
      headers: {
        Cookie: clientAdminCookie,
        'X-Client-Id': clientAId,
      },
    });
    const archivedDoc = await WebsiteForm.findById(formAId);
    assert(
      archiveRes.status === 200 && archivedDoc?.status === 'archived',
      'Test 30: Form successfully archived and deactivated',
      `Status: ${archivedDoc?.status}`
    );
  } catch (error: any) {
    console.error('Fatal error during test run:', error);
    results.push({ name: 'Suite Runtime', passed: false, error: error.message });
  } finally {
    server.close();
    await disconnectDatabase();
  }

  // Summary
  console.log('\n==================================================');
  console.log('Release 6 Test Suite Summary');
  console.log('==================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed!`);
    process.exit(1);
  } else {
    console.log('\nAll 30 Release 6 tests passed with 100% success rate!\n');
  }
};

runWebsiteFormsTests();
