# Workflow Security, Tenant Isolation & Policy Boundaries

## Overview

The Workflow Engine in `flumenxConectOS` allows client administrators to automate operational workflows without exposing the system to security vulnerabilities, cross-tenant data leakage, prototype pollution, or denial-of-service loops.

This document details the multi-layered security and architectural safeguards implemented for Release 10.

---

## 1. Strict Tenant Isolation

1. **Database-Level Boundaries**:
   - Every `Workflow`, `WorkflowRun`, and `Notification` record is indexed and queried with `{ clientId: clientObjectId }`.
   - Workflows cannot reference, mutate, or trigger actions on entities belonging to other workspaces.

2. **API Controller Tenant Verification**:
   - Client identity is never blindly accepted from headers like `x-client-id`.
   - All controller endpoints invoke `resolveScopeClientId`, which verifies that the authenticated user possesses an `active` `ClientMembership` for the specified workspace. Super admins can operate globally; non-super admins receive `403 Forbidden` if attempting cross-workspace access.

3. **URL-vs-Body Tenant Integrity**:
   - Actions (such as `assign_task` or `update_lead_stage`) enforce that any target `leadId`, `taskId`, or `userId` resides in the same `clientId` workspace.

---

## 2. Condition Evaluation Sandbox

Arbitrary code execution (`eval()`, `new Function()`) is strictly prohibited. The condition evaluator runs an AST-free, allowlisted comparator:

1. **Allowlisted Root Traversal**:
   - Traversal paths are validated against allowed root identifiers: `lead`, `task`, `conversation`, `form`, `metadata`, `actor`, `event`, `submission`, `fieldValues`.
   - Attempts to access any other global or prototype properties are rejected.

2. **Prototype Pollution Defense**:
   - Paths containing `__proto__`, `constructor`, or `prototype` are detected and immediately rejected with security warnings.

3. **MongoDB Operator Injection Defense**:
   - Condition values are checked for MongoDB query operators (e.g. `{ "$where": "..." }`, `{ "$gt": "" }`, `{ "$regex": "" }`).
   - Unsafe operators are stripped or rejected to prevent injection into database filters.

---

## 3. Rate Limiting & Concurrency Safety

1. **Atomic Hourly Slot Reservation**:
   - Each workflow defines `maxExecutionsPerHour` (default: 100).
   - Rather than a vulnerable read-then-increment pattern, execution slots are claimed via an atomic `Workflow.findOneAndUpdate`:
     ```typescript
     const updatedWorkflow = await Workflow.findOneAndUpdate(
       {
         _id: workflow._id,
         clientId: workflow.clientId,
         status: 'active',
         executionHourBucket: currentBucket,
         hourlyExecutionCount: { $lt: maxLimit },
       },
       { $inc: { hourlyExecutionCount: 1 } },
       { new: true }
     );
     ```
   - If the current hour bucket has rolled over, the counter atomically resets to `1`.
   - Concurrent bursts cannot exceed `maxExecutionsPerHour`. Excess runs are safely marked `skipped` with audit reasons.

2. **Execution Depth & Loop Prevention**:
   - Recursive chains (e.g. Workflow A creates a task -> triggers Workflow B -> creates a task -> triggers Workflow A) are bounded by `depth >= 3`.
   - When `event.depth >= 3`, execution halts immediately with status `skipped` and error reason `Loop prevention triggered at depth 3`.

---

## 4. Email Dispatch Safeguards

Outbound email actions (`send_email`) enforce strict domain and recipient validation:

1. **Verified Recipients Only**:
   - The recipient email must match:
     - The target Lead or Contact email present in the event context; OR
     - A verified active team member in the workspace (`User` with active `ClientMembership`).
   - Arbitrary external email addresses are blocked with an explicit security policy violation error.

2. **Zero Provider Credential Exposure**:
   - Workflow payloads NEVER accept or store API keys, SMTP credentials, or raw carrier configurations.
   - All email dispatches delegate to the internal `MockCommunicationProvider` / Carrier Integration Manager.

3. **Message Length Ceilings**:
   - Subject line: Maximum 200 characters.
   - Email body: Maximum 10,000 characters.
