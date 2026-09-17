import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { sendSuccess } from '../utils/response';

export class AuditLogController {
  /**
   * GET /api/v1/admin/audit-logs
   */
  public static async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = {};

      if (req.query.action && req.query.action !== 'all') {
        filter.action = new RegExp(req.query.action as string, 'i');
      }

      if (req.query.clientId && req.query.clientId !== 'all') {
        if (mongoose.Types.ObjectId.isValid(req.query.clientId as string)) {
          filter.clientId = req.query.clientId;
        }
      }

      if (req.query.userId && req.query.userId !== 'all') {
        if (mongoose.Types.ObjectId.isValid(req.query.userId as string)) {
          filter.userId = req.query.userId;
        }
      }

      if (req.query.startDate || req.query.endDate) {
        filter.createdAt = {};
        if (req.query.startDate) {
          filter.createdAt.$gte = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          const end = new Date(req.query.endDate as string);
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .populate('userId', 'name email')
          .populate('clientId', 'name slug')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        AuditLog.countDocuments(filter),
      ]);

      sendSuccess(
        res,
        {
          logs,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        'Audit logs retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}
