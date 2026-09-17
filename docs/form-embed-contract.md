# Form Embed Contract & Public API Specification

## 1. Public Form Retrieval

### `GET /api/public/forms/:publicKey`
(Also available via `/api/v1/public/forms/:publicKey`)

#### Purpose
Retrieves the safe public definition of a published form for browser rendering.

#### Request Headers
- `Origin`: Origin of the host page (checked against `allowedDomains` if configured).
- `Referer`: Referring URL.

#### Response Example (200 OK)
```json
{
  "success": true,
  "data": {
    "publicKey": "form_pub_41894b95797912eb450c1d22",
    "name": "Main Contact & Consultation Form",
    "description": "Schedule a free digital marketing consultation.",
    "submitButtonLabel": "Request Strategy Call",
    "successMessage": "Thank you! Our digital marketing team will reach out within 24 hours.",
    "redirectUrl": "https://example.com/thank-you",
    "honeypotField": "_hp_website",
    "captchaEnabled": false,
    "captchaProvider": "mock",
    "captchaSiteKey": null,
    "fields": [
      {
        "fieldKey": "full_name",
        "label": "Full Name",
        "type": "text",
        "placeholder": "Jane Doe",
        "required": true,
        "order": 0
      },
      {
        "fieldKey": "email",
        "label": "Business Email",
        "type": "email",
        "placeholder": "jane@company.com",
        "required": true,
        "order": 1
      },
      {
        "fieldKey": "service_interest",
        "label": "Service of Interest",
        "type": "select",
        "options": [
          { "label": "Paid Search (PPC)", "value": "ppc" },
          { "label": "Paid Social Ads", "value": "social" },
          { "label": "SEO & Content", "value": "seo" }
        ],
        "required": false,
        "order": 2
      }
    ]
  }
}
```

*Note: Private properties such as `clientId`, `notificationSettings`, `leadMapping`, and internal secrets are NEVER returned.*

---

## 2. Public Form Submission

### `POST /api/public/forms/:publicKey/submit`
(Also available via `/api/v1/public/forms/:publicKey/submit`)

#### Purpose
Accepts visitor form submissions from standalone pages, iframes, or embedded widgets.

#### Request Body
```json
{
  "submissionId": "sub_optional_client_tx_id",
  "full_name": "Jane Doe",
  "email": "jane@company.com",
  "phone": "+1 (555) 234-5678",
  "service_interest": "ppc",
  "_hp_website": "",
  "_form_loaded_at": 1789378000000,
  "sourceUrl": "https://client-landing-page.com"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Thank you! Our digital marketing team will reach out within 24 hours.",
    "redirectUrl": "https://example.com/thank-you",
    "submissionId": "sub_8f238ab201c841"
  },
  "message": "Thank you! Our digital marketing team will reach out within 24 hours."
}
```

---

## 3. Embed Implementations

### Option A: Responsive iFrame (Zero CSS/JS conflicts)
```html
<iframe
  src="https://app.flumenx.com/public/forms/form_pub_41894b95797912eb450c1d22"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; max-width: 640px; width: 100%;"
  allow="autoplay"
></iframe>
```

### Option B: Asynchronous JavaScript Loader
```html
<div id="flumenx-form-form_pub_41894b95797912eb450c1d22"></div>
<script
  src="https://app.flumenx.com/embed/flumenx-form.js"
  data-form-key="form_pub_41894b95797912eb450c1d22"
  async
></script>
```
