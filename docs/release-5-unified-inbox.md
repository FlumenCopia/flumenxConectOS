# Release 5: Communications, Conversations & Unified Inbox

## 1. Executive Summary

Release 5 delivers the omnichannel customer communications and unified messaging engine for **flumenxConectOS**. It unifies inbound and outbound messaging threads across WhatsApp, Email, SMS, and Internal team notes into a cohesive 3-pane client operations inbox.

All conversations maintain strict multi-tenant isolation, database-driven RBAC, idempotency guarantees, timing-safe webhook authentication, and direct linkages to CRM prospects created in Release 4.

---

## 2. Domain Models & Architecture

### 2.1 Communication Provider Model (`CommunicationProvider.ts`)
Represents an external or development messaging gateway:
- `clientId`: Tenant scope (`ObjectId`, Ref: `Client`, indexed).
- `providerType`: `mock` | `resend` | `twilio` | `whatsapp` | `custom_webhook`.
- `displayName`: Human-readable name.
- `status`: `active` | `inactive` | `error`.
- `configuration`: Provider-specific settings and metadata (secrets protected).
- `isDefault`: Boolean.
- `webhookSecretHash`: SHA-256 hashed webhook token.

### 2.2 Contact Model (`Contact.ts`)
External communication participant:
- `clientId`: Tenant scope (`ObjectId`, Ref: `Client`, indexed).
- `name`: Participant display name.
- `email`: Lowercased email (indexed).
- `phone`: Cleaned phone number string (indexed).
- `avatarUrl`: Optional avatar link.
- `leadId`: Optional reference to CRM `Lead` from Release 4.
- `metadata`: Arbitrary key-value map.

### 2.3 Conversation Model (`Conversation.ts`)
Messaging thread:
- `clientId`: Tenant scope (`ObjectId`, Ref: `Client`, indexed).
- `contactId`: Recipient contact (`ObjectId`, Ref: `Contact`, indexed).
- `leadId`: Linked CRM lead reference (`ObjectId`, Ref: `Lead`).
- `subject`: Thread title or inquiry topic.
- `channel`: `email` | `sms` | `whatsapp` | `internal` | `other`.
- `status`: `open` | `pending` | `resolved` | `archived`.
- `priority`: `low` | `medium` | `high` | `urgent`.
- `assignedTo`: Assigned team member (`ObjectId`, Ref: `User`).
- `lastMessageAt`: Timestamp of newest message (indexed).
- `lastMessageSnippet`: Preview text for inbox list.
- `unreadCount`: Integer count of unread inbound messages.
- `tags`: Array of string labels.
- `isArchived`: Soft-archive flag.

### 2.4 Message Model (`Message.ts`)
Individual message within a conversation:
- `clientId`: Tenant scope (`ObjectId`, Ref: `Client`).
- `conversationId`: Parent thread (`ObjectId`, Ref: `Conversation`, indexed).
- `senderType`: `user` | `contact` | `system` | `bot`.
- `senderId`: User or Contact reference.
- `senderName`: Display name of sender.
- `channel`: Channel through which message was transmitted.
- `direction`: `inbound` | `outbound`.
- `body`: Sanitized text body (free of script tags or HTML event handlers).
- `deliveryStatus`: `pending` | `sent` | `delivered` | `failed` | `read`.
- `failureReason`: Carrier/gateway error details if failed.
- `retryCount`: Count of retry attempts.
- `externalMessageId`: Provider's external message reference (indexed).
- `idempotencyKey`: Unique client token preventing duplicate dispatch (indexed).
- `attachments`: File attachments with `name`, `url`, `size`, `mimeType`.

### 2.5 Conversation Activity Model (`ConversationActivity.ts`)
Immutable audit log tracking:
- `conversation_created`
- `status_changed` (e.g. open -> resolved)
- `priority_changed` (e.g. medium -> urgent)
- `assigned`
- `tags_updated`
- `message_sent` / `message_received` / `message_failed`
- `archived` / `reopened`

---

## 3. Provider Abstraction & Safe Mock Strategy

To prevent fraudulent claims or broken builds when live third-party accounts (Twilio, Meta WhatsApp Cloud API, Resend) are unconfigured, Release 5 implements a clean Provider Abstraction:
- `ICommunicationProviderInterface`: Standardizes `sendMessage`, `verifyWebhook`, and `processWebhook`.
- `MockCommunicationProvider`: Default safe development provider simulating realistic delivery lifecycles (`pending` -> `sent` -> `delivered`), carrier timeout simulations (via `[SIMULATE_FAIL]`), and deterministic message IDs.
- `ProviderManager`: Resolves configured providers per client/channel with automatic fallback to `MockCommunicationProvider`.

---

## 4. Webhook Engine & Idempotency Safeguards

- **Endpoint:** `POST /api/v1/client/webhooks/conversations`
- **Authentication:** `X-Webhook-Secret` verified with constant-time equality (`crypto.timingSafeEqual`).
- **Replay Protection:** Rejects payloads where `X-Webhook-Timestamp` drifts by more than 300 seconds (5 minutes).
- **Idempotency Guarantee:** If `externalMessageId` is already present in the database for this client, the webhook returns HTTP 200 with `{ duplicate: true }` without duplicating the message or inflating unread counters.

---

## 5. RBAC Permissions Matrix

9 database-driven permissions seeded and enforced across roles:

| Permission | Description | Super Admin | Client Admin | Client Staff |
| :--- | :--- | :---: | :---: | :---: |
| `conversations.view` | View conversations, thread history, and messages | Yes | Yes | Yes |
| `conversations.create` | Initiate new conversation threads | Yes | Yes | Yes |
| `conversations.reply` | Send messages and retry failed deliveries | Yes | Yes | Yes |
| `conversations.assign` | Assign threads to team members | Yes | Yes | No |
| `conversations.manage_status`| Change status, priority, and tags | Yes | Yes | No |
| `conversations.manage_providers` | Configure communication gateways | Yes | Yes | No |
| `conversations.view_audit` | View conversation audit and activity trail | Yes | Yes | Yes |
| `contacts.view` | Access contacts directory | Yes | Yes | Yes |
| `contacts.manage` | Create and edit external contacts | Yes | Yes | No |
