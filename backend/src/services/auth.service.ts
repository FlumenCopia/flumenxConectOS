import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { Client } from '../models/Client';
import { ClientMembership } from '../models/ClientMembership';
import { Permission } from '../models/Permission';
import { Role } from '../models/Role';
import { env } from '../config/env';
import { AuditService } from './audit.service';
import { EmailService } from './email.service';
import { AppError } from '../middleware/errorHandler';

export interface LoginParams {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
}

export interface AuthContext {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    isSuperAdmin: boolean;
    status: string;
    lastLoginAt?: Date;
    mustChangePassword: boolean;
  };
  memberships: Array<{
    id: string;
    clientId: string;
    clientName: string;
    clientSlug: string;
    roleId: string;
    roleName: string;
    roleSlug: string;
    permissions: string[];
  }>;
  permissions: string[];
}

export class AuthService {
  /**
   * Authenticates user credentials, sets session token, and returns user/workspace context.
   */
  public static async login(params: LoginParams): Promise<AuthContext> {
    const { email, password, ipAddress, userAgent } = params;

    // Retrieve user including passwordHash
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

    if (!user) {
      await AuditService.log({
        userEmail: email,
        action: 'auth.login.failed',
        resourceType: 'auth',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'User not found' },
      });

      const err = new Error('Invalid email or password') as AppError;
      err.statusCode = 401;
      throw err;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await AuditService.log({
        userId: user._id,
        userEmail: user.email,
        action: 'auth.login.failed',
        resourceType: 'auth',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'Invalid password' },
      });

      const err = new Error('Invalid email or password') as AppError;
      err.statusCode = 401;
      throw err;
    }

    if (user.status !== 'active') {
      await AuditService.log({
        userId: user._id,
        userEmail: user.email,
        action: 'auth.login.blocked',
        resourceType: 'auth',
        ipAddress,
        userAgent,
        success: false,
        metadata: { status: user.status },
      });

      const err = new Error(`Account is ${user.status}. Please contact your administrator.`) as AppError;
      err.statusCode = 403;
      throw err;
    }

    // Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const tokenPayload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    // Resolve client memberships and permissions
    const { memberships, permissions } = await this.resolveMembershipsAndPermissions(user);

    // Audit successful login
    await AuditService.log({
      userId: user._id,
      userEmail: user.email,
      action: 'auth.login.success',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success: true,
      metadata: { isSuperAdmin: user.isSuperAdmin, membershipCount: memberships.length },
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        mustChangePassword: user.mustChangePassword || false,
      },
      memberships,
      permissions,
    };
  }

  /**
   * Logs out user session and records audit trail.
   */
  public static async logout(params: {
    userId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await AuditService.log({
      userId: params.userId,
      userEmail: params.userEmail,
      action: 'auth.logout',
      resourceType: 'auth',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: true,
    });
  }

  /**
   * Initiates password recovery workflow.
   * Never leaks whether an account with the provided email exists.
   */
  public static async forgotPassword(params: {
    email: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { email, ipAddress, userAgent } = params;
    const genericSuccessMessage =
      'If an account with that email exists, password reset instructions have been dispatched.';

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.status !== 'active') {
      // Return identical generic response to prevent user enumeration attacks
      return { message: genericSuccessMessage };
    }

    // Generate 32-byte cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Hash token with SHA-256 before database storage
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
    await user.save();

    // Dispatch email via safe email service abstraction
    await EmailService.sendPasswordResetEmail({
      to: user.email,
      resetToken: rawToken,
      expiresAt: user.passwordResetExpires,
    });

    await AuditService.log({
      userId: user._id,
      userEmail: user.email,
      action: 'auth.password_reset.requested',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success: true,
    });

    return { message: genericSuccessMessage };
  }

  /**
   * Completes password reset using single-use cryptographically verified token.
   */
  public static async resetPassword(params: {
    token: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { token, password, ipAddress, userAgent } = params;

    // Hash incoming candidate token to look up in database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      await AuditService.log({
        action: 'auth.password_reset.failed',
        resourceType: 'auth',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'Invalid or expired token' },
      });

      const err = new Error('Invalid or expired password reset token.') as AppError;
      err.statusCode = 400;
      throw err;
    }

    // Hash new password using bcryptjs
    user.passwordHash = await bcrypt.hash(password, 10);
    // Single-use token: invalidate token immediately
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.mustChangePassword = false;
    await user.save();

    await AuditService.log({
      userId: user._id,
      userEmail: user.email,
      action: 'auth.password_reset.completed',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success: true,
    });

    return { message: 'Password has been successfully updated. You may now sign in.' };
  }

  /**
   * Changes password for an authenticated user (e.g. required initial admin rotation).
   */
  public static async changePassword(params: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { userId, currentPassword, newPassword, ipAddress, userAgent } = params;

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      const err = new Error('User account not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      await AuditService.log({
        userId: user._id,
        userEmail: user.email,
        action: 'auth.password_change.failed',
        resourceType: 'auth',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'Incorrect current password' },
      });

      const err = new Error('Current password is incorrect.') as AppError;
      err.statusCode = 400;
      throw err;
    }

    if (currentPassword === newPassword) {
      const err = new Error('New password must be different from current password.') as AppError;
      err.statusCode = 400;
      throw err;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    await AuditService.log({
      userId: user._id,
      userEmail: user.email,
      action: 'auth.password_change.completed',
      resourceType: 'auth',
      ipAddress,
      userAgent,
      success: true,
    });

    return { message: 'Password has been changed successfully.' };
  }

  /**
   * Retrieves profile, active memberships, and resolved permissions for current authenticated user.
   */
  public static async getCurrentUser(userId: string): Promise<Omit<AuthContext, 'token'>> {
    const user = await User.findById(userId);

    if (!user || user.status !== 'active') {
      const err = new Error('User account not found or inactive') as AppError;
      err.statusCode = 401;
      throw err;
    }

    const { memberships, permissions } = await this.resolveMembershipsAndPermissions(user);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        isSuperAdmin: user.isSuperAdmin,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        mustChangePassword: user.mustChangePassword || false,
      },
      memberships,
      permissions,
    };
  }

  /**
   * Resolves the user's client memberships, roles, and effective permission set.
   * Database-driven Role documents are strictly the source of truth.
   */
  private static async resolveMembershipsAndPermissions(user: IUser) {
    let permissions: string[] = [];

    // For Super Admin, resolve from database-driven super_admin role and include all active client workspaces
    if (user.isSuperAdmin) {
      const superAdminRole = await Role.findOne({ slug: 'super_admin' });
      permissions = superAdminRole ? [...superAdminRole.permissionCodes] : [];

      const allClients = await Client.find({
        status: 'active',
        isArchived: { $ne: true },
      })
        .select('name slug status health')
        .sort({ name: 1 });

      const memberships = allClients.map((client) => ({
        id: `sa_${client._id}`,
        clientId: client._id.toString(),
        clientName: client.name,
        clientSlug: client.slug,
        roleId: superAdminRole?._id.toString(),
        roleName: 'Super Administrator',
        roleSlug: 'super_admin',
        permissions,
      }));

      return {
        memberships,
        permissions: Array.from(new Set(permissions)),
      };
    }

    // Retrieve active client memberships for regular users
    const membershipDocs = await ClientMembership.find({
      userId: user._id,
      status: 'active',
    })
      .populate('clientId', 'name slug status health')
      .populate('roleId', 'name slug permissionCodes');

    const memberships = membershipDocs
      .filter((m) => m.clientId && (m.clientId as any).status === 'active')
      .map((m) => {
        const client = m.clientId as any;
        const role = m.roleId as any;
        const effectivePerms = Array.from(
          new Set([...(role?.permissionCodes || []), ...(m.customPermissions || [])])
        );

        permissions.push(...effectivePerms);

        return {
          id: m._id.toString(),
          clientId: client._id.toString(),
          clientName: client.name,
          clientSlug: client.slug,
          roleId: role?._id.toString(),
          roleName: role?.name || 'Staff',
          roleSlug: role?.slug || 'client_staff',
          permissions: effectivePerms,
        };
      });

    return {
      memberships,
      permissions: Array.from(new Set(permissions)),
    };
  }
}
