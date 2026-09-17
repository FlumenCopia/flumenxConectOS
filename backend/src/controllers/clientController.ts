import { Request, Response, NextFunction } from 'express';
import { ClientService } from '../services/client.service';
import { sendSuccess } from '../utils/response';

export class ClientController {
  /**
   * GET /api/v1/admin/clients
   */
  public static async listClients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page,
        limit,
        search,
        status,
        health,
        managerId,
        sortBy,
        sortOrder,
        includeArchived,
      } = req.query;

      const result = await ClientService.listClients({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        search: search as string,
        status: status as string,
        health: health as string,
        managerId: managerId as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        includeArchived: includeArchived === 'true',
      });

      sendSuccess(res, result, 'Clients retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/clients
   */
  public static async createClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.createClient(req.body, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, client, 'Client workspace provisioned successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/clients/:clientId
   */
  public static async getClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.getClientById(req.params.clientId);
      sendSuccess(res, client, 'Client details retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/clients/:clientId
   */
  public static async updateClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.updateClient(req.params.clientId, req.body, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, client, 'Client profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/status
   */
  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, reason } = req.body;
      const client = await ClientService.updateStatus(req.params.clientId, status, reason, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, client, `Client status changed to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/health
   */
  public static async updateHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { health, notes } = req.body;
      const client = await ClientService.updateHealth(req.params.clientId, health, notes, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, client, `Client health updated to ${health}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/managers
   */
  public static async updateManagers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.updateManagers(req.params.clientId, req.body, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, client, 'Account managers updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/clients/:clientId
   */
  public static async archiveClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.archiveClient(req.params.clientId, {
        id: req.user!._id.toString(),
        email: req.user!.email,
        name: req.user!.name,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      sendSuccess(res, client, 'Client workspace archived successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/clients/:clientId/onboarding
   */
  public static async getOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.getClientById(req.params.clientId);
      sendSuccess(
        res,
        {
          onboardingStatus: client.onboardingStatus,
          onboardingProgress: client.onboardingProgress,
          checklist: client.onboardingChecklist,
        },
        'Onboarding checklist retrieved'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/clients/:clientId/onboarding/:itemId
   */
  public static async updateOnboardingItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await ClientService.updateOnboardingItem(
        req.params.clientId,
        req.params.itemId,
        req.body,
        {
          id: req.user!._id.toString(),
          email: req.user!.email,
          name: req.user!.name,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      sendSuccess(
        res,
        {
          onboardingStatus: client.onboardingStatus,
          onboardingProgress: client.onboardingProgress,
          checklist: client.onboardingChecklist,
        },
        'Onboarding item updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/clients/:clientId/activity
   */
  public static async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await ClientService.getClientActivity(req.params.clientId, page, limit);
      sendSuccess(res, result, 'Client activity retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
