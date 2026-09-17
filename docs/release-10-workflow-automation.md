# flumenxConectOS — Release 10: Workflow Automation & Notifications

## Executive Summary

Release 10 delivers a secure, multi-tenant **Workflow Automation & In-App / Email Notification Engine** for **flumenxConectOS**. Built strictly on top of verified Releases 1–9 foundations (Express.js, MongoDB/Mongoose, Next.js 14 App Router, and JWT HTTP-only cookie authentication), Release 10 introduces fully automated, rule-based operational workflows without introducing Redis, Kafka, BullMQ, external workflow engines, or background worker processes.

All workflow evaluations, execution pipelines, and notification dispatches execute reliably in-process with transactional database records, strict tenant isolation, race-safe atomic execution limits, loop prevention, and multi-layer idempotency safeguards.

---

## Core Capabilities

1. **Normalized Event-Driven Trigger Architecture**:
   - Ingests events synchronously or asynchronously via an in-process normalized event contract.
   - Core triggers supported across CRM, Forms, Inbox, and Tasks:
     - `lead.created`, `lead.updated`, `lead.stage_changed`
     - `form.submitted`
     - `task.created`, `task.overdue`, `task.sla_breached`, `task.completed`
     - `conversation.received`, `conversation.replied`
     - `manual.trigger`
   - Single-dispatch guarantee: Service hooks do not duplicate events when operations call one another internally (e.g. lead creation via webhook vs form submission).

2. **Secure Condition Evaluation Engine**:
   - Zero-eval, AST-free rule engine supporting 8 comparison operators: `equals`, `not_equals`, `contains`, `starts_with`, `greater_than`, `less_than`, `in_list`, `exists`.
   - Allowlisted root traversal (`lead`, `task`, `conversation`, `form`, `metadata`, `actor`, `event`).
   - Strict defense against MongoDB operator injection (`$where`, `$regex`, `$gt`, etc.) and prototype pollution (`__proto__`, `constructor`).

3. **Multi-Action Execution Pipeline**:
   - Up to 10 sequential actions per workflow:
     - `create_task`: Automated task creation with dynamic SLA deadlines, assignment, and priority.
     - `assign_task`: Reassigns open tasks with audit trails.
     - `update_lead_stage`: Transitions lead pipeline stages with activity logging.
     - `add_crm_note`: Appends timestamped audit notes to lead timelines.
     - `add_tag`: Idempotently tags leads via `$addToSet`.
     - `create_notification`: Emits targeted in-app alerts with severity ratings.
     - `send_email`: Dispatches notifications through carrier integrations with strict recipient safeguards.
     - `schedule_follow_up`: Automates follow-up tasks offset by hours/days.
     - `pause_workflow`: Self-pausing guardrail against anomalous behaviors.

4. **Multi-Layer Concurrency & Idempotency Safeguards**:
   - **Consistent Idempotency Key**: Bounded compound uniqueness `{ clientId, idempotencyKey }` formatted as `${clientId}:${workflowId}:${eventId}` ensuring exact once-execution per event.
   - **Race-Safe Execution Rate Limits**: Atomic database updates (`Workflow.findOneAndUpdate` matching `{ executionHourBucket, hourlyExecutionCount: { $lt: maxLimit } }`) preventing concurrent race conditions from bypassing hourly limits.
   - **Persistent Non-Blocking Dispatch**: Every event persists an initial `WorkflowRun` state before async processing, ensuring zero lost events or silent drops.
   - **Loop Prevention**: Hard execution depth ceiling (`depth >= 3`) aborts circular triggers.
   - **Action Side-Effect Deduplication**: Repeated runs reuse existing tasks and notifications rather than generating duplicates.

5. **In-App Notification Center**:
   - Real-time unread badge counts, popover tray, and dedicated notification management.
   - Permission gated: `notifications.view` allows listing and unread count checks; `notifications.manage` required for marking notifications as read or archiving.

---

## Architectural Data Flow

```mermaid
graph TD
    Trigger["Service Event Hook (e.g. LeadService / FormSubmissionService)"] -->|Normalized Event| Dispatcher["EventDispatcher.dispatch()"]
    Dispatcher -->|Query Active Workflows { clientId, trigger.eventType }| DB[(MongoDB)]
    Dispatcher -->|Create WorkflowRun record (idempotencyKey)| RunRecord["WorkflowRun (status: pending/running)"]
    RunRecord --> Engine["WorkflowExecutionService"]
    Engine -->|Atomic Slot Check (hourlyExecutionCount)| BucketCheck["Atomic Rate Check"]
    BucketCheck -->|Depth >= 3 Check| LoopCheck["Loop Prevention"]
    LoopCheck --> Evaluator["ConditionEvaluator.evaluate()"]
    Evaluator -->|Conditions Met| Executor["ActionExecutorService"]
    Executor -->|Task Action| TaskServ["TaskService (Idempotent)"]
    Executor -->|Notification Action| NotifServ["NotificationService"]
    Executor -->|Email Action (Policy Checked)| EmailServ["Carrier Manager"]
    Executor -->|Lead Action| LeadServ["LeadService"]
    Executor -->|Record Step Results| RunRecord
```

---

## RBAC Permissions Matrix

Release 10 expands the system permission catalog from 61 to 70 standard permissions:

| Permission Code | Description | super_admin | client_admin | client_staff |
|---|---|:---:|:---:|:---:|
| `workflows.view` | View configured automation workflows | Yes | Yes | Yes |
| `workflows.create` | Create new automation workflows | Yes | Yes | No |
| `workflows.edit` | Modify workflow rules, conditions, and actions | Yes | Yes | No |
| `workflows.delete` | Delete workflows and their configuration | Yes | Yes | No |
| `workflows.enable` | Activate, pause, or archive workflows | Yes | Yes | No |
| `workflows.execute` | Trigger manual test runs and on-demand executions | Yes | Yes | No |
| `workflows.view_runs` | View execution history and action step audits | Yes | Yes | Yes |
| `notifications.view` | View in-app notifications and unread badge count | Yes | Yes | Yes |
| `notifications.manage` | Mark notifications as read or dismiss alerts | Yes | Yes | No |

---

## Related Documentation

- [Workflow Triggers Guide](./workflow-triggers.md)
- [Conditions & Actions Reference](./workflow-conditions-actions.md)
- [Workflow Security & Sandboxing](./workflow-security.md)
- [Execution Limits & Idempotency](./workflow-execution-and-idempotency.md)
- [In-App Notifications Reference](./notifications.md)
- [Release 10 Verification Walkthrough](./walkthrough-release-10.md)
