import { Request, Response, NextFunction } from 'express';
import { ClientSettingsService } from '../services/clientSettings.service';
import { ClientUserService } from '../services/clientUser.service';
import { InvitationService } from '../services/invitation.service';
import { sendSuccess } from '../utils/response';
import { env } from '../config/env';

export class ClientSettingsController {
  /**
   * GET /api/v1/client/workspace/current
   */
  public static async getCurrentWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.resolvedClientId!;
      const workspace = await ClientSettingsService.getWorkspace(clientId);
      sendSuccess(res, workspace, 'Workspace details retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/client/workspace/settings
   */
  public static async updateWorkspaceSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.resolvedClientId!;
      const updated = await ClientSettingsService.updateWorkspaceSettings(clientId, req.body, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, updated, 'Workspace settings updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/client/workspace/team
   */
  public static async getWorkspaceTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.resolvedClientId!;
      const data = await ClientUserService.listClientUsers(clientId);
      sendSuccess(res, data, 'Workspace team members retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/client/workspace/team/invite
   */
  public static async inviteWorkspaceTeamMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clientId = req.resolvedClientId!;
      const data = await InvitationService.inviteUser(clientId, req.body, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, data, 'Team invitation dispatched', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/client/workspace/switch
   */
  public static async switchWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetClientId } = req.body;
      const result = await ClientSettingsService.switchWorkspace({
        userId: req.user!._id.toString(),
        targetClientId,
        isSuperAdmin: req.user!.isSuperAdmin,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Update session cookie with newly generated token
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      sendSuccess(res, result, `Switched active workspace to ${result.client.name}`);
    } catch (error) {
      next(error);
    }
  }
}
