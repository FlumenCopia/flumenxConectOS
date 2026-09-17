import { AuditLog, IAuditLog } from '../models/AuditLog';
import { logger } from '../config/logger';
import { Types } from 'mongoose';

export interface CreateAuditLogParams {
  userId?: Types.ObjectId | string;
  userEmail?: string;
  clientId?: Types.ObjectId | string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Sanitizes metadata to guarantee no passwords, authorization tokens,
   * or confidential secrets can ever be logged.
   */
  private static sanitizeMetadata(metadata: Record<string, any> = {}): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'jwt', 'secret', 'authorization', 'cookie', 'credentials'];
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Safely logs an audit event without blocking or throwing exceptions to the caller.
   */
  public static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      const sanitizedMeta = this.sanitizeMetadata(params.metadata);

      await AuditLog.create({
        userId: params.userId ? new Types.ObjectId(params.userId.toString()) : undefined,
        userEmail: params.userEmail,
        clientId: params.clientId ? new Types.ObjectId(params.clientId.toString()) : undefined,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        success: params.success !== false,
        metadata: sanitizedMeta,
      });
    } catch (err) {
      logger.error('Failed to write audit log entry:', err);
    }
  }
}
