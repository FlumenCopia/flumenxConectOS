import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { PortalAuthService } from '../services/portalAuth.service';
import { sendSuccess, sendError } from '../utils/response';
import { env } from '../config/env';

export class PortalAuthController {
  /**
   * POST /api/v1/portal/auth/login
   */
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await PortalAuthService.login({
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const csrfToken = crypto.randomBytes(32).toString('hex');

      // Set secure HTTP-only cookie for customer portal
      res.cookie('portal_token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 30 * 60 * 1000, // 30 minutes
        path: '/',
      });

      res.cookie('portal_csrf', csrfToken, {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 30 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, { ...result, csrfToken }, 'Customer portal sign in successful');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portal/auth/invitation/:token
   */
  public static async getInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const details = await PortalAuthService.getInvitationDetails(req.params.token);
      sendSuccess(res, details, 'Invitation details verified');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portal/auth/accept-invitation
   */
  public static async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password, name, phone } = req.body;
      const result = await PortalAuthService.acceptInvitation({
        token,
        password,
        name,
        phone,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const csrfToken = crypto.randomBytes(32).toString('hex');

      res.cookie('portal_token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 30 * 60 * 1000,
        path: '/',
      });

      res.cookie('portal_csrf', csrfToken, {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 30 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, { ...result, csrfToken }, 'Portal account created and signed in successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portal/auth/forgot-password
   */
  public static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, clientId } = req.body;
      const result = await PortalAuthService.requestPasswordReset({
        email,
        clientId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, { message: result.message }, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portal/auth/reset-password
   */
  public static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;
      const result = await PortalAuthService.resetPassword({
        token,
        newPassword,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Clear existing cookie if any
      res.clearCookie('portal_token', { path: '/' });

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portal/auth/change-password
   */
  public static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.portalUser) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      const { currentPassword, newPassword } = req.body;
      const result = await PortalAuthService.changePassword({
        portalUserId: req.portalUser._id.toString(),
        currentPassword,
        newPassword,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const csrfToken = crypto.randomBytes(32).toString('hex');

      // Update auth cookie with refreshed session
      res.cookie('portal_token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 30 * 60 * 1000,
        path: '/',
      });

      res.cookie('portal_csrf', csrfToken, {
        httpOnly: false,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 30 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, { message: result.message, csrfToken }, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portal/auth/me
   */
  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.portalUser) {
        sendError(res, 'Authentication required', 401);
        return;
      }
      sendSuccess(
        res,
        {
          user: {
            id: req.portalUser._id.toString(),
            clientId: req.portalUser.clientId.toString(),
            contactId: req.portalUser.contactId.toString(),
            leadId: req.portalUser.leadId?.toString(),
            name: req.portalUser.name,
            email: req.portalUser.email,
            phone: req.portalUser.phone,
            status: req.portalUser.status,
            communicationPreferences: req.portalUser.communicationPreferences,
            consentGiven: req.portalUser.consentGiven,
            consentGivenAt: req.portalUser.consentGivenAt,
            lastLoginAt: req.portalUser.lastLoginAt,
          },
        },
        'Current customer profile retrieved'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portal/auth/logout
   */
  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.portalUser) {
        await PortalAuthService.logout(req.portalUser._id.toString(), req.ip, req.headers['user-agent']);
      }
      res.clearCookie('portal_token', { path: '/' });
      sendSuccess(res, { success: true }, 'Successfully signed out of customer portal');
    } catch (error) {
      next(error);
    }
  }
}
