import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { ClientActivity } from '../models/ClientActivity';
import { User } from '../models/User';
import { env } from '../config/env';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/errorHandler';

export class ClientSettingsService {
  /**
   * Retrieves active workspace details for a client user.
   */
  public static async getWorkspace(clientId: string) {
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      const err = new Error('Invalid client ID format') as AppError;
      err.statusCode = 400;
      throw err;
    }

    const client = await Client.findById(clientId).select(
      'name slug legalName email phone website industry address city state country timezone currency logoUrl brandColor settings onboardingProgress onboardingStatus'
    );

    if (!client || client.isArchived) {
      const err = new Error('Client workspace not found or archived') as AppError;
      err.statusCode = 404;
      throw err;
    }

    return client;
  }

  /**
   * Updates workspace settings and approved branding details.
   */
  public static async updateWorkspaceSettings(
    clientId: string,
    data: Record<string, any>,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ) {
    const client = await Client.findById(clientId);
    if (!client || client.isArchived) {
      const err = new Error('Client workspace not found or archived') as AppError;
      err.statusCode = 404;
      throw err;
    }

    if (data.brandPrimaryColor) {
      client.brandColor = data.brandPrimaryColor;
      client.settings.brandPrimaryColor = data.brandPrimaryColor;
    }

    if (data.leadResponseThresholdMinutes !== undefined) {
      client.settings.leadResponseThresholdMinutes = data.leadResponseThresholdMinutes;
    }

    if (data.notificationEmails !== undefined) {
      client.settings.notificationEmails = data.notificationEmails;
    }

    if (data.allowClientUserInvites !== undefined) {
      client.settings.allowClientUserInvites = data.allowClientUserInvites;
    }

    // Approved business profile updates
    const businessFields = ['legalName', 'phone', 'website', 'timezone', 'currency'];
    for (const field of businessFields) {
      if (data[field] !== undefined) {
        (client as any)[field] = data[field];
      }
    }

    await client.save();

    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.settings_updated',
      title: `Workspace settings and branding updated`,
      details: { updatedKeys: Object.keys(data) },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.settings.updated',
      resourceType: 'client_settings',
      resourceId: client._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { fields: Object.keys(data) },
    });

    return client;
  }

  /**
   * Switches workspace context after rigorously validating that the user possesses active membership.
   */
  public static async switchWorkspace(params: {
    userId: string;
    targetClientId: string;
    isSuperAdmin: boolean;
    ip?: string;
    userAgent?: string;
  }) {
    const { userId, targetClientId, isSuperAdmin, ip, userAgent } = params;

    if (!mongoose.Types.ObjectId.isValid(targetClientId)) {
      const err = new Error('Invalid client ID format') as AppError;
      err.statusCode = 400;
      throw err;
    }

    const client = await Client.findById(targetClientId);
    if (!client || client.isArchived) {
      const err = new Error('Target client workspace is not found or is archived') as AppError;
      err.statusCode = 404;
      throw err;
    }

    let roleName = 'Super Administrator';
    let roleSlug = 'super_admin';
    let permissions: string[] = [];

    if (!isSuperAdmin) {
      const membership = await ClientMembership.findOne({
        userId,
        clientId: targetClientId,
        status: 'active',
      }).populate('roleId', 'name slug permissionCodes');

      if (!membership) {
        await AuditService.log({
          userId,
          clientId: targetClientId,
          action: 'auth.workspace_switch.denied',
          resourceType: 'client',
          resourceId: targetClientId,
          ipAddress: ip,
          userAgent,
          success: false,
          metadata: { reason: 'No active membership in target client' },
        });

        const err = new Error('Access denied: You do not have an active membership in this workspace.') as AppError;
        err.statusCode = 403;
        throw err;
      }

      const role = membership.roleId as any;
      roleName = role?.name || 'Staff';
      roleSlug = role?.slug || 'client_staff';
      permissions = role?.permissionCodes || [];
    }

    // Generate refreshed JWT token
    const token = jwt.sign(
      {
        userId,
        email: (await User.findById(userId))?.email,
        isSuperAdmin,
        activeClientId: targetClientId,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    await AuditService.log({
      userId,
      clientId: targetClientId,
      action: 'auth.workspace_switch.success',
      resourceType: 'client',
      resourceId: targetClientId,
      ipAddress: ip,
      userAgent,
      success: true,
      metadata: { targetClientName: client.name, role: roleSlug },
    });

    return {
      token,
      client: {
        id: client._id.toString(),
        name: client.name,
        slug: client.slug,
        roleName,
        roleSlug,
        permissions,
      },
    };
  }
}
