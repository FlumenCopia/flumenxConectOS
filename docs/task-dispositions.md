# Task Outcome Dispositions & Next Follow-ups

Outcome dispositions provide a structured way for sales agents and marketing staff to log the results of client interactions (calls, emails, meetings) while automatically triggering next actions in the CRM.

---

## 1. Standard Dispositions Matrix

| Code | Label | Description | Next Action |
| :--- | :--- | :--- | :--- |
| `contacted` | Contacted | Direct conversation held with prospect | Optionally update lead stage |
| `left_voicemail` | Left Voicemail | Voicemail left on prospect's phone | Recommended follow-up in 24 hours |
| `rescheduled` | Rescheduled | Prospect requested a callback at a later time | **Auto-creates follow-up task** |
| `qualified` | Qualified | Prospect verified as matching ideal client profile | Advance lead pipeline to `qualified` |
| `unqualified` | Unqualified | Prospect does not meet budget or requirements | Move lead to `unqualified` |
| `not_interested` | Not Interested | Prospect politely declined | Move lead to `lost` |
| `wrong_number` | Wrong Number | Invalid contact information | Flag contact details in CRM |
| `no_response` | No Response | Ring out, no voicemail available | Recommended follow-up in 4 hours |

---

## 2. The Disposition Workflow

When an agent completes a task via `POST /api/v1/tasks/:id/disposition`:

1. **Task Completion**:
   * Sets `status: 'completed'`.
   * Records `disposition: data.disposition`.
   * Captures `completedAt: now` and `completedBy: actorId`.
   * Stores `completionNotes: data.notes`.
   * Freezes SLA state (`slaBreached` evaluated at completion time).

2. **Audit Logging**:
   * Logs a `disposition_applied` event with full details in `TaskEvent`.

3. **CRM Pipeline Synchronization**:
   * If `updateLeadStage` is provided (e.g. `'contacted'`, `'qualified'`), updates the linked CRM lead's `stage`.

4. **Automated Follow-up Task Scheduling**:
   * If `scheduleFollowUp: true` OR `disposition === 'rescheduled'`:
     * A new `Task` is created with status `open`.
     * `dueAt` is set to `followUpDueAt` (or defaults to `+24h`).
     * `priority` inherits from the parent task.
     * Inherits `leadId`, `contactId`, `conversationId`, and workspace assignment.
     * Starts a fresh SLA deadline window for the new task.
     * Links back to the parent task via `metadata.previousTaskId`.

---

## 3. API Request Example

```http
POST /api/v1/tasks/6aa7d6a270af4fe6e5937aa2/disposition HTTP/1.1
Host: localhost:5000
Content-Type: application/json
x-client-id: 6aa7d6a270af4fe6e5937a8b

{
  "disposition": "rescheduled",
  "notes": "Prospect was in a client meeting, asked to call back on Thursday at 2 PM",
  "scheduleFollowUp": true,
  "followUpDueAt": "2026-09-17T14:00:00.000Z",
  "followUpTitle": "Follow-up Call: Discussion on Enterprise Pricing",
  "followUpType": "call",
  "updateLeadStage": "contacted"
}
```
