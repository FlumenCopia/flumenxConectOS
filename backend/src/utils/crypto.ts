import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the configured ENCRYPTION_SECRET_KEY.
 */
const getKey = (): Buffer => {
  return crypto.createHash('sha256').update(env.ENCRYPTION_SECRET_KEY).digest();
};

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all in hex).
 */
export const encrypt = (plaintext: string): string => {
  if (!plaintext) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects format: iv:authTag:ciphertext.
 */
export const decrypt = (cipherString: string): string => {
  if (!cipherString) return '';
  const parts = cipherString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

export const PROVIDER_SECRET_KEYS = [
  'accessToken',
  'pageAccessToken',
  'authToken',
  'apiKey',
  'pass',
  'appSecret',
  'webhookSecret',
] as const;

const ENCRYPTED_PATTERN = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

export const isEncryptedValue = (value: unknown): value is string => {
  return typeof value === 'string' && ENCRYPTED_PATTERN.test(value.trim());
};

/**
 * Encrypts a provider secret if it is non-empty and not already AES-256-GCM encrypted.
 */
export const encryptProviderSecret = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed || isEncryptedValue(trimmed)) {
    return trimmed;
  }
  return encrypt(trimmed);
};

/**
 * Decrypts a provider secret if stored in AES-256-GCM iv:authTag:ciphertext format,
 * or returns legacy plaintext strings safely trimmed.
 */
export const decryptProviderSecret = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isEncryptedValue(trimmed)) {
    return decrypt(trimmed);
  }
  return trimmed;
};

/**
 * Encrypts sensitive keys within a CommunicationProvider configuration object before persistence.
 */
export const encryptProviderConfiguration = (
  config: Record<string, any> = {}
): Record<string, any> => {
  const next: Record<string, any> = { ...config };
  for (const key of PROVIDER_SECRET_KEYS) {
    if (typeof next[key] === 'string' && next[key].trim() && !next[key].includes('•')) {
      next[key] = encryptProviderSecret(next[key]);
    }
  }
  return next;
};

/**
 * Returns a shallow copy of CommunicationProvider configuration with secret keys decrypted for server-side use only.
 */
export const decryptProviderConfiguration = (
  config: Record<string, any> = {}
): Record<string, any> => {
  const next: Record<string, any> = { ...config };
  for (const key of PROVIDER_SECRET_KEYS) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      next[key] = decryptProviderSecret(next[key]);
    }
  }
  return next;
};

/**
 * Masks all secret keys in a CommunicationProvider configuration object for safe API responses.
 */
export const sanitizeProviderConfiguration = (
  config: Record<string, any> = {}
): Record<string, any> => {
  const next: Record<string, any> = { ...config };
  for (const key of PROVIDER_SECRET_KEYS) {
    if (typeof next[key] === 'string' && next[key].trim()) {
      next[key] = '••••••••';
    }
  }
  return next;
};

/**
 * Produces a credential-safe representation of a CommunicationProvider document for HTTP responses.
 */
export const sanitizeProviderDocument = (provider: any): Record<string, any> => {
  const obj = typeof provider?.toObject === 'function' ? provider.toObject() : { ...provider };
  delete obj.webhookSecretHash;
  obj.configuration = sanitizeProviderConfiguration(obj.configuration || {});
  return obj;
};

export type MetaSignatureFailureReason =
  | 'missing_secret'
  | 'missing_raw_body'
  | 'missing_signature'
  | 'malformed_signature'
  | 'invalid_signature';

export interface IMetaSignatureVerificationResult {
  valid: boolean;
  reason?: MetaSignatureFailureReason;
}

const META_SHA256_HEADER_PATTERN = /^sha256=([0-9a-f]{64})$/i;

/**
 * Extracts and verifies Meta X-Hub-Signature-256 HMAC-SHA256 digest using raw request bytes.
 */
export const verifyMetaHmacSignature = (
  rawBody: Buffer | string | undefined,
  signatureHeader: string | string[] | undefined,
  appSecret: string | undefined
): IMetaSignatureVerificationResult => {
  const secret = typeof appSecret === 'string' ? appSecret.trim() : '';
  if (!secret) {
    return { valid: false, reason: 'missing_secret' };
  }

  if (!rawBody || (typeof rawBody === 'string' && rawBody.length === 0) || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
    return { valid: false, reason: 'missing_raw_body' };
  }

  if (typeof signatureHeader !== 'string' || !signatureHeader.trim()) {
    return { valid: false, reason: 'missing_signature' };
  }

  const match = META_SHA256_HEADER_PATTERN.exec(signatureHeader.trim());
  if (!match) {
    return { valid: false, reason: 'malformed_signature' };
  }

  const expectedDigest = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const providedDigest = Buffer.from(match[1], 'hex');

  if (expectedDigest.length !== providedDigest.length) {
    return { valid: false, reason: 'invalid_signature' };
  }

  if (!crypto.timingSafeEqual(expectedDigest, providedDigest)) {
    return { valid: false, reason: 'invalid_signature' };
  }

  return { valid: true };
};

/**
 * Resolves the platform Meta App Secret configured for incoming Meta webhooks.
 * Supports optional META_INSTAGRAM_APP_SECRET when Instagram uses a distinct Instagram App Secret.
 */
export const resolveMetaWebhookAppSecret = (metaObject?: string): string | undefined => {
  if (metaObject === 'instagram') {
    const igSecret = (process.env.META_INSTAGRAM_APP_SECRET || '').trim();
    if (igSecret) {
      return igSecret;
    }
  }
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  return appSecret || undefined;
};

/**
 * Helper for provider adapter verifyWebhook(headers, rawBody, secret) implementations.
 */
export const verifyMetaWebhookHeaders = (
  headers: Record<string, any>,
  rawBody: Buffer | string | undefined,
  appSecret?: string
): boolean => {
  const sigHeader =
    headers?.['x-hub-signature-256'] ?? headers?.['X-Hub-Signature-256'];
  const effectiveSecret =
    appSecret !== undefined ? appSecret.trim() : resolveMetaWebhookAppSecret() || '';
  return verifyMetaHmacSignature(rawBody, sigHeader, effectiveSecret).valid;
};

export type MetaVerifyTokenFailureReason =
  | 'missing_config'
  | 'missing_token'
  | 'invalid_token';

/**
 * Verifies Meta GET webhook challenge verify_token using constant-time Buffer comparison.
 */
export const verifyMetaVerifyToken = (
  suppliedToken: unknown,
  expectedToken: string | undefined
): { valid: boolean; reason?: MetaVerifyTokenFailureReason } => {
  const expected = typeof expectedToken === 'string' ? expectedToken.trim() : '';
  if (!expected) {
    return { valid: false, reason: 'missing_config' };
  }

  if (typeof suppliedToken !== 'string' || !suppliedToken) {
    return { valid: false, reason: 'missing_token' };
  }

  const suppliedBuf = Buffer.from(suppliedToken, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (suppliedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: 'invalid_token' };
  }

  if (!crypto.timingSafeEqual(suppliedBuf, expectedBuf)) {
    return { valid: false, reason: 'invalid_token' };
  }

  return { valid: true };
};

const timingSafeStringEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

export type TwilioBaseUrlFailureReason =
  | 'missing_url_config'
  | 'invalid_url_config'
  | 'insecure_url_config';

export interface ITwilioBaseUrlResolutionResult {
  valid: boolean;
  baseUrl?: string;
  reason?: TwilioBaseUrlFailureReason;
}

/**
 * Resolves and validates the canonical public webhook base URL from trusted server configuration.
 * Does not derive host or protocol from untrusted incoming request headers.
 */
export const resolveTwilioWebhookBaseUrl = (
  explicitBaseUrl?: string
): ITwilioBaseUrlResolutionResult => {
  const rawCandidate = (
    explicitBaseUrl ??
    process.env.TWILIO_WEBHOOK_BASE_URL ??
    process.env.PUBLIC_WEBHOOK_BASE_URL ??
    ''
  ).trim();

  if (!rawCandidate) {
    return { valid: false, reason: 'missing_url_config' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawCandidate);
  } catch {
    return { valid: false, reason: 'invalid_url_config' };
  }

  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    return { valid: false, reason: 'invalid_url_config' };
  }

  const isLocalHttpAllowed =
    process.env.NODE_ENV !== 'production' &&
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

  if (parsed.protocol !== 'https:' && !isLocalHttpAllowed) {
    return { valid: false, reason: 'insecure_url_config' };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  return {
    valid: true,
    baseUrl: `${parsed.origin}${normalizedPath}`,
  };
};

/**
 * Reconstructs the exact public callback URL using the configured public base URL and Express originalUrl.
 */
export const buildTwilioWebhookUrl = (baseUrl: string, originalUrl: string): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
  return `${normalizedBase}${normalizedPath}`;
};

/**
 * Computes Twilio's documented X-Twilio-Signature (HMAC-SHA1 base64) for form-encoded POST webhooks.
 */
export const computeTwilioSignature = (
  url: string,
  params: Record<string, any> = {},
  authToken: string
): string | null => {
  if (!url || !authToken || typeof params !== 'object' || params === null || Array.isArray(params)) {
    return null;
  }

  let data = url;
  const sortedKeys = Object.keys(params).sort();

  for (const key of sortedKeys) {
    const value = params[key];
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === 'object') {
          return null;
        }
      }
      const sortedValues = value.map((item) => String(item)).sort();
      for (const item of sortedValues) {
        data += key + item;
      }
    } else if (typeof value === 'object') {
      return null;
    } else {
      data += key + String(value);
    }
  }

  return crypto.createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
};

/**
 * Computes Twilio's documented X-Twilio-Signature (HMAC-SHA1 base64) over full URL (JSON bodySHA256 mode).
 */
export const computeTwilioUrlOnlySignature = (url: string, authToken: string): string => {
  return crypto.createHmac('sha1', authToken).update(url, 'utf8').digest('base64');
};

export type TwilioSignatureFailureReason =
  | 'missing_auth_token'
  | 'invalid_url'
  | 'missing_signature'
  | 'unsupported_content_type'
  | 'missing_body_sha256'
  | 'malformed_body_sha256'
  | 'missing_raw_body'
  | 'body_sha256_mismatch'
  | 'unexpected_body_sha256'
  | 'malformed_body'
  | 'invalid_signature';

export interface ITwilioSignatureVerificationOptions {
  url: string;
  signatureHeader: string | string[] | undefined;
  authToken: string | undefined;
  contentType?: string;
  body?: unknown;
  rawBody?: Buffer | string;
}

export interface ITwilioSignatureVerificationResult {
  valid: boolean;
  reason?: TwilioSignatureFailureReason;
}

const TWILIO_BODY_SHA256_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Validates incoming Twilio webhook requests against X-Twilio-Signature.
 * Supports application/x-www-form-urlencoded POST params and application/json callbacks with bodySHA256.
 */
export const verifyTwilioRequestSignature = (
  options: ITwilioSignatureVerificationOptions
): ITwilioSignatureVerificationResult => {
  const secret = typeof options.authToken === 'string' ? options.authToken.trim() : '';
  if (!secret) {
    return { valid: false, reason: 'missing_auth_token' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(options.url);
  } catch {
    return { valid: false, reason: 'invalid_url' };
  }

  if (typeof options.signatureHeader !== 'string' || !options.signatureHeader.trim()) {
    return { valid: false, reason: 'missing_signature' };
  }
  const providedSig = options.signatureHeader.trim();

  const mediaType = (options.contentType || '').split(';')[0].trim().toLowerCase();
  const isJson = mediaType === 'application/json' || mediaType.endsWith('+json');
  const isForm = mediaType === 'application/x-www-form-urlencoded';

  if (isJson) {
    const shaParams = parsedUrl.searchParams.getAll('bodySHA256');
    if (shaParams.length !== 1 || !shaParams[0].trim()) {
      return { valid: false, reason: 'missing_body_sha256' };
    }

    const expectedBodyHash = shaParams[0].trim().toLowerCase();
    if (!TWILIO_BODY_SHA256_PATTERN.test(expectedBodyHash)) {
      return { valid: false, reason: 'malformed_body_sha256' };
    }

    if (!Buffer.isBuffer(options.rawBody) && typeof options.rawBody !== 'string') {
      return { valid: false, reason: 'missing_raw_body' };
    }

    const actualBodyHash = crypto.createHash('sha256').update(options.rawBody).digest('hex');
    if (!timingSafeStringEqual(actualBodyHash, expectedBodyHash)) {
      return { valid: false, reason: 'body_sha256_mismatch' };
    }

    const expectedSig = computeTwilioUrlOnlySignature(options.url, secret);
    if (!timingSafeStringEqual(providedSig, expectedSig)) {
      return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true };
  }

  if (isForm) {
    if (parsedUrl.searchParams.has('bodySHA256')) {
      return { valid: false, reason: 'unexpected_body_sha256' };
    }

    const params =
      options.body !== undefined && options.body !== null ? (options.body as Record<string, any>) : {};
    const expectedSig = computeTwilioSignature(options.url, params, secret);
    if (!expectedSig) {
      return { valid: false, reason: 'malformed_body' };
    }

    if (!timingSafeStringEqual(providedSig, expectedSig)) {
      return { valid: false, reason: 'invalid_signature' };
    }

    return { valid: true };
  }

  return { valid: false, reason: 'unsupported_content_type' };
};

/**
 * Computes the canonical one-way SHA-256 hex hash of a generic webhook secret.
 */
export const hashWebhookSecret = (rawSecret: string): string => {
  return crypto.createHash('sha256').update(rawSecret.trim(), 'utf8').digest('hex');
};

/**
 * Verifies a plaintext generic webhook secret against its stored SHA-256 hex hash using constant-time comparison.
 */
export const verifyWebhookSecretHash = (
  rawSecret: string,
  expectedHash: string | undefined
): boolean => {
  const trimmedSecret = typeof rawSecret === 'string' ? rawSecret.trim() : '';
  const storedHash = typeof expectedHash === 'string' ? expectedHash.trim().toLowerCase() : '';
  if (!trimmedSecret || !/^[0-9a-f]{64}$/.test(storedHash)) {
    return false;
  }

  const incomingBuf = Buffer.from(hashWebhookSecret(trimmedSecret), 'hex');
  const expectedBuf = Buffer.from(storedHash, 'hex');
  if (incomingBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(incomingBuf, expectedBuf);
};

export interface IWebhookTimestampValidationResult {
  valid: boolean;
  parsedTimeMs?: number;
  reason?: 'invalid_timestamp' | 'expired_timestamp' | 'future_timestamp';
}

/**
 * Strictly parses and validates a generic webhook timestamp against an allowed replay drift window.
 * Accepts finite epoch milliseconds, positive epoch seconds (< 1e12), or strict ISO-8601 dates.
 * Rejects empty strings, zero, non-finite numbers, arrays/objects, expired, and future-dated values.
 */
export const validateWebhookTimestampValue = (
  rawTimestamp: unknown,
  maxDriftMs: number = 300 * 1000
): IWebhookTimestampValidationResult => {
  if (
    rawTimestamp === null ||
    rawTimestamp === undefined ||
    typeof rawTimestamp === 'boolean' ||
    Array.isArray(rawTimestamp) ||
    typeof rawTimestamp === 'object'
  ) {
    return { valid: false, reason: 'invalid_timestamp' };
  }

  let parsedTimeMs = NaN;
  if (typeof rawTimestamp === 'number') {
    if (!Number.isFinite(rawTimestamp) || rawTimestamp <= 0) {
      return { valid: false, reason: 'invalid_timestamp' };
    }
    parsedTimeMs = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
  } else if (typeof rawTimestamp === 'string') {
    const trimmed = rawTimestamp.trim();
    if (!trimmed) {
      return { valid: false, reason: 'invalid_timestamp' };
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numericVal = Number(trimmed);
      if (!Number.isFinite(numericVal) || numericVal <= 0) {
        return { valid: false, reason: 'invalid_timestamp' };
      }
      parsedTimeMs = numericVal < 1e12 ? numericVal * 1000 : numericVal;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      parsedTimeMs = Date.parse(trimmed);
    } else {
      return { valid: false, reason: 'invalid_timestamp' };
    }
  } else {
    return { valid: false, reason: 'invalid_timestamp' };
  }

  if (!Number.isFinite(parsedTimeMs) || parsedTimeMs <= 0) {
    return { valid: false, reason: 'invalid_timestamp' };
  }

  const now = Date.now();
  if (now - parsedTimeMs > maxDriftMs) {
    return { valid: false, reason: 'expired_timestamp' };
  }
  if (parsedTimeMs - now > maxDriftMs) {
    return { valid: false, reason: 'future_timestamp' };
  }

  return { valid: true, parsedTimeMs };
};
