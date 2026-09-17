import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { Client } from '../models/Client';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { ClientMembership } from '../models/ClientMembership';
import { ClientInvitation } from '../models/ClientInvitation';
import { ClientActivity } from '../models/ClientActivity';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';
import { AppError } from '../middleware/errorHandler';

export class InvitationService {
  /**
   * Generates a single-use, cryptographically secure invitation token and dispatches invite.
   */
  public static async inviteUser(
    clientId: string,
    data: { email: string; roleId: string; name?: string },
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ) {
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      const err = new Error('Invalid client ID format') as AppError;
      err.statusCode = 400;
      throw err;
    }

    const client = await Client.findById(clientId);
    if (!client || client.isArchived) {
      const err = new Error('Client workspace not found or is archived') as AppError;
      err.statusCode = 404;
      throw err;
    }

    let role = null;
    if (mongoose.Types.ObjectId.isValid(data.roleId)) {
      role = await Role.findById(data.roleId);
    }
    if (!role) {
      role = await Role.findOne({ slug: data.roleId });
    }
    if (!role) {
      const err = new Error('Selected role does not exist') as AppError;
      err.statusCode = 400;
      throw err;
    }

    // Role safety: prevent inviting as super_admin into a client workspace
    if (role.slug === 'super_admin') {
      const err = new Error('Cannot assign Super Admin role within a client workspace') as AppError;
      err.statusCode = 403;
      throw err;
    }

    const normalizedEmail = data.email.toLowerCase().trim();

    // Check if user already has an active membership in this client
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const existingMembership = await ClientMembership.findOne({
        clientId: client._id,
        userId: existingUser._id,
      });

      if (existingMembership && existingMembership.status === 'active') {
        const err = new Error('This user is already an active member of this client workspace.') as AppError;
        err.statusCode = 409;
        throw err;
      }
    }

    // Revoke any previous pending invitations for this email in this client
    await ClientInvitation.updateMany(
      { clientId: client._id, email: normalizedEmail, status: 'pending' },
      { $set: { status: 'revoked' } }
    );

    // Generate 32-byte cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await ClientInvitation.create({
      clientId: client._id,
      email: normalizedEmail,
      roleId: role._id,
      tokenHash,
      invitedBy: actor.id,
      status: 'pending',
      expiresAt,
    });

    // Send email via safe email service
    await EmailService.sendClientInvitationEmail({
      to: normalizedEmail,
      clientName: client.name,
      roleName: role.name,
      inviteToken: rawToken,
      expiresAt,
    });

    // Record Client Activity
    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.user_invited',
      title: `Invited "${normalizedEmail}" as ${role.name}`,
      details: { email: normalizedEmail, roleId: role._id.toString(), roleName: role.name },
      ipAddress: actor.ip,
    });

    // Audit Log
    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.user.invited',
      resourceType: 'client_invitation',
      resourceId: invitation._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { email: normalizedEmail, roleName: role.name },
    });

    return {
      id: invitation._id.toString(),
      email: invitation.email,
      roleId: invitation.roleId.toString(),
      roleName: role.name,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      // Provide raw token only for testing / local verification
      _testToken: rawToken,
    };
  }

  /**
   * Validates and accepts invitation, setting user credentials and creating membership.
   */
  public static async acceptInvitation(params: {
    token: string;
    password: string;
    name?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const { token, password, name, ip, userAgent } = params;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await ClientInvitation.findOne({
      tokenHash,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('clientId', 'name slug status')
      .populate('roleId', 'name slug permissionCodes');

    if (!invitation) {
      const err = new Error('Invalid or expired invitation token.') as AppError;
      err.statusCode = 400;
      throw err;
    }

    const client = invitation.clientId as any;
    const role = invitation.roleId as any;

    if (!client || client.status === 'archived') {
      const err = new Error('The client workspace associated with this invitation is no longer active.') as AppError;
      err.statusCode = 400;
      throw err;
    }

    // Find or create User
    let user = await User.findOne({ email: invitation.email });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        name: name || invitation.email.split('@')[0],
        email: invitation.email,
        passwordHash,
        status: 'active',
        mustChangePassword: false,
      });
    }

    // Create or activate ClientMembership
    const membership = await ClientMembership.findOneAndUpdate(
      { clientId: client._id, userId: user._id },
      {
        $set: {
          clientId: client._id,
          userId: user._id,
          roleId: role._id,
          status: 'active',
          joinedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // Single-use token: invalidate invitation
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    // Record Client Activity
    await ClientActivity.create({
      clientId: client._id,
      userId: user._id,
      userEmail: user.email,
      userName: user.name,
      action: 'client.invitation_accepted',
      title: `User "${user.email}" accepted workspace invitation`,
      details: { roleName: role.name },
      ipAddress: ip,
    });

    // Record Audit Log
    await AuditService.log({
      userId: user._id.toString(),
      userEmail: user.email,
      clientId: client._id.toString(),
      action: 'client.invitation.accepted',
      resourceType: 'client_membership',
      resourceId: membership._id.toString(),
      ipAddress: ip,
      userAgent,
      success: true,
      metadata: { clientSlug: client.slug, role: role.slug },
    });

    return {
      message: `Successfully joined ${client.name} workspace.`,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      client: {
        id: client._id.toString(),
        name: client.name,
        slug: client.slug,
      },
    };
  }
}
