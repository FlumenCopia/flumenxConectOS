# SLA Engine & Team Assignment Rules

This document outlines how the Service Level Agreement (SLA) Engine calculates deadlines, monitors breach status, and routes task assignments across team members.

---

## 1. SLA Engine Architecture

The SLA Engine guarantees prompt response to inbound marketing leads.

### 1.1 Policy Configuration
Each workspace maintains a default `SlaPolicy` document:
* **Urgent Target**: 15 minutes
* **High Target**: 60 minutes
* **Normal Target**: 240 minutes
* **Low Target**: 1440 minutes
* **Business Hours Only**: Optional calendar filter (default: false)
* **Escalation Email**: Dedicated alert address for breached tasks

### 1.2 Breach Evaluation & Freezing State
* **Active Tasks**: Any task in `open`, `in_progress`, or `snoozed` state where `now > slaDeadline` is marked `slaBreached: true`, recording `slaBreachedAt`.
* **Completed & Cancelled Tasks**: When a task reaches a terminal state (`completed` or `cancelled`), its SLA evaluation is **frozen**. If a task was completed before its deadline, it will *never* breach in historical reports or KPI aggregations.

### 1.3 Automatic Breach Sweeper
When listing tasks (`GET /api/v1/tasks`) or querying workspace KPIs (`GET /api/v1/tasks/kpis`), `SlaService.checkAndMarkBreaches(clientId)` scans for newly breached tasks and logs `sla_breached` events.

---

## 2. Team Assignment Rules & Routing Strategies

### 2.1 Workspace Member Validation
`TaskAssignmentService.validateActiveAssignee(clientId, userId)` enforces two mandatory conditions:
1. `User.status === 'active'` (suspended or deactivated users are rejected).
2. `ClientMembership.status === 'active'` (user must belong to the workspace).

Attempts to assign tasks to non-members or suspended accounts fail with:
`400 Bad Request: Cannot assign tasks to an inactive or suspended user`

### 2.2 Routing Strategies for Inbound Follow-ups
When tasks are auto-generated from website forms or webhooks, `TaskAssignmentService.resolveAutoAssignee` supports:

1. **`least_open_tasks` (Default)**:
   * Finds all active members in the workspace.
   * Counts active tasks (`open`, `in_progress`) assigned to each member.
   * Routes the new task to the member with the minimum workload.
2. **`round_robin`**:
   * Alternates assignments sequentially among active members based on the most recently assigned task.
3. **`explicit`**:
   * Assigns directly to a specified user (e.g. account manager or form owner). If the user is deactivated, falls back to `least_open_tasks`.
4. **`unassigned`**:
   * Leaves the task in the shared workspace unassigned queue for staff claiming.
