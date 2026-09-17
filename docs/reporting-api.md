# flumenxConectOS — Reporting & Analytics API Reference

All reporting endpoints require an authenticated user session (`requireAuth`) and appropriate tenant scoping via `x-client-id` or active membership resolution.

Base URL: `/api/v1/reports`

---

## 1. Overview KPIs
`GET /api/v1/reports/overview`
- **Permission**: `reports.view`
- **Query Parameters**:
  - `preset`: `'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'previous_month' | 'custom'` (default: `'last_30_days'`)
  - `startDate`: ISO 8601 string (required when `preset=custom`)
  - `endDate`: ISO 8601 string (required when `preset=custom`)
  - `compare`: boolean (default: `true`)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "dateRange": {
        "preset": "last_30_days",
        "current": { "start": "2026-08-15T...", "end": "2026-09-14T..." },
        "previous": { "start": "2026-07-16T...", "end": "2026-08-15T..." }
      },
      "metrics": {
        "totalLeads": { "value": 142, "previousValue": 120, "changePercentage": 18.3 },
        "wonLeads": { "value": 34, "previousValue": 25, "changePercentage": 36.0 },
        "conversionRate": { "value": 23.9, "previousValue": 20.8, "changePercentage": 14.9 },
        "formSubmissions": { "value": 88, "previousValue": 72, "changePercentage": 22.2 },
        "tasksCompleted": { "value": 215, "previousValue": 190, "changePercentage": 13.2 },
        "slaComplianceRate": { "value": 98.1, "previousValue": 96.5, "changePercentage": 1.7 },
        "activeConversations": { "value": 45, "previousValue": 40, "changePercentage": 12.5 },
        "totalSpend": { "value": 4500.0, "previousValue": 4200.0, "changePercentage": 7.1 },
        "closedRevenue": { "value": 18000.0, "previousValue": 14500.0, "changePercentage": 24.1 },
        "roas": { "value": 4.0, "previousValue": 3.45, "changePercentage": 15.9 }
      }
    }
  }
  ```
  *(Note: `totalSpend`, `closedRevenue`, and `roas` are included only if the caller possesses `reports.view_financial`).*

---

## 2. Lead & Pipeline Analytics
`GET /api/v1/reports/leads`
- **Permission**: `reports.view`
- **Query Parameters**: `preset`, `startDate`, `endDate`, `source`, `stage`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "dateRange": { "preset": "last_30_days", "start": "...", "end": "..." },
      "totalLeads": 142,
      "trend": [{ "date": "2026-09-01", "total": 12, "won": 3, "lost": 1 }],
      "sources": [
        { "source": "meta_ads", "count": 68, "percentage": 47.9, "wonCount": 18, "conversionRate": 26.5 },
        { "source": "google_ads", "count": 42, "percentage": 29.6, "wonCount": 11, "conversionRate": 26.2 }
      ],
      "stages": [
        { "stage": "new", "count": 35, "percentage": 24.6, "totalValue": 12000 },
        { "stage": "won", "count": 34, "percentage": 23.9, "totalValue": 18000 }
      ],
      "scoreTiers": [
        { "tier": "hot", "count": 48 },
        { "tier": "warm", "count": 62 },
        { "tier": "cold", "count": 32 }
      ]
    }
  }
  ```

---

## 3. Campaigns & Attribution
`GET /api/v1/reports/campaigns`
- **Permission**: `reports.view`
- **Query Parameters**: `preset`, `startDate`, `endDate`, `campaignId`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "platforms": [{ "platform": "meta", "attributedLeads": 68 }],
      "touchpoints": [
        { "type": "first_touch", "count": 68 },
        { "type": "last_touch", "count": 55 }
      ],
      "campaigns": [
        {
          "campaignId": "...",
          "name": "Retargeting - September",
          "platform": "meta",
          "status": "ACTIVE",
          "impressions": 45000,
          "clicks": 1200,
          "leads": 42,
          "ctr": 2.67,
          "cpc": 1.25,
          "cpl": 35.71,
          "spend": 1500.0
        }
      ]
    }
  }
  ```

---

## 4. Team Productivity
`GET /api/v1/reports/team`
- **Permission**: `reports.view_team`
- **Query Parameters**: `preset`, `startDate`, `endDate`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "team": [
        {
          "userId": "...",
          "name": "Sarah Connor",
          "email": "sarah@client.com",
          "totalAssigned": 45,
          "completed": 41,
          "open": 4,
          "breached": 1,
          "completionRate": 91.1
        }
      ]
    }
  }
  ```

---

## 5. CSV Export
`GET /api/v1/reports/export`
- **Permission**: `reports.export`
- **Query Parameters**:
  - `reportType`: `'overview' | 'leads' | 'campaigns' | 'forms' | 'tasks' | 'team' | 'conversations'` (required)
  - `preset`, `startDate`, `endDate`, `limit` (max: 5,000)
- **Response**:
  - `Content-Type`: `text/csv; charset=utf-8`
  - `Content-Disposition`: `attachment; filename="flumenx-leads-report-17893789.csv"`
  - Formula injection sanitized RFC-4180 stream.

---

## 6. Saved Reports CRUD
- `GET /api/v1/reports/saved`: List accessible saved views (`reports.view`)
- `POST /api/v1/reports/saved`: Create new saved view (`reports.manage_saved`)
- `GET /api/v1/reports/saved/:id`: Inspect single saved view (`reports.view`)
- `PATCH /api/v1/reports/saved/:id`: Update saved view (`reports.manage_saved`)
- `DELETE /api/v1/reports/saved/:id`: Remove saved view (`reports.manage_saved`)
