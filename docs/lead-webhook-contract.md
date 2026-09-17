# flumenxConectOS — Lead Webhook Integration Contract

This document specifies the technical integration contract for sending prospective leads from external landing pages, WordPress/Elementor forms, advertising platforms, and webhooks into **flumenxConectOS**.

---

## 1. Webhook Endpoint Specification

- **URL:** `POST https://<api-domain>/api/v1/client/webhooks/leads`
- **Content-Type:** `application/json`
- **Rate Limit:** 120 requests per minute per IP address.

---

## 2. Authentication & Security Headers

Every webhook payload must supply the following HTTP headers:

| Header Name | Required | Description |
| :--- | :---: | :--- |
| `Content-Type` | **Yes** | Must be `application/json` |
| `X-Webhook-Secret` | **Yes** | The raw secret string generated in the flumenxConectOS Client Webhooks panel. |
| `X-Webhook-Timestamp` | Recommended | Current UNIX epoch timestamp in milliseconds or seconds (e.g. `1726305600000`). Used to defend against replay attacks. Max drift: 300s. |

> **Security Note:**
> Webhook secrets are hashed with SHA-256 before database storage. Never share your webhook secret publicly or embed it in client-side front-end code. Use server-side form handlers or edge functions to forward webhook calls.

---

## 3. Payload Schema Specification

### 3.1 Top-Level Fields

| Field | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `firstName` | `string` | **Yes** | Contact first name. |
| `lastName` | `string` | No | Contact last name. |
| `email` | `string` | Conditional* | Contact email address (must be valid email). |
| `phone` | `string` | Conditional* | Contact phone number. |
| `company` | `string` | No | Prospect's company or business name. |
| `title` | `string` | No | Job title / position. |
| `source` | `string` | No | Acquisition channel. One of: `meta_ads`, `google_ads`, `elementor_form`, `custom_webhook`, `manual`, `referral`, `other`. Defaults to the webhook configuration source. |
| `notes` | `string` | No | Inquiry message or initial notes. |
| `tags` | `array[string]`| No | List of string tags to categorize lead. |
| `attribution` | `object` | No | Marketing attribution tracking object (see below). |
| `customFields` | `object` | No | Arbitrary key-value map of form-specific fields. |

*\* Either `email` or `phone` must be provided to create a valid lead.*

### 3.2 Attribution Object Schema

```json
{
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "summer_growth_2026",
  "utmTerm": "digital marketing agency",
  "utmContent": "headline_variant_b",
  "landingPage": "https://clientdomain.com/landing",
  "referrer": "https://google.com",
  "adId": "ad_984729184",
  "formId": "form_contact_main"
}
```

---

## 4. Integration Examples

### 4.1 cURL Request

```bash
curl -X POST https://api.flumenx.com/api/v1/client/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: whsec_live_9a7b3c2e1f4d8091..." \
  -H "X-Webhook-Timestamp: 1726305600000" \
  -d '{
    "firstName": "Alexander",
    "lastName": "Vance",
    "email": "alexander.vance@example.com",
    "phone": "+1-555-0182",
    "company": "Vance Logistics",
    "title": "Director of Operations",
    "source": "elementor_form",
    "notes": "Looking for lead-gen optimization on our regional B2B logistics routes.",
    "tags": ["b2b", "inbound", "high-priority"],
    "attribution": {
      "utmSource": "google",
      "utmMedium": "cpc",
      "utmCampaign": "b2b_logistics_search",
      "formId": "elem_form_hero_quote"
    },
    "customFields": {
      "budgetRange": "$5,000 - $10,000 / month",
      "preferredContactTime": "Afternoons"
    }
  }'
```

### 4.2 Node.js / Express or Edge Worker Forwarder

```javascript
const response = await fetch('https://api.flumenx.com/api/v1/client/webhooks/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': process.env.FLUMENX_WEBHOOK_SECRET,
    'X-Webhook-Timestamp': Date.now().toString(),
  },
  body: JSON.stringify({
    firstName: req.body.first_name,
    lastName: req.body.last_name,
    email: req.body.email,
    phone: req.body.phone,
    company: req.body.company_name,
    source: 'custom_webhook',
    notes: req.body.comments,
    attribution: {
      utmSource: req.body.utm_source,
      utmCampaign: req.body.utm_campaign,
      landingPage: req.headers.referer,
    },
  }),
});

const result = await response.json();
```

---

## 5. API Responses & Status Codes

### 5.1 Success Response (HTTP 201 Created)

```json
{
  "success": true,
  "message": "Lead ingested successfully via webhook",
  "data": {
    "leadId": "6aa7b442655752141aef6305",
    "stage": "new",
    "score": 60,
    "scoreTier": "warm",
    "createdAt": "2026-09-14T14:15:54.120Z"
  }
}
```

### 5.2 Error Responses

| Status Code | Error Message | Solution |
| :---: | :--- | :--- |
| `401 Unauthorized` | `Webhook secret missing. Provide X-Webhook-Secret header.` | Verify that the `X-Webhook-Secret` header is present. |
| `401 Unauthorized` | `Invalid webhook secret.` | Verify that the token matches the active secret generated in flumenxConectOS. |
| `403 Forbidden` | `Webhook is currently inactive.` | Enable the webhook in the Client Webhooks panel. |
| `400 Bad Request` | `Webhook request timestamp expired or invalid. Replay rejected.` | Ensure the server clock is synced with NTP (drift must be < 300 seconds). |
| `422 Unprocessable Entity` | Validation error (e.g. missing name, invalid email) | Fix the JSON structure to include required fields. |
| `429 Too Many Requests` | Rate limit exceeded | Back off and retry. Maximum rate is 120 req/min per IP. |
