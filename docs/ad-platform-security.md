# Ad Platform Security & Credential Encryption Architecture

## Overview

Handling third-party advertising credentials (Meta OAuth User Tokens, System User Tokens, and Google Ads Refresh Tokens) requires strict security controls to prevent credential exposure, unauthorized account tampering, or cross-tenant leakage.

---

## 1. Cryptographic Standard: AES-256-GCM

All external tokens are encrypted at rest using **Authenticated AES-256-GCM (Galois/Counter Mode)**:

- **Key Derivation**: The system key is derived from `ENCRYPTION_SECRET_KEY` configured in the backend environment, hashed with SHA-256 to guarantee a deterministic 256-bit (32-byte) key.
- **Initialization Vector (IV)**: A cryptographically random 16-byte IV is generated per encryption operation via `crypto.randomBytes(16)`.
- **Authentication Tag**: GCM generates a 16-byte authentication tag ensuring integrity and authenticating the ciphertext.
- **Serialized Format**: The token is stored as a colon-delimited string: `iv:authTag:ciphertext` in hexadecimal.

Any bit tampering in the ciphertext or IV immediately fails decryption with an authentication error, protecting against tampering and bit-flipping attacks.

---

## 2. Token Exposure Prevention

1. **Schema Defense (`select: false`)**:
   - In `backend/src/models/AdPlatformConnection.ts`, `encryptedAccessToken` and `encryptedRefreshToken` are configured with `select: false`.
   - Normal queries (e.g. `AdPlatformConnection.find()`) omit these fields automatically.
2. **Encrypted Token Masking**:
   - Plaintext access tokens are NEVER stored in the database.
   - Decryption occurs strictly inside internal sync services (`AdConnectionService.getDecryptedCredentials`) and is never routed to HTTP controller response objects.
3. **Log Sanitization**:
   - Logger utilities in `backend/src/config/logger.ts` redact any tokens, headers, or authorization values containing `Bearer`, `token`, or `secret`.

---

## 3. Read-Only Scope Enforcement

flumenxConectOS adheres to a **read-only policy** for advertising data:
- No write endpoints exist for creating or updating external campaigns, ad sets, budgets, or ad copy.
- Sync operations exclusively perform `GET` requests to external provider APIs.
- Eliminates any risk of accidental ad spend adjustments or campaign disruptions on client accounts.

---

## 4. Multi-Tenant Boundary Isolation

- Every API endpoint requires an authenticated session and checks workspace membership.
- Connection lookups include both `_id` and `clientId` to guarantee tenant isolation:
  ```typescript
  AdPlatformConnection.findOne({ _id: connectionId, clientId: clientObjectId });
  ```
- Client users from Workspace B can never query, sync, or revoke ad connections belonging to Workspace A.

---

## 5. Key Rotation & Disaster Recovery

In enterprise operations, encryption keys may need to be rotated periodically or in response to a suspected infrastructure compromise:

1. **Dual-Key Migration Protocol**:
   - In a planned rotation, the environment provides both `ENCRYPTION_SECRET_KEY` (primary) and `ENCRYPTION_SECRET_KEY_PREVIOUS` (fallback for read).
   - Migration script cycles through all active connections, decrypts using the previous key, and re-encrypts with the newly generated primary key.
2. **Deterministic IV Safeguard**:
   - Even when re-encrypting the same plaintext token, the newly generated 16-byte cryptographic IV produces completely distinct ciphertext and authentication tags, preventing pattern analysis.

---

## 6. Audit Logging & Access Traceability

Every credential mutation and sync trigger is tracked within the audit logging subsystem:
- **Connection Creation**: Logs `ads.connection_created` with actor ID, client ID, and account metadata. Token values are omitted.
- **Status Updates & Revocations**: Logs `ads.connection_revoked` or `ads.status_updated` recording who initiated the change and timestamp.
- **Sync Executions**: Logs synchronization status (`success`, `partial`, `failed`), campaign import counts, and warning messages.

---

## 7. Threat Model & Defense-In-Depth

| Threat Vector | Mitigation Strategy | Implemented Mechanism |
|---|---|---|
| **Database Dump Leakage** | Tokens are ciphertext without plaintext representation | AES-256-GCM authenticated encryption |
| **API Response Exfiltration** | Accidental serialization of token fields in JSON | Mongoose `select: false` on credential fields |
| **Cross-Tenant Hijacking** | Tenant A querying or syncing Tenant B's ad account | Mandatory `clientId` scoping and membership checks |
| **Tampered / Corrupted Ciphertext** | Modified ciphertext injected directly into MongoDB | GCM 128-bit authentication tag verification |
| **Accidental External Mutation** | Bugs causing accidental campaign pause or spend changes | Strictly read-only provider adapters |
| **Server Log Exposure** | Authorization headers printed in error stack traces | Winston logger sanitization filter |
