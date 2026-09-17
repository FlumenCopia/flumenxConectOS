# Release 6 — Website Forms & Lead Intake Engine

## Overview

Release 6 introduces a fully native website form builder and public lead capture engine to **flumenxConectOS**. Every client workspace can now design, customize, and publish lead intake forms, configure custom field mappings directly into the CRM and Contact models, embed forms via lightweight JavaScript snippets or responsive iframes, and ingest public submissions with real-time routing into the Unified Inbox.

---

## 1. Database Architecture

### `WebsiteForm`
- `clientId`: Workspace boundary reference (`Client`).
- `name`: Human-readable title of the form.
- `description`: Optional campaign/context notes.
- `publicKey`: Cryptographically collision-resistant public identifier (`form_pub_[hex]`).
- `status`: Lifecycle state (`draft | published | paused | archived`).
- `submitButtonLabel`: Call to action label (default: `'Submit'`).
- `successMessage`: Friendly acknowledgment display on submit.
- `redirectUrl`: Optional automated destination URL.
- `allowedDomains`: Whitelisted external domains for CORS protection.
- `notificationSettings`: Email delivery options.
- `captchaSettings`: Mock / extensible CAPTCHA configuration.
- `honeypotField`: Name of the invisible anti-bot honeypot field.
- `submissionsCount`: Total count of processed submissions.

### `WebsiteFormField`
- `formId`: Parent form reference.
- `clientId`: Workspace boundary.
- `fieldKey`: JSON attribute key (e.g. `full_name`, `email`, `company`).
- `label`: Display label.
- `type`: Field input element (`text | email | phone | textarea | number | select | radio | checkbox | date | hidden`).
- `placeholder`: Hint text.
- `helpText`: Clarification note under field.
- `required`: Mandatory input enforcement.
- `options`: Dropdown / radio options (`label`, `value`).
- `order`: Visual rendering sequence.
- `leadMapping`: Direct association to CRM Lead (`fullName | firstName | lastName | email | phone | companyName | jobTitle | website | estimatedValue | notes | customField | none`).
- `contactMapping`: Association to Contact (`name | email | phone | none`).
- `customFieldKey`: Custom Lead attribute key when mapping is `customField`.

### `FormSubmission`
- `formId`, `clientId`: Foreign keys.
- `submissionId`: Unique transaction ID (`sub_[hex]`).
- `payload`: Sanitized raw submitted values.
- `normalizedPayload`: Extracted and normalized CRM field values.
- `leadId`, `contactId`, `conversationId`: Linked entities.
- `processingStatus`: State machine (`received | processing | processed | rejected | failed`).
- `spamStatus`: Abuse score (`clean | spam | suspicious`).
- `sourceUrl`, `referrer`, `ipAddress`, `userAgent`: Audit context.

### `FormSubmissionEvent`
- Fine-grained audit trail logging each transition:
  - `submission_received`
  - `validation_failed`
  - `spam_rejected`
  - `contact_created`
  - `contact_matched`
  - `lead_created`
  - `lead_updated`
  - `conversation_created`
  - `notification_sent`
  - `processing_failed`

---

## 2. Public Intake & Anti-Spam Pipeline

1. **Status Verification**: Only forms in `published` status accept submissions or expose public schemas. Draft, paused, or archived forms return HTTP 403.
2. **Allowed-Domain Enforcement**: If `allowedDomains` is configured, incoming requests from unauthorized browser origins or referrers are blocked with HTTP 403.
3. **Stored XSS Sanitization**: Text input is actively sanitized to strip `<script>` tags, inline `on*` event handlers, and `javascript:` URIs.
4. **Honeypot Bot Defense**: Forms embed an invisible field (`_hp_website`). Bots filling this field are silently flagged as `spam` and rejected from creating CRM records.
5. **Speed Bot Defense**: Submissions arriving in `<1000ms` from form render time are flagged as bot spam.
6. **Rate Limiting**: Public endpoints enforce sliding-window IP limits to prevent volumetric abuse.
7. **Duplicate Idempotency**: Repeated submissions sharing the same `submissionId` return HTTP 201 without creating duplicate Leads, Contacts, Conversations, or Messages.

---

## 3. CRM Processing & Inbox Delivery

When a valid submission is received:
1. **Contact Resolution**: Existing Contact is matched by email or phone. If none exists, a new Contact is created.
2. **Lead Deduplication**: Existing Lead is matched by email, phone, or existing Contact linkage. If matched, the Lead is updated with new inquiry notes without creating a duplicate record. If new, a Lead is created with `source: 'organic'`, `stage: 'new'`, `leadScore: 50`, and tags `['website-form', form.name]`.
3. **Unified Inbox Routing**: A conversation thread is opened on channel `'internal'` with subject `Website Form: [Form Name] - [Contact Name]`. An initial inbound message summarizes the submission details, incrementing the unread count and updating conversation snippets.
