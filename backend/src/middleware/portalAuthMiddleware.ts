import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { PortalUser, IPortalUser } from '../models/PortalUser';
import { sendError } from '../utils/response';
import { Types } from 'mongoose';

export interface PortalJwtPayload {
  portalUserId: string;
  clientId: string;
  contactId: string;
  email: string;
  type: 'portal_user';
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      portalUser?: IPortalUser;
      portalClientId?: Types.ObjectId;
      isPortalAuth?: boolean;
    }
  }
}

/**
 * Middleware ensuring request is authenticated as an active customer portal user.
 */
export const requirePortalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check HTTP-only cookie
    if (req.cookies && req.cookies.portal_token) {
      token = req.cookies.portal_token;
    }
    // 2. Check Authorization Bearer header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      sendError(res, 'Authentication required. Please sign in to customer portal.', 401);
      return;
    }

    // Explicitly enforce HS256 algorithm to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as PortalJwtPayload;

    // Enforce role separation: Staff JWTs cannot be used for portal authentication
    if (decoded.type !== 'portal_user' || !decoded.portalUserId) {
      sendError(res, 'Invalid customer portal authentication token.', 401);
      return;
    }

    // Load active portal user
    const portalUser = await PortalUser.findById(decoded.portalUserId);
    if (!portalUser || portalUser.status !== 'active') {
      sendError(res, 'Session is invalid or customer account is suspended.', 401);
      return;
    }

    // Session Version Invalidation: Check tokenVersion
    if (
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== portalUser.tokenVersion
    ) {
      sendError(res, 'Session has expired or was revoked. Please sign in again.', 401);
      return;
    }

    // Verify tenant match
    if (portalUser.clientId.toString() !== decoded.clientId) {
      sendError(res, 'Workspace boundary mismatch.', 403);
      return;
    }

    // Attach to request
    req.portalUser = portalUser;
    req.portalClientId = portalUser.clientId;
    req.isPortalAuth = true;

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
 * CSRF Protection for state-changing portal requests authenticated via cookies.
 * Requests using Authorization Bearer tokens are exempt because browsers do not
 * automatically attach Authorization headers in cross-site requests.
 */
export const requirePortalCsrf = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // If authenticated strictly via Authorization Bearer header without cookies, CSRF does not apply
  const hasBearerHeader = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  const hasPortalCookie = !!req.cookies?.portal_token;

  if (hasBearerHeader && !hasPortalCookie) {
    return next();
  }

  // Double-submit cookie verification:
  const cookieCsrf = req.cookies?.portal_csrf;
  const headerCsrf = req.headers['x-portal-csrf'] as string | undefined;

  if (!headerCsrf) {
    sendError(res, 'CSRF validation failed: Missing required x-portal-csrf header.', 403);
    return;
  }

  if (!cookieCsrf || headerCsrf !== cookieCsrf) {
    sendError(res, 'CSRF validation failed: Invalid security token.', 403);
    return;
  }

  next();
};
