# flumenxConectOS — Release 11: Customer Portal & Self-Service

## Architectural Overview

Release 11 delivers a multi-tenant, secure customer portal that enables clients' customers and leads to view and update permitted profile information, monitor customer-visible tasks and conversation threads, submit service requests with attachments, and manage communication consent.

The portal reuses the core Express.js, MongoDB/Mongoose, Next.js 14 App Router, and role-based access control infrastructure of flumenxConectOS without introducing external portal platforms, separate databases, queues, or third-party workflow engines.

---

## 1. Customer Identity & Authentication

### Identity Separation
- **PortalUser**: Internal staff users (`User`) and customer portal users (`PortalUser`) have completely separate identity models, password hashes, and session lifecycles.
- **JWT Payload**: Customer portal JWTs contain `{ type: 'portal_user', portalUserId, clientId, contactId, email, tokenVersion }`.
- **HS256 Enforcement**: Algorithm is strictly pinned to `HS256` to prevent algorithm confusion attacks.
- **Cross-Role Defense**:
  - Staff JWTs (`User`) are strictly rejected on customer portal routes (`401 Unauthorized`).
  - Portal JWTs (`PortalUser`) are strictly rejected on internal staff and admin routes (`/api/v1/auth/me`, `/api/v1/workflows`, `/api/v1/reports`, `/api/v1/ads`, `/api/v1/admin/clients`, `/api/v1/admin/audit-logs`, `/api/v1/client/workspace`).

### Invitation-Based Onboarding & Atomicity
- **Single-Use Tokens**: When staff invite a customer, a 32-byte cryptographic random token is generated. Only the SHA-256 hash (`tokenHash`) is stored in MongoDB with `select: false`.
- **Race Condition Prevention**: Acceptance uses `PortalInvitation.findOneAndUpdate` with atomic status transition from `'pending'` to `'accepted'`.
- **Database Uniqueness**:
  - `PortalUser` enforces compound unique indexes: `{ clientId: 1, email: 1 }` and `{ clientId: 1, contactId: 1 }`.
  - The loser of any concurrent acceptance race receives a `400 Bad Request` or `409 Conflict`, without issuing session cookies or creating secondary database records.
- **Automatic Revocation**: Issuing a new invitation automatically revokes previous pending invitations for that contact.

### Session Management & CSRF Protection
- **Session Cookies**: Portal authentication issues a 30-minute HTTP-only cookie (`portal_token`) with `SameSite=Strict` in production (`Lax` in development) and `Secure` flags.
- **Double-Submit CSRF Protection**:
  - On login or invitation acceptance, a unique 32-byte cryptographic hex token is issued in the `portal_csrf` cookie and response body.
  - All cookie-authenticated state mutations (`POST`, `PUT`, `PATCH`, `DELETE`) require the `x-portal-csrf` header matching `req.cookies.portal_csrf`.
  - Missing header or token mismatch returns `403 Forbidden`.
  - Pure `Authorization: Bearer <token>` requests are exempt because browsers do not automatically send bearer tokens in cross-site requests.
- **Immediate Session Invalidation**:
  - `tokenVersion` is stored in each `PortalUser` document and encoded into the JWT.
  - Any password reset, password change, account suspension, or logout increments `tokenVersion`, immediately revoking all existing active sessions.

### Zero-Enumeration Password Reset
- **Hashed Reset Tokens**: `PortalUser` stores a single-use SHA-256 hash `passwordResetTokenHash` with a 1-hour expiration.
- **Identical Responses**: Requests to `POST /api/v1/portal/auth/forgot-password` return the exact same generic message (`If the provided email is registered, password reset instructions have been sent.`) regardless of whether the email exists or is valid.
- **No Token Leakage**: Raw tokens are never returned in responses.
- **Rate Limiting**: Authentication and reset endpoints are protected by `authRateLimiter` (10 requests per 15-minute window per IP).

---

## 2. Customer Requests & Idempotent Submission

### Scoped Idempotency
- **Compound Key**: `{ clientId, portalUserId, idempotencyKey }` enforces a unique MongoDB compound index.
- **Concurrent Race Safety**: If concurrent requests arrive with the same idempotency key, MongoDB atomic index uniqueness catches error `11000`, cleanly returning the existing request without duplicating internal tasks, staff notifications, or audit logs.
- **Conflict Detection**: If a request arrives with an existing idempotency key but a conflicting payload (different subject, category, or description), the engine responds with `409 Conflict`.
- **Linked Tasks**: Upon successful request creation, an internal staff task is created (`[Customer Request] REQ-XXXX: Subject`) with `isCustomerVisible: true` and `customerActionRequired: false`.

### Attachment Validation & Malware Controls Specification

#### Enforced Application-Level Checks
The application enforces strict structural and syntactic validation at the Express/Zod API layer:
- **Allowed MIME Types**: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/png`, `image/jpeg`, `image/webp`, `text/plain`, `text/csv`.
- **Allowed Extensions**: `.pdf`, `.docx`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.txt`, `.csv`.
- **Explicit Executable Denylist**: Any file with executable or script extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.php`, `.js`, `.vbs`, `.msi`, `.scr`, `.jar`, `.ps1`, etc.) is unconditionally rejected with `HTTP 422 Unprocessable Entity`.
- **Size Limits**: Maximum 10MB (10,485,760 bytes) per file; maximum 5 files per request or message payload.
- **Allowed URI Schemes**: Pure `https://` (or `http://localhost` strictly in local development). Unsafe schemes (`javascript:`, `data:`, `file:`, `vbscript:`) are rejected with `HTTP 422`.
- **Authorization on Download**: Downloads (`GET /api/v1/portal/requests/:id/attachments/:attachmentId/download`) enforce tenant isolation (`clientId`) and contact isolation (`contactId`/`portalUserId`). Cross-tenant or cross-contact access returns `404 Not Found` without disclosing file existence. Internal staff note attachments are completely excluded.

#### Critical Security Notice: MIME/Extension Validation ≠ Malware Scanning
> [!WARNING]
> Syntactic MIME type and file extension allowlisting verifies format conformity only. It is **NOT equivalent to binary malware scanning**. It does not unpack file containers, execute behavioral heuristics, analyze embedded Office macros, or detect zero-day polymorphic payloads cloaked within valid image or PDF wrappers.

#### Quarantine Policy & Production-Ready Adapter Boundary
- **Code Implementation**:
  - `CustomerRequest` attachment schema persists explicit `scanStatus` (`'pending' | 'clean' | 'malicious' | 'scan_failed'`), `quarantineKey`, `quarantineBucket`, `cleanStorageKey`, `sha256`, and `scanExpiresAt`.
  - Storage keys are strictly stripped via Mongoose schema `toJSON` and `toObject` transforms.
  - `MalwareScannerService` and `LocalQuarantineStorageAdapter` manage upload isolation, quarantine storage paths, and download URL generation.
  - Downloads are gated for both customers (`getCustomerAttachmentDownload`) and staff (`getStaffAttachmentDownload`). Pending, failed, or expired downloads return `HTTP 423 Locked`; malicious files return `HTTP 403 Forbidden`.
  - Clean downloads issue short-lived (15-minute) HMAC-signed download tokens.
- **Webhook Callback Specification**:
  - Endpoint: `POST /api/v1/portal/webhooks/malware-scan`
  - Authentication: HMAC-SHA256 signature via `x-scanner-signature` header over `${timestamp}.${JSON.stringify(payload)}`.
  - Freshness: 5-minute replay window validated via `x-scanner-timestamp` header.
  - Idempotency: Replayed callbacks return `HTTP 200 OK` with `{ status: 'idempotent_noop' }` without duplicate audit events or database mutations.
  - Tenant Safety: `CustomerRequest.findOne({ _id: requestId, clientId })` prevents any cross-tenant state manipulation.
- **Production Infrastructure Prerequisites (Mandatory Gate)**:
  - While the software adapter, schema, webhook, and gating logic are fully implemented and verified locally, cloud infrastructure provisioning (isolated S3/GCS quarantine bucket, ClamAV/GuardDuty scanner daemon, and secret management) remains pending outside the repository.
  - Full production approval is deferred until infrastructure provisioning is completed in the target cloud environment.

---

## 3. Message Visibility & Safe Defaults

### Default Visibility Boundary
- **Safe Defaults**: Any conversation message where `isCustomerVisible` is missing or undefined strictly defaults to **hidden** from the customer portal.
- **Internal Overrides**: Even if `isCustomerVisible === true`, any message with `channel === 'internal'` or `isInternal === true` is completely excluded from customer portal queries and serialized responses.
- **Customer Query Filter**:
  ```typescript
  Message.find({
    conversationId: conversation._id,
    clientId: portalUser.clientId,
    channel: { $ne: 'internal' },
    isInternal: false,
    isCustomerVisible: true,
  });
  ```
- **Internal Note Stripping on Requests**:
  `CustomerRequest.messages` filters out internal staff notes so customers never receive internal operational remarks.

---

## 4. Customer Tasks & Narrow Actions

### Customer Visible Tasks
- Customers can only view tasks where `clientId === portalUser.clientId`, `contactId === portalUser.contactId`, and `isCustomerVisible === true`.
- **Narrow Customer Action**: Customers cannot edit staff fields (`priority`, `assignedTo`, `taskType`, `dueDate`).
- Customers can only:
  1. **Complete Action Items**: `POST /api/v1/portal/tasks/:id/complete` marks a task complete only if `customerActionRequired === true`, recording `customerCompletedAt` and customer notes.
  2. **Add Comments**: `POST /api/v1/portal/tasks/:id/comments` appends a customer comment as a `TaskEvent` of type `customer_comment`.

---

## 5. Staff Management & RBAC Permissions

Internal staff manage customer portal access using granular permissions:
- **`portal.view`**: Grants permission to view portal users, activity timestamps, and customer service requests.
- **`portal.manage`**: Grants permission to invite contacts to the portal, revoke invitations, and suspend or activate portal accounts.

Attempting to invite contacts or suspend users without `portal.manage` returns `403 Forbidden`.
