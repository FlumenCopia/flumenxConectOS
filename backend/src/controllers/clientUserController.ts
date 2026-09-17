import { Request, Response, NextFunction } from 'express';
import { ClientUserService } from '../services/clientUser.service';
import { InvitationService } from '../services/invitation.service';
import { sendSuccess } from '../utils/response';

export class ClientUserController {
  /**
   * GET /api/v1/admin/clients/:clientId/users
   */
  public static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await ClientUserService.listClientUsers(req.params.clientId);
      sendSuccess(res, data, 'Client team members retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/clients/:clientId/users/invite
   */
  public static async inviteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await InvitationService.inviteUser(req.params.clientId, req.body, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, data, 'Team invitation sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/users/:userId/role
   */
  public static async updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ClientUserService.updateUserRole(
        req.params.clientId,
        req.params.userId,
        req.body.roleId,
        {
          id: req.user!._id.toString(),
          email: req.user!.email,
          name: req.user!.name,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/users/:userId/status
   */
  public static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ClientUserService.updateUserStatus(
        req.params.clientId,
        req.params.userId,
        req.body.status,
        {
          id: req.user!._id.toString(),
          email: req.user!.email,
          name: req.user!.name,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/clients/:clientId/users/:userId
   */
  public static async removeUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ClientUserService.removeUser(req.params.clientId, req.params.userId, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/invitations/accept
   */
  public static async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await InvitationService.acceptInvitation({
        token: req.body.token,
        password: req.body.password,
        name: req.body.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
