/**
 * Safe CSV Generation and Formula-Injection Defense Utility.
 * Adheres to RFC-4180 and OWASP CSV Injection Guidelines.
 */

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

export interface CsvExportOptions {
  metadata?: Record<string, string | number | boolean>;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

/**
 * Builds a RFC-4180 compliant CSV file content with formula injection defense
 * applied to all metadata rows, headers, and cell values.
 */
export function buildSafeCsv(options: CsvExportOptions): string {
  const lines: string[] = [];

  // 1. Optional Metadata Section (Commented / Labelled)
  if (options.metadata && Object.keys(options.metadata).length > 0) {
    for (const [key, val] of Object.entries(options.metadata)) {
      lines.push(`# ${sanitizeCsvField(key)}: ${sanitizeCsvField(val)}`);
    }
    lines.push(''); // Blank separator line
  }

  // 2. Header Row (Sanitized against formula injection)
  lines.push(options.headers.map((h) => sanitizeCsvField(h)).join(','));

  // 3. Data Rows
  for (const row of options.rows) {
    lines.push(row.map((cell) => sanitizeCsvField(cell)).join(','));
  }

  return lines.join('\r\n');
}
