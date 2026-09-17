import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Client } from '../models/Client';
import { Role } from '../models/Role';
import { ClientMembership } from '../models/ClientMembership';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middleware/errorHandler';

export class AdminUserController {
  /**
   * GET /api/v1/admin/users
   * Lists agency staff and system users with their active workspace assignments and roles
   */
  public static async listStaffUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, role, status } = req.query;

      const userFilter: any = {};
      if (status && status !== 'all') {
        userFilter.status = status;
      }
      if (search && typeof search === 'string') {
        const regex = new RegExp(search.trim(), 'i');
        userFilter.$or = [{ name: regex }, { email: regex }];
      }

      const users = await User.find(userFilter).sort({ createdAt: -1 }).lean();

      // Retrieve all client memberships for these users
      const userIds = users.map((u) => u._id);
      const memberships = await ClientMembership.find({ userId: { $in: userIds } })
        .populate('clientId', 'name slug status')
        .populate('roleId', 'name slug')
        .lean();

      const membershipMap = new Map<string, any[]>();
      for (const m of memberships) {
        const uid = m.userId.toString();
        if (!membershipMap.has(uid)) membershipMap.set(uid, []);
        membershipMap.get(uid)!.push(m);
      }

      const staffList = users.map((u) => {
        const uid = u._id.toString();
        const userMemberships = membershipMap.get(uid) || [];

        let primaryRole = u.isSuperAdmin ? 'super_admin' : 'client_staff';
        let primaryRoleTitle = u.isSuperAdmin ? 'Super Administrator' : 'Staff Specialist';

        if (!u.isSuperAdmin && userMemberships.length > 0) {
          const hasAdmin = userMemberships.some((m) => (m.roleId as any)?.slug === 'client_admin');
          if (hasAdmin) {
            primaryRole = 'client_admin';
            primaryRoleTitle = 'Account Director / Workspace Admin';
          } else {
            const firstRole = (userMemberships[0].roleId as any)?.name;
            if (firstRole) primaryRoleTitle = firstRole;
          }
        }

        const assignedClients = u.isSuperAdmin
          ? ['Global (All Workspaces)']
          : userMemberships
              .map((m) => (m.clientId as any)?.name)
              .filter(Boolean);

        const assignedClientIds = userMemberships
          .map((m) => (m.clientId as any)?._id?.toString())
          .filter(Boolean);

        return {
          id: uid,
          _id: uid,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          avatarUrl: u.avatarUrl || '',
          isSuperAdmin: !!u.isSuperAdmin,
          role: primaryRole,
          roleTitle: primaryRoleTitle,
          assignedClients: assignedClients.length > 0 ? assignedClients : ['Unassigned'],
          assignedClientIds,
          status: u.status,
          lastActiveAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : u.updatedAt.toISOString(),
          joinedAt: u.createdAt.toISOString(),
        };
      });

      // Filter by role if specified
      const filteredStaff =
        role && role !== 'all'
          ? staffList.filter((s) => s.role === role)
          : staffList;

      sendSuccess(res, { users: filteredStaff, total: filteredStaff.length }, 'Staff directory retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/users/managers
   * Convenience endpoint listing eligible account managers for client assignment dropdowns
   */
  public static async listAccountManagers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Find all active users (super admins or active staff)
      const users = await User.find({ status: 'active' }).select('name email avatarUrl isSuperAdmin').lean();

      const managers = users.map((u) => ({
        id: u._id.toString(),
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl || '',
        isSuperAdmin: !!u.isSuperAdmin,
      }));

      sendSuccess(res, { managers }, 'Eligible account managers retrieved');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/users/invite
   * Invites or provisions a new staff user
   */
  public static async inviteStaffUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, role, roleTitle, clientId } = req.body;

      if (!email || !name) {
        const err = new Error('Name and email are required') as AppError;
        err.statusCode = 400;
        throw err;
      }

      const normalizedEmail = email.toLowerCase().trim();
      let user = await User.findOne({ email: normalizedEmail });

      if (user && user.status === 'active' && user.isSuperAdmin && role === 'super_admin') {
        const err = new Error('A Super Admin with this email is already active') as AppError;
        err.statusCode = 409;
        throw err;
      }

      if (!user) {
        const tempPassword = `FlumenX!${Math.random().toString(36).slice(-8)}`;
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        user = await User.create({
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          isSuperAdmin: role === 'super_admin',
          status: 'active',
          mustChangePassword: true,
        });
      } else if (role === 'super_admin') {
        user.isSuperAdmin = true;
        await user.save();
      }

      // If a client workspace was specified, assign membership
      if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
        let targetRole = null;
        if (role) {
          targetRole = await Role.findOne({ slug: role });
        }
        if (!targetRole) {
          targetRole = await Role.findOne({ slug: 'client_staff' });
        }

        if (targetRole) {
          await ClientMembership.findOneAndUpdate(
            { clientId, userId: user._id },
            {
              $set: {
                clientId,
                userId: user._id,
                roleId: targetRole._id,
                status: 'active',
                joinedAt: new Date(),
              },
            },
            { upsert: true }
          );
        }
      }

      sendSuccess(
        res,
        {
          id: user._id.toString(),
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: role || 'client_staff',
          roleTitle: roleTitle || 'Staff Member',
          status: user.status,
          joinedAt: user.createdAt.toISOString(),
        },
        'Staff member invited successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/admin/users/:userId/status
   * Toggles staff member active/suspended state
   */
  public static async updateStaffStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['active', 'suspended'].includes(status)) {
        const err = new Error('Invalid status value') as AppError;
        err.statusCode = 400;
        throw err;
      }

      const user = await User.findById(userId);
      if (!user) {
        const err = new Error('User not found') as AppError;
        err.statusCode = 404;
        throw err;
      }

      // Prevent suspending yourself
      if (req.user && req.user._id.toString() === userId && status === 'suspended') {
        const err = new Error('You cannot suspend your own account') as AppError;
        err.statusCode = 400;
        throw err;
      }

      user.status = status;
      await user.save();

      // Update memberships status as well
      await ClientMembership.updateMany({ userId: user._id }, { $set: { status } });

      sendSuccess(res, { userId, status }, `User status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }
}
