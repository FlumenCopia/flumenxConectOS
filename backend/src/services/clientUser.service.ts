import mongoose, { Types } from 'mongoose';
import { Client } from '../models/Client';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { ClientMembership } from '../models/ClientMembership';
import { ClientInvitation } from '../models/ClientInvitation';
import { ClientActivity } from '../models/ClientActivity';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/errorHandler';

export class ClientUserService {
  /**
   * Lists all members and pending invitations for a client workspace.
   */
  public static async listClientUsers(clientId: string) {
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      const err = new Error('Invalid client ID format') as AppError;
      err.statusCode = 400;
      throw err;
    }

    const [memberships, invitations] = await Promise.all([
      ClientMembership.find({ clientId })
        .populate('userId', 'name email phone avatarUrl status lastLoginAt')
        .populate('roleId', 'name slug permissionCodes')
        .sort({ createdAt: -1 }),
      ClientInvitation.find({ clientId, status: 'pending' })
        .populate('roleId', 'name slug')
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 }),
    ]);

    const formattedMembers = memberships.map((m) => {
      const user = m.userId as any;
      const role = m.roleId as any;
      return {
        id: m._id.toString(),
        userId: user?._id?.toString(),
        name: user?.name || 'Unknown',
        email: user?.email || '',
        phone: user?.phone,
        avatarUrl: user?.avatarUrl,
        userStatus: user?.status || 'inactive',
        membershipStatus: m.status,
        roleId: role?._id?.toString(),
        roleName: role?.name || 'Staff',
        roleSlug: role?.slug || 'client_staff',
        permissions: role?.permissionCodes || [],
        joinedAt: m.joinedAt,
      };
    });

    const formattedInvitations = invitations.map((inv) => {
      const role = inv.roleId as any;
      const inviter = inv.invitedBy as any;
      return {
        id: inv._id.toString(),
        email: inv.email,
        roleId: role?._id?.toString(),
        roleName: role?.name || 'Staff',
        invitedBy: inviter?.name || inviter?.email || 'Admin',
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      };
    });

    return {
      members: formattedMembers,
      invitations: formattedInvitations,
    };
  }

  /**
   * Updates a user's role within a client workspace.
   */
  public static async updateUserRole(
    clientId: string,
    userId: string,
    roleId: string,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ) {
    let role = null;
    if (mongoose.Types.ObjectId.isValid(roleId)) {
      role = await Role.findById(roleId);
    }
    if (!role) {
      role = await Role.findOne({ slug: roleId });
    }
    if (!role) {
      const err = new Error('Role not found') as AppError;
      err.statusCode = 400;
      throw err;
    }

    if (role.slug === 'super_admin') {
      const err = new Error('Cannot assign Super Admin role inside client workspace') as AppError;
      err.statusCode = 403;
      throw err;
    }

    const membership = await ClientMembership.findOne({ clientId, userId }).populate('userId', 'email name');
    if (!membership) {
      const err = new Error('User membership not found in this client workspace') as AppError;
      err.statusCode = 404;
      throw err;
    }

    membership.roleId = role._id;
    await membership.save();

    const user = membership.userId as any;

    await ClientActivity.create({
      clientId: new Types.ObjectId(clientId),
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.user_role_changed',
      title: `Changed role for "${user?.email}" to "${role.name}"`,
      details: { userId, roleId: role._id.toString(), roleName: role.name },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId,
      action: 'client.user.role_updated',
      resourceType: 'client_membership',
      resourceId: membership._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { targetUserId: userId, targetUserEmail: user?.email, newRole: role.slug },
    });

    return {
      message: `User role updated to ${role.name}.`,
      membershipId: membership._id.toString(),
      roleName: role.name,
    };
  }

  /**
   * Updates user membership status (active, suspended).
   */
  public static async updateUserStatus(
    clientId: string,
    userId: string,
    status: 'active' | 'suspended' | 'inactive',
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ) {
    const membership = await ClientMembership.findOne({ clientId, userId }).populate('userId', 'email name');
    if (!membership) {
      const err = new Error('User membership not found in this client workspace') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const prevStatus = membership.status;
    membership.status = status as any;
    await membership.save();

    const user = membership.userId as any;

    await ClientActivity.create({
      clientId: new Types.ObjectId(clientId),
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.user_status_changed',
      title: `User "${user?.email}" membership status changed to "${status}"`,
      details: { userId, previousStatus: prevStatus, newStatus: status },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId,
      action: 'client.user.status_updated',
      resourceType: 'client_membership',
      resourceId: membership._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { targetUserId: userId, previousStatus: prevStatus, newStatus: status },
    });

    return {
      message: `User membership status updated to ${status}.`,
      membershipId: membership._id.toString(),
      status,
    };
  }

  /**
   * Removes a user from a client workspace.
   */
  public static async removeUser(
    clientId: string,
    userId: string,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ) {
    const membership = await ClientMembership.findOne({ clientId, userId }).populate('userId', 'email name');
    if (!membership) {
      const err = new Error('User membership not found in this client workspace') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const user = membership.userId as any;

    // Delete membership record
    await ClientMembership.deleteOne({ _id: membership._id });

    await ClientActivity.create({
      clientId: new Types.ObjectId(clientId),
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.user_removed',
      title: `Removed "${user?.email}" from client workspace`,
      details: { userId, userEmail: user?.email },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId,
      action: 'client.user.removed',
      resourceType: 'client_membership',
      resourceId: membership._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { targetUserId: userId, userEmail: user?.email },
    });

    return {
      message: `User removed from client workspace.`,
    };
  }
}
