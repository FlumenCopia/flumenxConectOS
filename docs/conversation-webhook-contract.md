# flumenxConectOS — Conversation Webhook Integration Contract

This document details the HTTP contract for forwarding inbound customer messages from external messaging providers (Meta WhatsApp Cloud API, Twilio SMS, Email webhooks) into **flumenxConectOS**.

---

## 1. Webhook Endpoint Specification

- **URL:** `POST https://<api-domain>/api/v1/client/webhooks/conversations`
- **Content-Type:** `application/json`
- **Rate Limit:** 120 requests per minute per IP address.

---

## 2. Security Headers

| Header Name | Required | Description |
| :--- | :---: | :--- |
| `Content-Type` | **Yes** | Must be `application/json` |
| `X-Webhook-Secret` | **Yes** | Client webhook secret token generated in flumenxConectOS. |
| `X-Webhook-Timestamp` | Recommended | Epoch timestamp in milliseconds (e.g. `1726305600000`) for replay protection (< 300s window). |

---

## 3. Inbound Payload JSON Schema

```json
{
  "channel": "whatsapp",
  "externalMessageId": "wamid_HBgLMjM0OT...",
  "from": {
    "name": "Sarah Connor",
    "phone": "+1-555-0199",
    "email": "sarah@example.com"
  },
  "body": "Hello! I am confirming our scheduled meeting for tomorrow.",
  "attachments": [
    {
      "name": "brief.pdf",
      "url": "https://storage.provider.com/brief.pdf",
      "size": 102400,
      "mimeType": "application/pdf"
    }
  ],
  "timestamp": 1726305600000
}
```

### Fields Specification

| Field | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `channel` | `string` | **Yes** | One of: `whatsapp`, `email`, `sms`, `internal`, `other`. |
| `externalMessageId` | `string` | **Yes** | Gateway message ID used for duplicate prevention and idempotency. |
| `from` | `object` | **Yes** | Sender contact information. |
| `from.name` | `string` | **Yes** | Contact display name. |
| `from.phone` | `string` | Optional | Sender phone number (required for WhatsApp/SMS). |
| `from.email` | `string` | Optional | Sender email address (required for Email). |
| `body` | `string` | **Yes** | Text body of the message. |
| `attachments` | `array` | No | List of attachment objects (`name`, `url`, `size`, `mimeType`). |
| `timestamp` | `number \| string` | No | Timestamp of message creation at provider. |

---

## 4. Idempotency & Deduplication Behavior

The webhook engine guarantees **at-most-once processing** per external message:
1. When an inbound payload arrives, the database is queried for `{ clientId, externalMessageId }`.
2. If found, the webhook immediately acknowledges receipt with HTTP 200:
   ```json
   {
     "success": true,
     "message": "Webhook event acknowledged (duplicate)",
     "data": {
       "success": true,
       "duplicate": true,
       "messageId": "6aa7bb...",
       "conversationId": "6aa7bc..."
     }
   }
   ```
3. No duplicate message is inserted, and no unread counters are incremented.

---

## 5. cURL Integration Example

```bash
curl -X POST https://api.flumenx.com/api/v1/client/webhooks/conversations \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: whsec_conv_live_9a7b..." \
  -H "X-Webhook-Timestamp: 1726305600000" \
  -d '{
    "channel": "whatsapp",
    "externalMessageId": "wam_test_01928374",
    "from": {
      "name": "David Wallace",
      "phone": "+1-555-0244",
      "email": "david.wallace@dunder.com"
    },
    "body": "Hi, we are interested in expanding our SEO contract to cover regional branches."
  }'
```

---

## 6. Response Codes

| Status Code | Reason |
| :---: | :--- |
| `201 Created` | Inbound message accepted and added to conversation thread. |
| `200 OK` | Duplicate `externalMessageId` recognized; acknowledged without duplication. |
| `400 Bad Request` | Malformed payload or expired `X-Webhook-Timestamp` (> 300s drift). |
| `401 Unauthorized` | Missing or invalid `X-Webhook-Secret`. |
| `429 Too Many Requests` | Exceeded 120 requests/minute per IP rate limit. |
