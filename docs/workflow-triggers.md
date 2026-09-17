# Workflow Triggers Reference

## Overview

The `flumenxConectOS` Workflow Engine is powered by a normalized, in-process event dispatching architecture. Whenever business operations mutate domain entities (Leads, Tasks, Forms, Conversations), the responsible service dispatches a normalized event to the `EventDispatcher`.

No external message queues (Kafka, RabbitMQ, SQS, Redis) are utilized; all events are dispatched in-process and persisted into MongoDB `WorkflowRun` collections with execution state tracking.

---

## Normalized Event Contract

Every trigger event adheres to the following typed contract:

```typescript
export interface NormalizedEvent {
  clientId: string;            // Workspace isolation key
  eventType: TriggerEventType; // Event type identifier
  eventId: string;              // Deterministic event UUID
  entityId?: string;           // Target entity ID (leadId, taskId, etc.)
  entityType?: string;         // 'lead' | 'task' | 'form' | 'conversation'
  occurredAt: Date;            // ISO timestamp
  payload: Record<string, any>;// Normalized context payload
  actor?: {                    // Optional initiating user
    id?: string;
    name?: string;
    email?: string;
  };
  depth?: number;              // Current execution cascade depth (default: 0)
}
```

---

## Supported Trigger Events

### 1. Lead Triggers

| Event Type | Description | Source Service | Normalized Payload Roots |
|---|---|---|---|
| `lead.created` | Emitted when a new lead enters the CRM | `LeadService.createLead` | `lead` (full lead object), `actor` |
| `lead.updated` | Emitted when lead profile or attributes change | `LeadService.updateLead` | `lead`, `changedFields`, `actor` |
| `lead.stage_changed` | Emitted when lead progresses through pipeline stages | `LeadService.updateLeadStage` | `lead`, `previousStage`, `newStage` |

> [!IMPORTANT]
> When leads are ingested via website form submissions, only `form.submitted` is dispatched to the workflow engine, and internal lead creation does NOT emit duplicate `lead.created` workflows for the same transaction.

### 2. Website Form Triggers

| Event Type | Description | Source Service | Normalized Payload Roots |
|---|---|---|---|
| `form.submitted` | Emitted upon valid public or authenticated form submission | `FormSubmissionService.submitForm` | `submission`, `form`, `fieldValues`, `lead` |

### 3. Task & Follow-up Triggers

| Event Type | Description | Source Service | Normalized Payload Roots |
|---|---|---|---|
| `task.created` | Emitted when a task is created manually or via automation | `TaskService.createTask` | `task`, `actor` |
| `task.overdue` | Emitted when a task passes its scheduled `dueAt` date | Scheduled task scanner | `task` |
| `task.sla_breached` | Emitted when an unresolved task breaches its SLA target deadline | `SlaService.checkBreaches` | `task`, `policy` |
| `task.completed` | Emitted when a task is marked `completed` with disposition | `TaskService.completeTask` | `task`, `disposition`, `actor` |

### 4. Conversation & Inbox Triggers

| Event Type | Description | Source Service | Normalized Payload Roots |
|---|---|---|---|
| `conversation.received` | Emitted when an inbound customer message is received via webhook | `ConversationWebhookService` | `conversation`, `message`, `channel` |
| `conversation.replied` | Emitted when an agent replies to an active conversation thread | `MessageService.sendMessage` | `conversation`, `message`, `actor` |

### 5. Manual Triggers

| Event Type | Description | Endpoint / Service | Required Permission |
|---|---|---|---|
| `manual.trigger` | On-demand trigger initiated by client administrators | `POST /api/v1/workflows/:id/execute` | `workflows.execute` |

Manual triggers execute under the exact same sandboxing, rate limits, audit logging, and condition evaluations as automated event-driven runs.
