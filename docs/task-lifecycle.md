# Task Lifecycle & State Transitions

This document details the lifecycle, state mutations, priority handling, and audit event logs for tasks in **flumenxConectOS**.

---

## 1. State Machine & Status Transitions

A task progresses through well-defined operational states from initial intake to final closure:

```
                  ┌──────────────────────┐
                  │        OPEN          │
                  │ (Created/Dispatched) │
                  └──────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ IN_PROGRESS │  │   SNOOZED   │  │  CANCELLED  │
     │  (Working)  │  │(Temp Paused)│  │ (Discarded) │
     └──────┬──────┘  └──────┬──────┘  └─────────────┘
            │                │
            └────────┬───────┘
                     ▼
             ┌───────────────┐
             │   COMPLETED   │
             │(Dispositioned)│
             └───────────────┘
```

### Status Descriptions
* **`open`**: Task has been created (manually or via automated lead intake). SLA clock is actively ticking down towards deadline.
* **`in_progress`**: Agent has actively started reviewing or working on the task (`POST /api/v1/tasks/:id/start`). First response timestamp is captured.
* **`snoozed`**: Staff member has temporarily postponed the task until `snoozedUntil` (`POST /api/v1/tasks/:id/snooze`). A reason is required.
* **`completed`**: Staff member successfully finished the task or recorded an outcome disposition (`POST /api/v1/tasks/:id/complete` or `POST /api/v1/tasks/:id/disposition`). `completedAt`, `completedBy`, and `completionNotes` are locked. SLA state is frozen.
* **`cancelled`**: Task was invalidated or discarded (`POST /api/v1/tasks/:id/cancel`).

---

## 2. Priority Escalation & Dynamic SLA Recalculation

Tasks support 4 standard priority levels:

| Priority | Target Response Duration | Typical Triggers |
| :--- | :--- | :--- |
| **`urgent`** | **15 minutes** | High-intent landing page forms, direct Meta/Google Ad lead submissions, score ≥ 80 |
| **`high`** | **60 minutes (1 hour)** | Inbound API webhooks, warm inquiries, score ≥ 50 |
| **`normal`** | **240 minutes (4 hours)** | Standard CRM follow-ups, scheduled check-ins, proposal preparation |
| **`low`** | **1440 minutes (24 hours)** | Long-term nurturing, cold lead reviews, administrative tasks |

### Escalation Behavior
When priority is escalated via `PATCH /api/v1/tasks/:id/priority`:
1. The SLA deadline is recomputed from the task's creation timestamp:
   `newDeadline = createdAt + targetMinutes * 60 * 1000`
2. If `newDeadline < now`, the task immediately transitions to `slaBreached: true`.
3. A `priority_changed` event is logged in `TaskEvent`.

---

## 3. Audit Timeline (`TaskEvent`)

Every task mutation generates an immutable event record ensuring compliance and team accountability:

```json
{
  "taskId": "6aa7d6a270af4fe6e5937aa2",
  "clientId": "6aa7d6a270af4fe6e5937a8b",
  "eventType": "priority_changed",
  "description": "Task updated by Sarah Connor",
  "previousValue": { "priority": "normal" },
  "newValue": { "priority": "urgent" },
  "actorId": "6aa7d6a270af4fe6e5937a8c",
  "actorName": "Sarah Connor",
  "createdAt": "2026-09-14T11:15:00.000Z"
}
```
