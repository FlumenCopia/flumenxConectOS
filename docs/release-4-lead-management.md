# Release 4: Lead Management and Inbound Intake Engine

## 1. Executive Overview

Release 4 transforms **flumenxConectOS** from a workspace and identity shell into a functional digital marketing operations and CRM platform for the FlumenX agency and its enterprise clients.

This release introduces:
1. **Multi-Tenant Lead Model & Indexes:** Strict tenant isolation with compound indexes (`clientId + email`, `clientId + stage`, `clientId + source`, `clientId + followUpDate`) preventing data leakage or accidental cross-client query pollution.
2. **Interactive CRM Pipeline & Stepper:** 7 lifecycle stages (`new`, `contacted`, `qualified`, `proposal`, `won`, `lost`, `unqualified`), with state transition logging and mandatory `lostReason` validation on lost deals.
3. **Automated Lead Scoring Engine:** Real-time scoring calculation (0–100) assigning priority tiers (`hot`, `warm`, `cold`) based on attribution signals, contact completeness, and funnel velocity.
4. **Follow-Up SLA Management:** Overdue and upcoming calendar tracking with SLA alerts, quick reschedule actions, and chronological timeline event logging.
5. **Secure Webhook Ingestion Engine:** Timing-safe SHA-256 webhook token verification, 5-minute replay attack windows via timestamp validation, rate limiting (120 req/min), and strict tenant encapsulation (client ID override prevention).
6. **Defense-in-Depth CSV Export:** RBAC-guarded export with formula injection sanitization (stripping/escaping `=`, `+`, `-`, `@`).

---

## 2. Database Models & Schema Design

### 2.1 Lead Model (`src/models/Lead.ts`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `clientId` | `ObjectId` (Ref: Client) | Primary tenant boundary. Required & indexed. |
| `firstName` | `String` | Contact first name (required, trimmed). |
| `lastName` | `String` | Contact last name (optional, trimmed). |
| `email` | `String` | Lowercased, indexed, validated email. |
| `phone` | `String` | Cleaned phone number string. |
| `company` | `String` | Organization / Business name. |
| `title` | `String` | Job title or role. |
| `stage` | `Enum` | `new`, `contacted`, `qualified`, `proposal`, `won`, `lost`, `unqualified`. |
| `lostReason` | `String` | Required when stage is transitioned to `lost`. |
| `score` | `Number` | 0–100 composite lead priority score. |
| `scoreTier` | `Enum` | `cold` (<40), `warm` (40–74), `hot` (75+). |
| `source` | `Enum` | `meta_ads`, `google_ads`, `elementor_form`, `custom_webhook`, `manual`, `referral`, `other`. |
| `attribution` | `Object` | UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`), `landingPage`, `referrer`, `adId`, `formId`. |
| `customFields` | `Map` | Schema-free client-specific custom form attributes. |
| `tags` | `[String]` | Categorization tags. |
| `notes` | `String` | Internal notes. |
| `assignedTo` | `ObjectId` (Ref: User) | Team member assigned to manage this prospect. |
| `followUpDate` | `Date` | Follow-up target timestamp for SLA tracking. |
| `lastContactedAt`| `Date` | Timestamp of latest outreach or call. |
| `intakeMethod` | `Enum` | `manual`, `webhook`, `import`. |
| `intakePayloadSnapshot` | `Object` | Snapshot of raw incoming webhook payload (stored without credentials). |
| `isArchived` | `Boolean` | Soft-deletion flag. Excluded from default queries. |

### 2.2 Lead Activity Model (`src/models/LeadActivity.ts`)

Records immutable audit trails and timeline events for every lead:
- `stage_changed` (with `oldStage` and `newStage` in metadata)
- `assigned` (with `assignedTo` in metadata)
- `note_added` (with manual team note in description)
- `follow_up_scheduled`
- `webhook_received`
- `lead_created`

### 2.3 Client Webhook Model (`src/models/ClientWebhook.ts`)

Per-client webhook access credentials:
- `clientId` (Tenant boundary)
- `name` (Descriptive name e.g., "Main Website Form")
- `source` (Expected intake channel)
- `secretHash` (SHA-256 hashed secret token; raw secret is never stored)
- `isActive` (Emergency kill switch)
- `totalRequests`, `successfulRequests`, `failedRequests`
- `lastTriggeredAt`

---

## 3. RBAC Permissions Matrix

Release 4 introduces 9 database-driven permissions seeded into MongoDB:

| Permission Code | Description | Super Admin | Client Admin | Client Staff |
| :--- | :--- | :---: | :---: | :---: |
| `leads.view` | View lead directory, details, and activities | Yes | Yes | Yes |
| `leads.create` | Add new leads manually or via intake | Yes | Yes | Yes |
| `leads.update` | Update lead contact info and schedule follow-ups | Yes | Yes | Yes |
| `leads.delete` | Soft-archive leads | Yes | Yes | No |
| `leads.export` | Download filtered leads as CSV | Yes | Yes | No |
| `leads.assign` | Assign leads to team members | Yes | Yes | No |
| `leads.manage_pipeline` | Advance/revert pipeline stages | Yes | Yes | Yes |
| `leads.manage_webhooks` | Generate/revoke client intake webhooks | Yes | Yes | No |
| `leads.view_activity` | Inspect lead interaction history and audit trail | Yes | Yes | Yes |

---

## 4. API Specification Summary

### Client CRM Endpoints (`/api/v1/leads`)
- `GET /leads` — Filtered & paginated lead directory (`search`, `stage`, `source`, `scoreTier`, `followUpFilter`, `page`, `limit`).
- `POST /leads` — Create lead manually.
- `GET /leads/:leadId` — Retrieve single lead details.
- `PUT /leads/:leadId` — Update contact information.
- `PATCH /leads/:leadId/stage` — Transition stage (requires `lostReason` if moving to `lost`).
- `PATCH /leads/:leadId/assign` — Assign lead to user.
- `PATCH /leads/:leadId/follow-up` — Schedule or update next follow-up.
- `DELETE /leads/:leadId` — Soft-archive lead.
- `GET /leads/:leadId/activities` — Fetch lead timeline events.
- `POST /leads/:leadId/notes` — Post an internal timeline note.
- `GET /leads/pipeline/summary` — Aggregate stage counts and score totals.
- `GET /leads/export` — Stream formula-sanitized CSV export.

### Inbound Intake & Webhook Management Endpoints
- `POST /api/v1/client/webhooks/leads` — Ingest inbound lead payload. Authenticated via `X-Webhook-Secret` and timestamp header.
- `GET /api/v1/admin/clients/:clientId/webhooks` — List client webhooks.
- `POST /api/v1/admin/clients/:clientId/webhooks` — Create webhook; returns one-time `rawSecret`.
- `PATCH /api/v1/admin/clients/:clientId/webhooks/:webhookId/status` — Toggle active state.
- `DELETE /api/v1/admin/clients/:clientId/webhooks/:webhookId` — Delete webhook.

---

## 5. Security & Isolation Safeguards

1. **Strict Multi-Tenant Isolation:**
   - Every read and write query injects `{ clientId: req.clientContext.clientId, isArchived: false }`.
   - Webhook ingest resolves the client ID strictly from the verified webhook token record.
   - Any client ID passed in webhook or request bodies is systematically stripped.
2. **Timing-Safe Secret Verification:**
   - Webhook secrets are hashed with SHA-256 and compared using `crypto.timingSafeEqual`.
3. **Replay Attack Defense:**
   - Inbound webhook requests check `X-Webhook-Timestamp`. Requests older than 300 seconds (5 minutes) or from the future are rejected with HTTP 400.
4. **CSV Formula Injection Sanitization:**
   - Any cell starting with `=, +, -, @, \t, \r` is prefixed with an apostrophe `'` to neutralize formula execution in Excel/Google Sheets.
5. **No Credential Exposure:**
   - Webhook secrets are returned exactly once upon creation.
   - Zero password hashes, JWT tokens, or secret keys are stored in activity logs or returned in JSON responses.
