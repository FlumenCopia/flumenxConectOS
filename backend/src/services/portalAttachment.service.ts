import crypto from 'crypto';
import path from 'path';
import { AppError } from '../middleware/errorHandler';

export interface IValidatedAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
  '.docx',
  '.txt',
  '.csv',
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.php',
  '.js',
  '.ts',
  '.html',
  '.htm',
  '.svg',
  '.jar',
  '.vbs',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_COUNT = 5;

export class PortalAttachmentService {
  /**
   * Validates attachments for customer request or conversation uploads.
   * Enforces count, size ceilings, extension allowlist, and MIME type safety.
   */
  public static validateAttachments(
    attachments?: Array<{ id?: string; name: string; url: string; size: number; mimeType: string }>
  ): IValidatedAttachment[] {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    if (attachments.length > MAX_FILE_COUNT) {
      throw new AppError(`Maximum of ${MAX_FILE_COUNT} attachments allowed per submission`, 422);
    }

    const validated: IValidatedAttachment[] = [];

    for (const file of attachments) {
      if (!file.name || !file.url) {
        throw new AppError('Invalid attachment metadata: name and url are required', 422);
      }

      // Validate URL scheme: Reject dangerous protocols (javascript:, data:, file:)
      try {
        const parsedUrl = new URL(file.url);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          throw new AppError(`Invalid attachment URL scheme: '${parsedUrl.protocol}'. Only secure HTTPS storage links are permitted.`, 422);
        }
        if (parsedUrl.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
          throw new AppError('Insecure HTTP attachment URLs are prohibited. HTTPS is required.', 422);
        }
      } catch (err: any) {
        if (err instanceof AppError) throw err;
        throw new AppError('Invalid attachment URL format.', 422);
      }

      const ext = path.extname(file.name).toLowerCase();

      // Explicitly reject dangerous executable and script formats
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        throw new AppError(`Forbidden file type detected: '${ext}'. Executable or script files are strictly blocked.`, 422);
      }

      // Check extension allowlist
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        throw new AppError(`Unsupported file extension: '${ext}'. Allowed types: PNG, JPG, WEBP, PDF, DOCX, TXT, CSV.`, 422);
      }

      // Check MIME type allowlist
      const normalizedMime = (file.mimeType || '').toLowerCase().trim();
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        throw new AppError(`Unsupported or unsafe MIME type: '${normalizedMime}'.`, 422);
      }

      // Check file size ceiling
      if (file.size > MAX_FILE_SIZE) {
        throw new AppError(`File '${file.name}' exceeds the maximum allowed size of 10MB`, 422);
      }

      validated.push({
        id: file.id || `att_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        name: path.basename(file.name).slice(0, 255),
        url: file.url,
        size: file.size,
        mimeType: normalizedMime,
      });
    }

    return validated;
  }
}
