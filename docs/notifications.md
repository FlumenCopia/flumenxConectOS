# In-App Notifications Architecture & API

## Overview

Release 10 introduces a centralized, tenant-scoped **In-App Notification Center** into `flumenxConectOS`. It provides users with immediate operational alerts (urgent leads arrived, SLA breaches, task assignments, workflow escalations) directly within the top application bar and dedicated management views.

---

## 1. Notification Model & Indexing

Stored in MongoDB collection `notifications`:

```typescript
export interface INotification {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  recipientUserId: mongoose.Types.ObjectId;
  type: NotificationType; // 'workflow_alert' | 'task_assigned' | 'sla_breached' | 'system'
  title: string;
  message: string;
  severity: NotificationSeverity; // 'info' | 'warning' | 'urgent' | 'critical'
  readAt: Date | null;
  sourceType: string;
  sourceId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Key Indices:
- `{ clientId: 1, recipientUserId: 1, readAt: 1 }`: Optimized for real-time unread badge counts and filtering.
- `{ clientId: 1, recipientUserId: 1, createdAt: -1 }`: Optimized for chronologically sorted paginated queries.

---

## 2. Notification API Endpoints

All routes are mounted under `/api/v1/notifications`:

| Method | Endpoint | Required Permission | Description |
|---|---|---|---|
| `GET` | `/unread-count` | `notifications.view` | Fast unread badge counter for Topbar integration. |
| `GET` | `/` | `notifications.view` | Lists paginated notifications for the current authenticated user. Supports `?unreadOnly=true&page=1&limit=20`. |
| `PATCH` | `/:id/read` | `notifications.manage` | Marks an individual notification as read. Sets `readAt` timestamp. |
| `POST` | `/mark-all-read` | `notifications.manage` | Marks all unread notifications for the user as read. |

---

## 3. RBAC Enforcement: `notifications.view` vs `notifications.manage`

In accordance with system security specifications:
- **`notifications.view`**:
  - Granted to all authenticated workspace roles (`super_admin`, `client_admin`, `client_staff`).
  - Allows querying unread count and fetching list of notification records.
- **`notifications.manage`**:
  - Granted to `super_admin` and `client_admin`.
  - Required to mark notifications as read, change status, or bulk acknowledge alerts.
  - Attempting to call `PATCH /:id/read` or `POST /mark-all-read` without this permission yields `403 Forbidden`.

---

## 4. Frontend Notification Center Component

The notification UI is built in `frontend/components/notifications/NotificationCenter.tsx`:
- Embedded in `frontend/components/layout/Topbar.tsx`.
- Features an animated bell icon with live badge counter.
- Popover dropdown displays the most recent 10 notifications with visual severity color coding:
  - `info`: Blue indicator.
  - `warning`: Amber indicator.
  - `urgent`: Orange indicator.
  - `critical`: Red alert badge.
- Interactive controls allow filtering by unread-only and instant "Mark All as Read".
