import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';
import { JwtPayload } from '../services/auth.service';
import { sendError } from '../utils/response';
import { AuditService } from '../services/audit.service';

/**
 * Ensures request has a valid, non-expired authentication token (from cookie or Bearer header).
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check HTTP-only cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Check Authorization Bearer header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      sendError(res, 'Authentication required. Please sign in.', 401);
      return;
    }

    // Verify JWT with HS256 algorithm enforcement
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;

    // Defense against cross-role token reuse: Reject customer portal tokens on staff endpoints
    if ((decoded as any).type === 'portal_user' || !decoded.userId) {
      sendError(res, 'Invalid staff authentication token.', 401);
      return;
    }

    // Verify user exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      sendError(res, 'Session is invalid or user is suspended.', 401);
      return;
    }

    // Attach user and decoded payload to request
    req.user = user;
    req.auth = decoded;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      sendError(res, 'Session expired. Please sign in again.', 401);
      return;
    }
    sendError(res, 'Invalid authentication token.', 401);
  }
};

/**
 * Restricts route strictly to FlumenX Super Administrators.
 */
export const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || !req.user.isSuperAdmin) {
    await AuditService.log({
      userId: req.user?._id,
      userEmail: req.user?.email,
      action: 'auth.super_admin.denied',
      resourceType: 'system',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      metadata: { attemptedPath: req.originalUrl },
    });

    sendError(res, 'Access denied: Super Administrator privilege required.', 403);
    return;
  }

  // Database-driven role verification: confirm super_admin role exists in DB
  const { Role } = await import('../models/Role');
  const superAdminRole = await Role.findOne({ slug: 'super_admin' });
  if (!superAdminRole) {
    sendError(res, 'Access denied: System role super_admin is not configured.', 403);
    return;
  }

  next();
};
