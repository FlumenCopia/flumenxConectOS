# Multi-Touch Lead Attribution Engine

## Overview

The flumenxConectOS Attribution Engine solves the problem of disconnected advertising clicks and CRM sales pipelines. When prospects interact with digital campaigns across Meta and Google Ads, their journeys are recorded, mapped, and attributed directly to CRM Leads and Contacts.

---

## 1. Touchpoint Classification & Lifecycle

| Touchpoint Type | Definition | Lifecycle Rule |
|---|---|---|
| `first_touch` | The initial interaction that introduced the prospect | **Permanently Immutable**. Once created, this record is never deleted, mutated, or replaced. |
| `last_touch` | The most recent interaction immediately preceding lead creation or inquiry | Dynamically updated upon subsequent clicks or form submissions. |
| `multi_touch` | Any intermediate interactions between first and last touch | Preserves the comprehensive chronological journey. |

---

## 2. Ingestion Signals & Priority

The attribution engine analyzes multiple incoming data signals:

1. **Click Identifiers**:
   - `fbclid` (Facebook / Meta Click ID) $\to$ Classified as `meta`
   - `gclid` (Google Click ID) $\to$ Classified as `google`
2. **Standard UTM Parameters**:
   - `utm_source`: `facebook`, `instagram`, `meta` $\to$ `meta`
   - `utm_source`: `google`, `adwords` with `utm_medium` of `cpc`, `ppc`, `paid_search` $\to$ `google`
   - `utm_campaign`: Campaign name or external campaign identifier.
   - `utm_term`: Search intent query or target keyword.
   - `utm_content`: Creative or ad variation.
3. **HTTP Referrer**:
   - Search engines without paid tags $\to$ `organic`
   - External domains $\to$ `referral`
   - Empty referrer without tags $\to$ `direct`

---

## 3. CRM Integration & Campaign Linking

When an attribution record is created:
1. **Lead Source Enrichment**:
   - If the Lead's source is unset or default, it is updated to `meta_ads`, `google_ads`, or `organic`.
   - The Lead's `campaignName` and `campaignId` are synchronized.
2. **Matching to Synced Ad Campaigns**:
   - If `utm_campaign` matches a synced `AdCampaign` (either by name or `externalCampaignId`), the record links to `campaignId`.
   - The campaign's `metrics.leads` counter is incremented in real-time.
3. **Verified Closed-Won Revenue Attribution**:
   - Won leads with an `estimatedValue` attribute their closed revenue directly to the campaign, enabling verified ROAS calculations without guesswork.
