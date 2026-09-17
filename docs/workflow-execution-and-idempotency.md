# Workflow Execution & Idempotency Reference

## Overview

A robust automation engine must be resilient to duplicate event transmissions, network retries, and concurrent processing. In `flumenxConectOS`, every execution is backed by database-level idempotency indices and atomic rate-limiting safeguards.

---

## 1. Idempotency Key Specification

To prevent duplicate runs when external webhooks retry or user actions double-click:

1. **Consistent Key Format**:
   ```
   ${clientId}:${workflowId}:${eventId}
   ```
2. **Database Indices**:
   - Compound index on `WorkflowRun`:
     ```typescript
     WorkflowRunSchema.index({ clientId: 1, idempotencyKey: 1 }, { unique: true });
     WorkflowRunSchema.index({ clientId: 1, workflowId: 1, eventId: 1 });
     ```
3. **Execution Behavior**:
   - Before evaluating or executing any actions, the engine checks for an existing `WorkflowRun` matching `{ clientId, idempotencyKey }`.
   - If an existing run is found, the engine logs an idempotency match and skips execution immediately without performing duplicate side effects.

---

## 2. Non-Blocking Dispatch with Persistent Runs

The `EventDispatcher` runs asynchronously to keep user-facing API responses fast (< 50ms):

1. **Immediate Run Persistence**:
   - Before executing asynchronous action pipelines, the dispatcher persists a `WorkflowRun` record with status `running` and normalized trigger payload.
   - If the asynchronous pipeline encounters an unhandled failure, the run status is updated to `failed` with error details captured in `error`.
   - Events are never lost or dropped silently.

2. **Run Execution Status Lifecycle**:
   - `pending`: Event registered.
   - `running`: Conditions met; actions executing sequentially.
   - `completed`: All configured actions executed successfully.
   - `failed`: An action encountered an error; pipeline halted and error recorded.
   - `skipped`: Execution stopped early (conditions not met, hourly limit exceeded, circular loop detected, or idempotency hit).

---

## 3. Action Side-Effect Deduplication

If a workflow run is retried or re-dispatched, individual action executors apply idempotency checks:

| Action Type | Side-Effect Deduplication Strategy |
|---|---|
| `create_task` | Generates `idempotencyKey: wf_${runId}_task_${actionId}` and checks `Task` collection before creation. Reuses existing task if already present. |
| `add_tag` | Utilizes MongoDB `$addToSet` operator so duplicate tags are never appended. |
| `create_notification` | Queries `Notification` collection for matching `{ workflowRunId, actionId }`. Reuses existing notification if present. |
| `send_email` | Verifies execution state and prevents multiple dispatches for the same action ID within the run. |
| `update_lead_stage` | Verifies current stage; idempotent if lead is already at target stage. |
