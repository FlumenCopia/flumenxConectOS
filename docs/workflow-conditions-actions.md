# Workflow Conditions & Actions Reference

## Overview

Each workflow in `flumenxConectOS` consists of:
1. **Trigger**: An event pattern that wakes the workflow.
2. **Conditions**: A sequential list of boolean rules evaluated against the normalized event context.
3. **Actions**: An ordered pipeline of up to 10 automated tasks executed when conditions evaluate to `true`.

---

## Condition Evaluator Engine

The `ConditionEvaluator` uses a secure, AST-free field resolution mechanism with allowlisted root properties:

- Allowed root paths: `lead`, `task`, `conversation`, `form`, `metadata`, `actor`, `event`, `submission`, `fieldValues`.
- Logical operators: `and` (default), `or`.
- Safe resolution: Accessing undefined nested properties returns `undefined` without throwing exceptions.

### Supported Operators

| Operator | Comparison Logic | Example Payload Value | Condition Value | Match Result |
|---|---|---|---|:---:|
| `equals` | Strict equality (`===` with string/number normalization) | `status: "open"` | `"open"` | True |
| `not_equals` | Inverted strict equality | `priority: "high"` | `"low"` | True |
| `contains` | Substring inclusion or array member presence | `tags: ["vip", "hot"]` | `"vip"` | True |
| `starts_with` | Prefix matching on string values | `phone: "+15550199"` | `"+1"` | True |
| `greater_than` | Numerical comparison (`>`) | `leadScore: 85` | `50` | True |
| `less_than` | Numerical comparison (`<`) | `durationMinutes: 15` | `30` | True |
| `in_list` | Array membership or comma-delimited string matching | `stage: "proposal"` | `["proposal", "negotiation"]` | True |
| `exists` | Field presence check (`true` = defined and non-null) | `email: "client@acme.com"` | `true` | True |

---

## Supported Action Types

### 1. `create_task`
Creates a follow-up task linked to the triggering lead, contact, or conversation.

- **Payload Properties**:
  - `title` (string, required, supports `{{template.variables}}`)
  - `description` (string, optional, supports `{{template.variables}}`)
  - `taskType` (`call` | `email` | `meeting` | `follow_up` | `review` | `other`)
  - `priority` (`low` | `normal` | `high` | `urgent`)
  - `assignedTo` (string, valid Workspace User ObjectId)
  - `dueInHours` / `dueInDays` (number, default: 24h)
- **Side-Effect Idempotency**:
  - Checks if a task with `idempotencyKey: wf_${runId}_task_${actionId}` already exists before insertion. Reuses existing task upon retries.

### 2. `assign_task`
Reassigns an existing task to an active workspace team member.

- **Payload Properties**:
  - `taskId` (string, optional if present in event context)
  - `assignedTo` (string, required User ObjectId)
  - `reason` (string, optional audit note)

### 3. `update_lead_stage`
Transitions a lead's CRM pipeline stage.

- **Payload Properties**:
  - `leadId` (string, optional if present in event context)
  - `stage` (`lead` | `qualified` | `meeting_scheduled` | `proposal_sent` | `closed_won` | `closed_lost`)
  - `notes` (string, optional activity log message)

### 4. `add_crm_note`
Appends a timestamped internal note to the lead activity timeline.

- **Payload Properties**:
  - `leadId` (string, optional if present in event context)
  - `note` (string, required, supports `{{template.variables}}`)

### 5. `add_tag`
Adds tags to a lead record.

- **Payload Properties**:
  - `leadId` (string, optional if present in event context)
  - `tags` (array of strings or single string)
- **Idempotency**:
  - Uses MongoDB `$addToSet` to ensure tags are never duplicated.

### 6. `create_notification`
Emits an in-app notification to one or all workspace members.

- **Payload Properties**:
  - `title` (string, required)
  - `message` (string, required, supports `{{template.variables}}`)
  - `severity` (`info` | `warning` | `urgent` | `critical`)
  - `recipientUserId` (string, optional. If omitted, targets workflow creator or all workspace admins)
- **Side-Effect Idempotency**:
  - Uses `deduplicationKey: notif_run_${runId}_act_${actionId}` to guarantee exactly one notification per run.

### 7. `send_email`
Dispatches an outbound notification email via configured carrier integrations.

- **Payload Properties**:
  - `to` (string, required email address, supports `{{lead.email}}`)
  - `subject` (string, required, max 200 chars, supports `{{template.variables}}`)
  - `body` (string, required, max 10,000 chars, supports `{{template.variables}}`)
- **Safeguards**:
  - Recipient domain must be verified: either the active workspace lead/contact or a registered workspace team member. External arbitrary recipients are rejected.
  - Zero raw carrier credentials in action payloads; uses backend communication manager.

### 8. `schedule_follow_up`
Schedules an automated review or check-in task at a future date.

- **Payload Properties**:
  - `title` (string, required)
  - `delayHours` / `delayDays` (number)
  - `priority` (`low` | `normal` | `high` | `urgent`)

### 9. `pause_workflow`
Self-pauses the workflow to prevent anomalous behavior or alert administrator review.

- **Payload Properties**:
  - `reason` (string, optional)
