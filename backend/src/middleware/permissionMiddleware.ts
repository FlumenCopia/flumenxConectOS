import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { AuditService } from '../services/audit.service';
import { ClientMembership } from '../models/ClientMembership';
import { Role } from '../models/Role';

/**
 * Validates whether the authenticated user possesses the requested permission code.
 * Database-driven roles and permissions are strictly the source of truth.
 */
export const requirePermission = (permissionCode: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Authentication required before permission evaluation.', 401);
      return;
    }

    try {
      let hasPermission = false;

      // 1. For Super Admin, resolve from the database-driven super_admin role
      if (req.user.isSuperAdmin) {
        const superAdminRole = await Role.findOne({ slug: 'super_admin' });
        if (superAdminRole && superAdminRole.permissionCodes.includes(permissionCode)) {
          hasPermission = true;
        }
      }

      // 2. If a specific client workspace is resolved in context
      if (req.resolvedClientId) {
        let membership = req.clientMembership;

        if (!membership) {
          membership = (await ClientMembership.findOne({
            userId: req.user._id,
            clientId: req.resolvedClientId,
            status: 'active',
          }).populate('roleId', 'permissionCodes')) || undefined;
          req.clientMembership = membership;
        }

        if (membership) {
          const role = membership.roleId as any;
          const effectivePermissions = new Set([
            ...(role?.permissionCodes || []),
            ...(membership.customPermissions || []),
          ]);
          hasPermission = effectivePermissions.has(permissionCode);
        }
      } else {
        // 3. Global permission check across any active membership
        const memberships = await ClientMembership.find({
          userId: req.user._id,
          status: 'active',
        }).populate('roleId', 'permissionCodes');

        for (const m of memberships) {
          const role = m.roleId as any;
          if (role?.permissionCodes?.includes(permissionCode) || m.customPermissions?.includes(permissionCode)) {
            hasPermission = true;
            break;
          }
        }
      }

      if (!hasPermission) {
        await AuditService.log({
          userId: req.user._id,
          userEmail: req.user.email,
          clientId: req.resolvedClientId,
          action: 'auth.permission.denied',
          resourceType: 'permission',
          resourceId: permissionCode,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          success: false,
          metadata: { permissionCode, path: req.originalUrl },
        });

        sendError(res, `Access denied: Missing required permission '${permissionCode}'`, 403);
        return;
      }

      next();
    } catch (error: any) {
      sendError(res, `Error validating permissions: ${error.message}`, 500);
    }
  };
};
