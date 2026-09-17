# Release 7 — Campaigns & Ad Platform Integrations

## Overview

Release 7 introduces a multi-tenant campaign management, advertising data synchronization, and lead attribution foundation for **flumenxConectOS**. Every client workspace can connect external advertising accounts (Meta Marketing API and Google Ads API) using encrypted credentials, ingest advertising hierarchy data (Campaigns, Ad Sets, Ads, Daily Spend), track granular ad performance metrics (Spend, Clicks, Impressions, CTR, CPC, CPL, CPA), and trace multi-touch lead attribution from ad clicks and website forms directly into CRM Leads.

---

## Key Capabilities

1. **Read-Only Ad Platform Integrations**:
   - Secure integrations with **Meta Marketing API** and **Google Ads API**.
   - Read-only data ingestion: flumenxConectOS never mutates, pauses, creates, or deletes external campaigns or ads.
   - Deterministic mock adapters allow comprehensive local development and testing without requiring live third-party API credentials.

2. **AES-256-GCM Credential Security**:
   - OAuth tokens (access tokens and refresh tokens) are encrypted at rest with authenticated AES-256-GCM using an encryption key derived from environment secrets.
   - Plaintext credentials and encrypted tokens are strictly excluded from HTTP controller outputs (`select: false` on Mongoose schema).
   - Tamper-evident: ciphertext includes initialization vector (IV) and authentication tag.

3. **Multi-Tenant Hierarchy & Daily Spend**:
   - Every ad entity (`AdPlatformConnection`, `AdCampaign`, `AdSet`, `Ad`, `AdSpendDaily`, `LeadAttribution`) contains a mandatory `clientId` reference.
   - Idempotent daily spend ingestion tracks daily performance without duplication.
   - Partial sync failure resiliency ensures warnings are recorded without crashing background or API processes.

4. **Multi-Touch Lead Attribution Engine**:
   - Ingests UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) and click IDs (`fbclid`, `gclid`).
   - Automatically classifies touchpoints into `first_touch`, `last_touch`, and `multi_touch`.
   - **First-Touch Immutability**: Initial touchpoint records are preserved permanently and never overwritten.
   - Links website form submissions and webhook leads directly to campaigns, incrementing verified campaign lead counts.

5. **Audited Financial & Performance Reporting**:
   - Aggregates Spend, Impressions, Clicks, Conversions, Leads, and Attributed Leads.
   - Computes mathematical metrics: CTR (%), CPC ($), CPM ($), CPL ($), CPA ($).
   - **ROAS Integrity**: Return on Ad Spend is strictly calculated only from verified closed revenue (`won` CRM leads). If revenue is not tracked or closed, ROAS returns `null` rather than a fabricated figure.

---

## Database Architecture

| Model | Purpose | Key Indexes & Scoping |
|---|---|---|
| `AdPlatformConnection` | OAuth connection metadata & status | `{ clientId: 1, platform: 1, accountId: 1 }` (unique) |
| `AdCampaign` | Ingested external campaigns with metrics | `{ clientId: 1, platform: 1, externalCampaignId: 1 }` (unique) |
| `AdSet` | Ad groups / target audiences | `{ clientId: 1, externalAdSetId: 1 }`, `{ campaignId: 1 }` |
| `Ad` | Creative copy, headlines, and destination URLs | `{ clientId: 1, externalAdId: 1 }`, `{ adSetId: 1 }` |
| `AdSpendDaily` | Daily time-series breakdown of spend/clicks/leads | `{ clientId: 1, date: 1 }`, `{ clientId: 1, externalCampaignId: 1, date: 1 }` |
| `LeadAttribution` | Multi-touch attribution journeys linked to Leads | `{ clientId: 1, leadId: 1 }`, `{ clientId: 1, touchType: 1 }` |

---

## API Endpoints Reference

### Ad Connections
- `GET /api/v1/ads/connections` — List client ad platform connections (credentials stripped). Permission: `ads.view`
- `POST /api/v1/ads/connections` — Connect Meta or Google Ads account with encrypted credentials. Permission: `ads.manage_connections`
- `PUT /api/v1/ads/connections/:id/status` — Update connection status (`active`, `expired`, `revoked`, `error`). Permission: `ads.manage_connections`
- `DELETE /api/v1/ads/connections/:id` — Revoke and disconnect an ad account. Permission: `ads.manage_connections`

### Synchronization
- `POST /api/v1/ads/connections/:id/sync` — Trigger immediate synchronization for a connection. Permission: `ads.sync`
- `POST /api/v1/ads/sync-all` — Trigger synchronization for all active connections in workspace. Permission: `ads.sync`

### Reporting & Analytics
- `GET /api/v1/ads/reporting/summary` — Executive summary with spend, clicks, CPL, CPA, and verified ROAS. Permission: `ads.view_reporting`
- `GET /api/v1/ads/reporting/timeseries` — Daily chronological breakdown of spend and performance. Permission: `ads.view_reporting`
- `GET /api/v1/ads/campaigns` — Paginated campaigns report with metrics and attributed CRM leads. Permission: `ads.view`
- `GET /api/v1/ads/ad-sets` — Ad sets / ad groups for campaigns. Permission: `ads.view`
- `GET /api/v1/ads/ad-creatives` — Ad copy, headlines, and engagement. Permission: `ads.view`

### Lead Attribution
- `GET /api/v1/ads/attributions` — Paginated attribution journeys with UTM and click ID details. Permission: `ads.view_attribution`
- `GET /api/v1/ads/attributions/summary` — Platform and touchpoint distribution breakdown. Permission: `ads.view_attribution`
