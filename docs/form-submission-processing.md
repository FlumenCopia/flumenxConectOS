# Form Submission Processing & CRM Deduplication Engine

## Lifecycle Sequence

```
1. Inbound HTTP POST /api/public/forms/:publicKey/submit
2. Check Form Status (must be 'published')
3. Check Domain Whitelist (allowedDomains)
4. Sanitize Text Inputs (strip <script>, on* handlers)
5. Idempotency Check (submissionId)
6. Anti-Spam Evaluation
   ├── A. Honeypot check (_hp_website != "")
   ├── B. Bot speed check (duration < 1000ms)
   └── C. CAPTCHA verification
7. Schema Validation (required, email, options, number)
8. FormSubmission Record Created (status: 'processing')
9. CRM Entity Resolution
   ├── ContactService.findOrCreateContact(clientId, email/phone)
   ├── Lead Deduplication (email/phone/contact.leadId)
   │   ├── If Exists: Update Lead (append notes, customFields)
   │   └── If New: Create Lead (source: 'organic', stage: 'new')
   └── Link Contact <-> Lead
10. Unified Inbox Thread & Inbound Message
   ├── Find or create Conversation (channel: 'internal')
   ├── Create Inbound Message (summary of submitted fields)
   └── Update unreadCount and lastMessageSnippet
11. Finalize Submission (status: 'processed')
12. FormSubmissionEvent Logs Timeline
13. Return Safe JSON (HTTP 201)
```

---

## CRM Deduplication Strategy

To prevent duplicate customer profiles when the same visitor submits multiple forms or responds to different marketing campaigns:

1. **Contact Identification**:
   - Matches existing Contact by normalized `email` or normalized `phone` within the client's workspace.
   - If found, updates existing contact details rather than creating a second contact.

2. **Lead Matching**:
   - First checks if the identified Contact already has a linked `leadId`.
   - If not, searches for an active Lead within the workspace matching `email` or `phone`.
   - **Update on Match**: Appends timestamped form submission notes to `sourceDetails`, merges any new custom fields into `customFields`, and preserves the lead's current stage and owner.
   - **New Creation**: If no prior record exists, creates a fresh Lead with:
     - `source`: `'organic'`
     - `stage`: `'new'`
     - `leadScore`: 50
     - `tags`: `['website-form', form.name]`

3. **Unified Inbox Threading**:
   - Reuses the existing conversation thread for the Contact on channel `'internal'`, incrementing the unread message counter and appending the new form details as an inbound message.
