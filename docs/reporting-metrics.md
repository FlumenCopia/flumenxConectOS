# flumenxConectOS — Reporting Metrics & Calculation Specifications

This document details the exact mathematical formulas, aggregation pipelines, and boundary rules used across all modules of the Release 9 Reporting & Analytics Engine.

---

## 1. Overview KPIs

| Metric | Calculation / Aggregation Pipeline | Format | Guard / Fallback Rule |
| :--- | :--- | :--- | :--- |
| **Total Leads** | `Lead.countDocuments({ clientId, createdAt: { $gte, $lte }, isArchived: false })` | Integer (`3`) | None |
| **Won Leads** | `Lead.countDocuments({ clientId, stage: 'won', createdAt: { $gte, $lte }, isArchived: false })` | Integer (`1`) | None |
| **Lead Conversion Rate** | `(wonLeads / totalLeads) * 100` rounded to 1 decimal place | Percentage (`33.3%`) | If `totalLeads === 0`, returns `0` (never `NaN`) |
| **Form Submissions** | `FormSubmission.countDocuments({ clientId, createdAt: { $gte, $lte } })` | Integer (`1`) | None |
| **Tasks Completed** | `Task.countDocuments({ clientId, status: 'completed', completedAt: { $gte, $lte } })` | Integer (`1`) | None |
| **SLA Compliance Rate** | `(completedWithinSla / tasksCompleted) * 100` rounded to 1 decimal place | Percentage (`100%`) | If `tasksCompleted === 0`, returns `100` |
| **Active Conversations** | `Conversation.countDocuments({ clientId, status: { $in: ['open', 'pending'] }, updatedAt: { $gte, $lte } })` | Integer (`1`) | None |
| **Tracked Ad Spend** | `AdSpendDaily.aggregate([{ $match: { clientId, date } }, { $group: { totalSpend: { $sum: '$spend' } } }])` | Currency (`$500.00`) | Gated by `reports.view_financial`. Returns `null` if spend records missing |
| **Closed Revenue** | `Lead.aggregate([{ $match: { clientId, stage: 'won', estimatedValue: { $gt: 0 } } }, { $group: { totalRevenue: { $sum: '$estimatedValue' } } }])` | Currency (`$1,500.00`) | Gated by `reports.view_financial`. Returns `null` if no won deals with estimatedValue |
| **Blended ROAS** | `closedRevenue / totalSpend` rounded to 2 decimal places | Ratio (`3.0x`) | Returns `null` if spend === 0 or null, or revenue is null |

---

## 2. Period-over-Period Comparative Deltas

The platform compares any selected date range against an **equivalent preceding duration**:

$$\text{durationMs} = \text{end.getTime()} - \text{start.getTime()}$$
$$\text{prevStart} = \text{start} - \text{durationMs}, \quad \text{prevEnd} = \text{start}$$

### Percentage Change Formula:

$$\text{changePercentage} = \begin{cases} 
0 & \text{if } \text{previous} = 0 \text{ and } \text{current} = 0 \\
+100 & \text{if } \text{previous} = 0 \text{ and } \text{current} > 0 \\
\left(\frac{\text{current} - \text{previous}}{\text{previous}}\right) \times 100 & \text{otherwise}
\end{cases}$$

All percentage changes are formatted to 1 decimal place.

---

## 3. Campaign & Attribution Metrics

- **CTR (Click-Through Rate)**:
  $$\text{CTR} = \frac{\text{clicks}}{\text{impressions}} \times 100$$
  *Returns `null` if `impressions === 0`.*

- **CPC (Cost Per Click)**:
  $$\text{CPC} = \frac{\text{spend}}{\text{clicks}}$$
  *Gated by `reports.view_financial`. Returns `null` if spend or clicks is null or 0.*

- **CPL (Cost Per Attributed Lead)**:
  $$\text{CPL} = \frac{\text{spend}}{\text{leads}}$$
  *Gated by `reports.view_financial`. Returns `null` if spend or leads is null or 0.*

- **Zero-Fabrication Policy**:
  Under no circumstances does the engine report a zero CPL, CPC, or ROAS when spend is simply untracked. Missing data returns `null`, enabling the frontend to display `"N/A"` or `"Unavailable"`.

---

## 4. Website Forms Metrics

- **Form Views**: Direct views counter on `WebsiteForm.viewsCount`.
- **Form Submissions**: Count of `FormSubmission` records mapped to `formId`.
- **Submission Conversion Rate**:
  $$\text{Conversion Rate} = \frac{\text{submissions}}{\text{views}} \times 100$$
  *Returns `null` if `views === 0`.*
- **CRM Leads Created**: Submissions with a non-null `leadId`.

---

## 5. Tasks & Team Productivity Metrics

- **Avg Resolution Time**:
  $$\text{durationMinutes} = \frac{\text{completedAt} - \text{createdAt}}{60000}$$
  Averaged across all completed tasks in period. Returns `null` if no tasks completed.
- **SLA Breach Count**: Count of completed or open tasks where `slaBreached === true`.
- **Team Member Completion Rate**:
  $$\text{Completion Rate} = \frac{\text{completedCount}}{\text{totalAssigned}} \times 100$$
  *Returns `0%` if `totalAssigned === 0`.*
