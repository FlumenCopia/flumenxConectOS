import crypto from 'crypto';
import mongoose from 'mongoose';
import { WebsiteForm, IWebsiteForm } from '../models/WebsiteForm';
import { WebsiteFormField, IWebsiteFormField } from '../models/WebsiteFormField';
import { FormSubmission, IFormSubmission } from '../models/FormSubmission';
import { FormSubmissionEventService } from './formSubmissionEvent.service';
import { ContactService } from './contact.service';
import { Contact } from '../models/Contact';
import { Lead } from '../models/Lead';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { ConversationActivityService } from './conversationActivity.service';
import { AdAttributionService } from './adAttribution.service';
import { TaskAutoFollowupService } from './taskAutoFollowup.service';
import { EventDispatcher } from './eventDispatcher.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

// HTML / Script Sanitizer to prevent Stored XSS
const sanitizeText = (input: any): any => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
};

export class FormSubmissionService {
  /**
   * Resolves a public form definition for rendering on public websites or embeds.
   * Strips all internal client IDs, CRM mappings, notification emails, and internal keys.
   */
  static async getPublicForm(publicKey: string, origin?: string): Promise<any> {
    const form = await WebsiteForm.findOne({ publicKey: publicKey.trim() });

    if (!form) {
      throw new AppError('Form not found', 404);
    }

    if (form.status !== 'published') {
      throw new AppError('This form is not currently accepting submissions.', 403);
    }

    // Check allowed domains if specified
    if (form.allowedDomains && form.allowedDomains.length > 0 && origin) {
      const originHost = origin.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
      const isAllowed = form.allowedDomains.some((d) => {
        const cleanD = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
        return originHost === cleanD || originHost.endsWith(`.${cleanD}`);
      });
      if (!isAllowed) {
        throw new AppError('Submissions from this domain are not authorized.', 403);
      }
    }

    const fields = await WebsiteFormField.find({
      formId: form._id,
      clientId: form.clientId,
    })
      .sort({ order: 1, createdAt: 1 })
      .select('fieldKey label type placeholder helpText required options defaultValue order');

    return {
      publicKey: form.publicKey,
      name: form.name,
      description: form.description,
      submitButtonLabel: form.submitButtonLabel,
      successMessage: form.successMessage,
      redirectUrl: form.redirectUrl,
      honeypotField: form.honeypotField,
      captchaEnabled: form.captchaSettings?.enabled || false,
      captchaProvider: form.captchaSettings?.provider || 'mock',
      captchaSiteKey: form.captchaSettings?.siteKey,
      fields,
    };
  }

  /**
   * Processes a public form submission through anti-spam, validation, CRM mapping, and inbox delivery.
   */
  static async submitPublicForm(
    publicKey: string,
    rawPayload: Record<string, any>,
    meta: {
      ip?: string;
      userAgent?: string;
      sourceUrl?: string;
      referrer?: string;
      origin?: string;
    }
  ): Promise<{ success: boolean; message: string; redirectUrl?: string; submissionId: string }> {
    // 1. Verify Public Form
    const form = await WebsiteForm.findOne({ publicKey: publicKey.trim() });
    if (!form) {
      throw new AppError('Form not found', 404);
    }

    if (form.status !== 'published') {
      throw new AppError('This form is not currently active or accepting responses.', 403);
    }

    // 2. Allowed-Domain Enforcement
    const requestOrigin = meta.origin || meta.referrer || '';
    if (form.allowedDomains && form.allowedDomains.length > 0 && requestOrigin) {
      const originHost = requestOrigin.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
      const isAllowed = form.allowedDomains.some((d) => {
        const cleanD = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
        return originHost === cleanD || originHost.endsWith(`.${cleanD}`);
      });
      if (!isAllowed) {
        throw new AppError('Domain not permitted to submit to this form.', 403);
      }
    }

    // 3. Extract metadata fields & generate submission ID
    const submissionId = rawPayload.submissionId?.trim() || `sub_${crypto.randomBytes(12).toString('hex')}`;
    const formLoadedAt = rawPayload._form_loaded_at ? Number(rawPayload._form_loaded_at) : null;
    const honeypotKey = form.honeypotField || '_hp_website';
    const honeypotVal = rawPayload[honeypotKey] || rawPayload._hp_website || rawPayload._gotcha;
    const captchaToken = rawPayload._captcha_token;

    // Remove technical control fields from user input payload
    const userInputs: Record<string, any> = { ...rawPayload };
    delete userInputs._form_loaded_at;
    delete userInputs._hp_website;
    delete userInputs._gotcha;
    delete userInputs[honeypotKey];
    delete userInputs._captcha_token;
    delete userInputs.submissionId;
    delete userInputs.sourceUrl;
    delete userInputs.referrer;

    // Check for nested payload if sent via { payload: { ... } }
    let fieldsInput = userInputs;
    if (userInputs.payload && typeof userInputs.payload === 'object') {
      fieldsInput = { ...userInputs.payload, ...userInputs };
      delete fieldsInput.payload;
    }

    // 4. Sanitize all text values (Stored XSS Defense)
    const sanitizedPayload: Record<string, any> = {};
    for (const [k, v] of Object.entries(fieldsInput)) {
      sanitizedPayload[k] = sanitizeText(v);
    }

    // 5. Check Idempotency / Duplicate Submission
    const existingSubmission = await FormSubmission.findOne({
      formId: form._id,
      clientId: form.clientId,
      submissionId,
    });
    if (existingSubmission) {
      logger.info(`Idempotent submission detected for submissionId=${submissionId}`);
      return {
        success: true,
        message: form.successMessage,
        redirectUrl: form.redirectUrl,
        submissionId: existingSubmission.submissionId,
      };
    }

    // 6. Anti-Spam Evaluation
    let spamStatus: 'clean' | 'spam' | 'suspicious' = 'clean';
    let failureReason: string | undefined = undefined;

    // A. Honeypot check
    if (honeypotVal && String(honeypotVal).trim().length > 0) {
      spamStatus = 'spam';
      failureReason = 'Honeypot protection triggered (bot detected)';
    }

    // B. Submission speed check (< 1000ms is inhumanly fast)
    if (formLoadedAt && !isNaN(formLoadedAt)) {
      const elapsedMs = Date.now() - formLoadedAt;
      if (elapsedMs < 1000) {
        spamStatus = 'spam';
        failureReason = 'Submission completed unnaturally fast (< 1s)';
      }
    }

    // C. CAPTCHA Check (if enabled)
    if (form.captchaSettings?.enabled) {
      if (!captchaToken || captchaToken === 'invalid_captcha') {
        spamStatus = 'spam';
        failureReason = 'CAPTCHA verification failed';
      }
    }

    // 7. Validate Form Fields against Schema
    const formFields = await WebsiteFormField.find({
      formId: form._id,
      clientId: form.clientId,
    });

    const validationErrors: string[] = [];
    const normalizedPayload: Record<string, any> = {};

    for (const field of formFields) {
      const val = sanitizedPayload[field.fieldKey];

      // Required check
      if (field.required) {
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          validationErrors.push(`Field '${field.label}' is required.`);
          continue;
        }
      }

      if (val !== undefined && val !== null && val !== '') {
        // Field type specific validations
        if (field.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(val).trim())) {
            validationErrors.push(`Field '${field.label}' must be a valid email address.`);
          } else {
            normalizedPayload[field.fieldKey] = String(val).toLowerCase().trim();
          }
        } else if (field.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) {
            validationErrors.push(`Field '${field.label}' must be a number.`);
          } else {
            normalizedPayload[field.fieldKey] = num;
          }
        } else if (field.type === 'select' || field.type === 'radio') {
          if (field.options && field.options.length > 0) {
            const validVals = field.options.map((o) => o.value);
            if (!validVals.includes(String(val))) {
              validationErrors.push(`Selected value for '${field.label}' is not a valid option.`);
            } else {
              normalizedPayload[field.fieldKey] = val;
            }
          } else {
            normalizedPayload[field.fieldKey] = val;
          }
        } else {
          normalizedPayload[field.fieldKey] = val;
        }
      }
    }

    // If validation failed, record rejected submission and return safe error
    if (validationErrors.length > 0 && spamStatus === 'clean') {
      const failedSubmission = await FormSubmission.create({
        formId: form._id,
        clientId: form.clientId,
        submissionId,
        payload: sanitizedPayload,
        normalizedPayload,
        processingStatus: 'rejected',
        spamStatus: 'clean',
        sourceUrl: meta.sourceUrl,
        referrer: meta.referrer,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        failureReason: validationErrors.join('; '),
      });

      await FormSubmissionEventService.logEvent({
        submissionId: failedSubmission._id,
        formId: form._id,
        clientId: form.clientId,
        eventType: 'validation_failed',
        description: `Submission rejected: ${validationErrors.join('; ')}`,
        metadata: { errors: validationErrors },
      });

      throw new AppError(`Validation failed: ${validationErrors.join(', ')}`, 400);
    }

    // 8. If Spam detected, record and return benign response (don't alert spammers)
    if (spamStatus === 'spam') {
      const spamSubmission = await FormSubmission.create({
        formId: form._id,
        clientId: form.clientId,
        submissionId,
        payload: sanitizedPayload,
        normalizedPayload,
        processingStatus: 'rejected',
        spamStatus: 'spam',
        sourceUrl: meta.sourceUrl,
        referrer: meta.referrer,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        failureReason: failureReason || 'Spam filters triggered',
      });

      await FormSubmissionEventService.logEvent({
        submissionId: spamSubmission._id,
        formId: form._id,
        clientId: form.clientId,
        eventType: 'spam_rejected',
        description: `Submission flagged as spam: ${failureReason}`,
        metadata: { failureReason },
      });

      return {
        success: true,
        message: form.successMessage,
        redirectUrl: form.redirectUrl,
        submissionId,
      };
    }

    // 9. Create Valid Submission in 'processing' state
    const submission = await FormSubmission.create({
      formId: form._id,
      clientId: form.clientId,
      submissionId,
      payload: sanitizedPayload,
      normalizedPayload,
      processingStatus: 'processing',
      spamStatus: 'clean',
      sourceUrl: meta.sourceUrl,
      referrer: meta.referrer,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    await FormSubmissionEventService.logEvent({
      submissionId: submission._id,
      formId: form._id,
      clientId: form.clientId,
      eventType: 'submission_received',
      description: `Submission received from ${meta.ip || 'web client'}`,
      metadata: { sourceUrl: meta.sourceUrl },
    });

    // 10. Execute CRM Processing Pipeline (Contact -> Lead -> Conversation -> Inbox Message)
    try {
      await this.processSubmissionPipeline(form, submission, formFields, sanitizedPayload, meta);

      // Increment form submission count
      form.submissionsCount += 1;
      await form.save();

      // Dispatch workflow trigger event: form.submitted
      try {
        await EventDispatcher.dispatch({
          clientId: form.clientId.toString(),
          eventType: 'form.submitted',
          eventId: `form_submitted_${submission._id}`,
          entityId: submission._id.toString(),
          entityType: 'form_submission',
          payload: {
            form: {
              _id: form._id.toString(),
              name: form.name,
              title: form.name,
              publicKey: form.publicKey,
            },
            submission: {
              _id: submission._id.toString(),
              submissionId: submission.submissionId,
              payload: sanitizedPayload,
            },
            payload: sanitizedPayload,
          },
        });
      } catch (eventErr) {
        // Non-fatal
      }

      return {
        success: true,
        message: form.successMessage,
        redirectUrl: form.redirectUrl,
        submissionId: submission.submissionId,
      };
    } catch (processError: any) {
      logger.error('Error executing submission CRM pipeline:', processError);

      submission.processingStatus = 'failed';
      submission.failureReason = processError.message || 'Pipeline processing error';
      await submission.save();

      await FormSubmissionEventService.logEvent({
        submissionId: submission._id,
        formId: form._id,
        clientId: form.clientId,
        eventType: 'processing_failed',
        description: `Pipeline execution failed: ${processError.message}`,
        metadata: { error: processError.message },
      });

      return {
        success: true,
        message: form.successMessage,
        redirectUrl: form.redirectUrl,
        submissionId: submission.submissionId,
      };
    }
  }

  /**
   * Internal CRM pipeline: creates/updates Contact, Lead, and Conversation.
   */
  private static async processSubmissionPipeline(
    form: IWebsiteForm,
    submission: IFormSubmission,
    formFields: IWebsiteFormField[],
    payload: Record<string, any>,
    meta: { sourceUrl?: string; ip?: string; userAgent?: string }
  ): Promise<void> {
    const clientIdStr = form.clientId.toString();

    // A. Extract Mapped Contact & Lead Attributes
    let contactName = '';
    let contactEmail = '';
    let contactPhone = '';

    let leadFullName = '';
    let leadFirstName = '';
    let leadLastName = '';
    let leadEmail = '';
    let leadPhone = '';
    let leadCompany = '';
    let leadJobTitle = '';
    let leadWebsite = '';
    let leadNotes = '';
    let leadEstimatedValue: number | undefined;
    const leadCustomFields: Record<string, any> = {};

    for (const field of formFields) {
      const val = payload[field.fieldKey];
      if (val === undefined || val === null || val === '') continue;

      // Contact mappings
      if (field.contactMapping === 'name') contactName = String(val).trim();
      if (field.contactMapping === 'email') contactEmail = String(val).toLowerCase().trim();
      if (field.contactMapping === 'phone') contactPhone = String(val).trim();

      // Lead mappings
      if (field.leadMapping === 'fullName') leadFullName = String(val).trim();
      if (field.leadMapping === 'firstName') leadFirstName = String(val).trim();
      if (field.leadMapping === 'lastName') leadLastName = String(val).trim();
      if (field.leadMapping === 'email') leadEmail = String(val).toLowerCase().trim();
      if (field.leadMapping === 'phone') leadPhone = String(val).trim();
      if (field.leadMapping === 'companyName') leadCompany = String(val).trim();
      if (field.leadMapping === 'jobTitle') leadJobTitle = String(val).trim();
      if (field.leadMapping === 'website') leadWebsite = String(val).trim();
      if (field.leadMapping === 'notes') leadNotes = String(val).trim();
      if (field.leadMapping === 'estimatedValue') leadEstimatedValue = Number(val) || 0;
      if (field.leadMapping === 'customField') {
        const key = field.customFieldKey || field.fieldKey;
        leadCustomFields[key] = val;
      }
    }

    // Fallbacks if not explicitly mapped
    const effectiveEmail = (leadEmail || contactEmail || payload.email || '').toLowerCase().trim();
    const effectivePhone = (leadPhone || contactPhone || payload.phone || '').trim();
    const effectiveName =
      leadFullName ||
      contactName ||
      [leadFirstName, leadLastName].filter(Boolean).join(' ') ||
      payload.name ||
      payload.full_name ||
      effectiveEmail ||
      'Website Visitor';

    // B. Find or Create Contact
    const contact = await ContactService.findOrCreateContact(clientIdStr, {
      name: effectiveName,
      email: effectiveEmail || undefined,
      phone: effectivePhone || undefined,
    });

    await FormSubmissionEventService.logEvent({
      submissionId: submission._id,
      formId: form._id,
      clientId: form.clientId,
      eventType: 'contact_created',
      description: `Contact resolved: ${contact.name} (${contact._id})`,
      metadata: { contactId: contact._id.toString() },
    });

    // C. Find or Deduplicate CRM Lead
    let lead: any = null;

    // Search by email, phone, or contact's existing lead link
    if (contact.leadId) {
      lead = await Lead.findOne({ _id: contact.leadId, clientId: form.clientId });
    }

    if (!lead && effectiveEmail) {
      lead = await Lead.findOne({ email: effectiveEmail, clientId: form.clientId, isArchived: false });
    }

    if (!lead && effectivePhone) {
      lead = await Lead.findOne({ phone: effectivePhone, clientId: form.clientId, isArchived: false });
    }

    if (lead) {
      // Deduplicate: Update existing lead with latest form note & custom fields
      if (leadNotes) {
        lead.sourceDetails = `${lead.sourceDetails || ''}\n[Form Update: ${form.name}] ${leadNotes}`.trim();
      }
      if (Object.keys(leadCustomFields).length > 0) {
        if (!lead.customFields || typeof (lead.customFields as any).set !== 'function') {
          lead.customFields = new Map();
        }
        for (const [k, v] of Object.entries(leadCustomFields)) {
          (lead.customFields as any).set(k, v);
        }
      }
      if (leadCompany && !lead.companyName) lead.companyName = leadCompany;
      await lead.save();

      await FormSubmissionEventService.logEvent({
        submissionId: submission._id,
        formId: form._id,
        clientId: form.clientId,
        eventType: 'lead_updated',
        description: `Existing Lead matched and updated: ${lead.fullName} (${lead._id})`,
        metadata: { leadId: lead._id.toString() },
      });
    } else {
      // Create new Lead
      lead = await Lead.create({
        clientId: form.clientId,
        fullName: effectiveName,
        firstName: leadFirstName || undefined,
        lastName: leadLastName || undefined,
        email: effectiveEmail || undefined,
        phone: effectivePhone || undefined,
        companyName: leadCompany || undefined,
        jobTitle: leadJobTitle || undefined,
        website: leadWebsite || undefined,
        source: 'organic',
        sourceDetails: `Captured from Website Form: ${form.name}`,
        landingPageUrl: meta.sourceUrl || undefined,
        stage: 'new',
        leadScore: 50,
        estimatedValue: leadEstimatedValue || 0,
        currency: 'USD',
        tags: ['website-form', form.name],
        customFields: leadCustomFields,
      });

      await FormSubmissionEventService.logEvent({
        submissionId: submission._id,
        formId: form._id,
        clientId: form.clientId,
        eventType: 'lead_created',
        description: `New CRM Lead created: ${lead.fullName} (${lead._id})`,
        metadata: { leadId: lead._id.toString() },
      });
    }

    // Link Contact and Lead bidirectionally
    if (!contact.leadId || contact.leadId.toString() !== lead._id.toString()) {
      contact.leadId = lead._id;
      await contact.save();
    }

    // Link Submission to Lead & Contact
    submission.leadId = lead._id;
    submission.contactId = contact._id;
    await submission.save();

    // Record multi-touch Lead Attribution (UTMs, click IDs, referrer)
    try {
      await AdAttributionService.recordAttributionFromSubmission(submission, lead, contact);
    } catch (attrErr) {
      logger.warn(`Failed to record attribution for form submission ${submission._id}:`, attrErr);
    }

    // D. Automatic Conversation Thread Creation in Unified Inbox
    let conversation = await Conversation.findOne({
      clientId: form.clientId,
      contactId: contact._id,
      channel: 'internal',
      isArchived: false,
    });

    const threadSubject = `Website Form: ${form.name} - ${contact.name}`;

    // Format human-readable submission summary message body
    const lines: string[] = [`Form: ${form.name}`];
    for (const field of formFields) {
      const val = payload[field.fieldKey];
      if (val !== undefined && val !== null && val !== '') {
        lines.push(`${field.label}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
      }
    }
    if (meta.sourceUrl) {
      lines.push(`Source URL: ${meta.sourceUrl}`);
    }
    const messageBody = lines.join('\n');

    if (!conversation) {
      conversation = await Conversation.create({
        clientId: form.clientId,
        contactId: contact._id,
        leadId: lead._id,
        subject: threadSubject,
        channel: 'internal',
        status: 'open',
        priority: 'medium',
        lastMessageAt: new Date(),
        lastMessageSnippet: messageBody.slice(0, 120),
        unreadCount: 1,
        tags: ['website-form', form.name],
      });

      await ConversationActivityService.log({
        clientId: clientIdStr,
        conversationId: conversation._id.toString(),
        action: 'conversation_created',
        title: `Form intake thread created for ${contact.name}`,
        details: { formName: form.name },
      });
    } else {
      conversation.unreadCount += 1;
      conversation.lastMessageAt = new Date();
      conversation.lastMessageSnippet = messageBody.slice(0, 120);
      if (conversation.status === 'resolved' || conversation.status === 'archived') {
        conversation.status = 'open';
        conversation.isArchived = false;
      }
      if (!conversation.leadId) {
        conversation.leadId = lead._id;
      }
      await conversation.save();
    }

    // E. Add initial Inbound Message to Thread
    const message = await Message.create({
      clientId: form.clientId,
      conversationId: conversation._id,
      senderType: 'contact',
      senderId: contact._id,
      senderName: contact.name,
      senderEmail: contact.email,
      senderPhone: contact.phone,
      channel: 'internal',
      direction: 'inbound',
      body: messageBody,
      deliveryStatus: 'delivered',
      sentAt: new Date(),
      deliveredAt: new Date(),
    });

    await FormSubmissionEventService.logEvent({
      submissionId: submission._id,
      formId: form._id,
      clientId: form.clientId,
      eventType: 'conversation_created',
      description: `Unified Inbox conversation and inbound message dispatched (${conversation._id})`,
      metadata: {
        conversationId: conversation._id.toString(),
        messageId: message._id.toString(),
      },
    });

    // E. Automatic Follow-up Task Generation
    try {
      await TaskAutoFollowupService.generateLeadFollowUpTask({
        clientId: form.clientId,
        leadId: lead._id,
        contactId: contact._id,
        conversationId: conversation?._id,
        formSubmissionId: submission._id,
        source: 'website_form',
        leadName: lead.fullName,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        leadScore: lead.leadScore,
        notes: `Website Form: ${form.name}`,
      });
    } catch (taskErr) {
      logger.warn(`Failed to auto-generate follow-up task for submission ${submission._id}:`, taskErr);
    }

    // F. Finalize Submission Document
    submission.processingStatus = 'processed';
    submission.leadId = lead._id;
    submission.contactId = contact._id;
    submission.conversationId = conversation._id;
    submission.processedAt = new Date();
    await submission.save();
  }

  /**
   * Lists submissions for a form or entire workspace with filters and pagination.
   */
  static async listSubmissions(
    clientId: string,
    formId?: string,
    filters: {
      status?: string;
      spamStatus?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    submissions: any[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { clientId: clientObjectId };
    if (formId) {
      query.formId = new mongoose.Types.ObjectId(formId);
    }
    if (filters.status && filters.status !== 'all') {
      query.processingStatus = filters.status;
    }
    if (filters.spamStatus && filters.spamStatus !== 'all') {
      query.spamStatus = filters.spamStatus;
    }

    const [submissions, total] = await Promise.all([
      FormSubmission.find(query)
        .populate('formId', 'name publicKey')
        .populate('leadId', 'fullName stage leadScore source')
        .populate('contactId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      FormSubmission.countDocuments(query),
    ]);

    return {
      submissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single submission detail with its full event timeline.
   */
  static async getSubmissionById(clientId: string, submissionId: string): Promise<any> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    const submission = await FormSubmission.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(submissionId) ? new mongoose.Types.ObjectId(submissionId) : undefined },
        { submissionId },
      ].filter(Boolean),
      clientId: clientObjectId,
    })
      .populate('formId')
      .populate('leadId')
      .populate('contactId')
      .populate('conversationId');

    if (!submission) {
      throw new AppError('Submission not found', 404);
    }

    const events = await FormSubmissionEventService.getEventsBySubmission(
      clientId,
      submission._id.toString()
    );

    return {
      ...submission.toJSON(),
      events,
    };
  }

  /**
   * Reprocesses a failed or rejected submission.
   */
  static async reprocessSubmission(
    clientId: string,
    submissionId: string,
    userId: string
  ): Promise<any> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    const submission = await FormSubmission.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(submissionId) ? new mongoose.Types.ObjectId(submissionId) : undefined },
        { submissionId },
      ].filter(Boolean),
      clientId: clientObjectId,
    });

    if (!submission) {
      throw new AppError('Submission not found', 404);
    }

    const form = await WebsiteForm.findById(submission.formId);
    if (!form) {
      throw new AppError('Associated form no longer exists', 404);
    }

    const formFields = await WebsiteFormField.find({
      formId: form._id,
      clientId: clientObjectId,
    });

    submission.processingStatus = 'processing';
    submission.failureReason = undefined;
    submission.spamStatus = 'clean';
    await submission.save();

    await this.processSubmissionPipeline(
      form,
      submission,
      formFields,
      submission.payload,
      { sourceUrl: submission.sourceUrl }
    );

    return this.getSubmissionById(clientId, submission._id.toString());
  }
}
