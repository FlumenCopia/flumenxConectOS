import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { ClientMembership } from '../models/ClientMembership';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class RoleController {
  /**
   * GET /api/v1/admin/roles
   * Lists all system and custom roles with associated user counts
   */
  public static async listRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await Role.find().sort({ isSystem: -1, createdAt: 1 }).lean();

      // Aggregate counts
      const rolesWithCounts = await Promise.all(
        roles.map(async (role) => {
          let userCount = 0;
          if (role.slug === 'super_admin') {
            userCount = await User.countDocuments({ isSuperAdmin: true });
          } else {
            userCount = await ClientMembership.countDocuments({ roleId: role._id, status: 'active' });
          }

          return {
            id: role._id.toString(),
            _id: role._id.toString(),
            name: role.name,
            slug: role.slug,
            description: role.description || '',
            isSystem: role.isSystem,
            permissionCodes: role.permissionCodes || [],
            permissions: role.permissionCodes || [],
            userCount,
            createdAt: role.createdAt,
            updatedAt: role.updatedAt,
          };
        })
      );

      sendSuccess(res, { roles: rolesWithCounts }, 'Roles retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/roles
   * Creates a custom RBAC role
   */
  public static async createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, slug, description, permissionCodes } = req.body;

      if (!name || !slug) {
        const err = new Error('Role name and slug are required') as AppError;
        err.statusCode = 400;
        throw err;
      }

      const normalizedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
      const existing = await Role.findOne({ slug: normalizedSlug });
      if (existing) {
        const err = new Error(`Role with slug "${normalizedSlug}" already exists`) as AppError;
        err.statusCode = 409;
        throw err;
      }

      const role = await Role.create({
        name: name.trim(),
        slug: normalizedSlug,
        description: description?.trim() || '',
        isSystem: false,
        permissionCodes: Array.isArray(permissionCodes) ? permissionCodes : [],
      });

      sendSuccess(
        res,
        {
          id: role._id.toString(),
          _id: role._id.toString(),
          name: role.name,
          slug: role.slug,
          description: role.description,
          isSystem: false,
          permissionCodes: role.permissionCodes,
          permissions: role.permissionCodes,
          userCount: 0,
        },
        'Custom role created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/roles/:roleId
   * Updates an existing role's permissions, name, or description
   */
  public static async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;
      const { name, description, permissionCodes } = req.body;

      const role = await Role.findById(roleId);
      if (!role) {
        const err = new Error('Role not found') as AppError;
        err.statusCode = 404;
        throw err;
      }

      if (name && !role.isSystem) {
        role.name = name.trim();
      }
      if (description !== undefined) {
        role.description = description.trim();
      }
      if (Array.isArray(permissionCodes)) {
        role.permissionCodes = permissionCodes;
      }

      await role.save();

      sendSuccess(
        res,
        {
          id: role._id.toString(),
          _id: role._id.toString(),
          name: role.name,
          slug: role.slug,
          description: role.description,
          isSystem: role.isSystem,
          permissionCodes: role.permissionCodes,
          permissions: role.permissionCodes,
        },
        'Role updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/roles/:roleId
   * Deletes a custom role (safeguarding system roles)
   */
  public static async deleteRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { roleId } = req.params;
      const role = await Role.findById(roleId);
      if (!role) {
        const err = new Error('Role not found') as AppError;
        err.statusCode = 404;
        throw err;
      }

      if (role.isSystem) {
        const err = new Error('System roles cannot be deleted') as AppError;
        err.statusCode = 403;
        throw err;
      }

      const inUse = await ClientMembership.countDocuments({ roleId: role._id });
      if (inUse > 0) {
        const err = new Error(`Cannot delete role: ${inUse} member(s) are currently assigned to this role`) as AppError;
        err.statusCode = 409;
        throw err;
      }

      await Role.findByIdAndDelete(roleId);
      sendSuccess(res, { deleted: true }, 'Role deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
