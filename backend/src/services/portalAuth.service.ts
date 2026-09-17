import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PortalUser, IPortalUser } from '../models/PortalUser';
import { PortalInvitation } from '../models/PortalInvitation';
import { Client } from '../models/Client';
import { Contact } from '../models/Contact';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import { AuditService } from './audit.service';
import { PortalJwtPayload } from '../middleware/portalAuthMiddleware';

export interface PortalAuthSessionContext {
  token: string;
  user: {
    id: string;
    clientId: string;
    clientName: string;
    contactId: string;
    leadId?: string;
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    status: string;
    communicationPreferences: {
      email: boolean;
      sms: boolean;
      whatsapp: boolean;
      marketing: boolean;
    };
    consentGiven: boolean;
    consentGivenAt?: Date;
    lastLoginAt?: Date;
  };
}

export class PortalAuthService {
  /**
   * Generates a signed JWT for an authenticated portal user.
   * Access token expiry is set to 30 minutes.
   */
  public static generatePortalToken(user: IPortalUser): string {
    const payload: PortalJwtPayload = {
      portalUserId: user._id.toString(),
      clientId: user.clientId.toString(),
      contactId: user.contactId.toString(),
      email: user.email,
      type: 'portal_user',
      tokenVersion: user.tokenVersion || 0,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '30m',
    });
  }

  /**
   * Authenticates a customer portal user.
   */
  public static async login(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<PortalAuthSessionContext> {
    const { email, password, ipAddress, userAgent } = params;
    const normalizedEmail = email.toLowerCase().trim();

    const portalUser = await PortalUser.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!portalUser) {
      await AuditService.log({
        action: 'portal.login.failure',
        resourceType: 'portal_auth',
        userEmail: normalizedEmail,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'User not found' },
      });
      throw new AppError('Invalid email or password', 401);
    }

    if (portalUser.status !== 'active') {
      await AuditService.log({
        clientId: portalUser.clientId.toString(),
        userId: portalUser._id.toString(),
        userEmail: normalizedEmail,
        action: 'portal.login.failure',
        resourceType: 'portal_auth',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: `Account is ${portalUser.status}` },
      });
      throw new AppError('Customer account is suspended or inactive. Please contact support.', 403);
    }

    const isMatch = await portalUser.comparePassword(password);
    if (!isMatch) {
      await AuditService.log({
        clientId: portalUser.clientId.toString(),
        userId: portalUser._id.toString(),
        userEmail: normalizedEmail,
        action: 'portal.login.failure',
        resourceType: 'portal_auth',
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'Password mismatch' },
      });
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    portalUser.lastLoginAt = new Date();
    await portalUser.save();

    const client = await Client.findById(portalUser.clientId);

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: normalizedEmail,
      action: 'portal.login.success',
      resourceType: 'portal_auth',
      ipAddress,
      userAgent,
      success: true,
      metadata: { lastLoginAt: portalUser.lastLoginAt },
    });

    const token = this.generatePortalToken(portalUser);

    return {
      token,
      user: {
        id: portalUser._id.toString(),
        clientId: portalUser.clientId.toString(),
        clientName: client?.name || 'Workspace',
        contactId: portalUser.contactId.toString(),
        leadId: portalUser.leadId?.toString(),
        name: portalUser.name,
        email: portalUser.email,
        phone: portalUser.phone,
        avatarUrl: portalUser.avatarUrl,
        status: portalUser.status,
        communicationPreferences: portalUser.communicationPreferences,
        consentGiven: portalUser.consentGiven,
        consentGivenAt: portalUser.consentGivenAt,
        lastLoginAt: portalUser.lastLoginAt,
      },
    };
  }

  /**
   * Validates invitation token and returns non-sensitive metadata for onboarding.
   */
  public static async getInvitationDetails(rawToken: string): Promise<{
    email: string;
    name: string;
    clientName: string;
    expiresAt: Date;
  }> {
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const invitation = await PortalInvitation.findOne({
      tokenHash,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      throw new AppError('Invalid, expired, or already accepted invitation token.', 404);
    }

    const client = await Client.findById(invitation.clientId);

    return {
      email: invitation.email,
      name: invitation.name,
      clientName: client?.name || 'Customer Portal',
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accepts invitation atomically to prevent race condition double-creation.
   */
  public static async acceptInvitation(params: {
    token: string;
    password: string;
    name?: string;
    phone?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<PortalAuthSessionContext> {
    const { token, password, name, phone, ipAddress, userAgent } = params;
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // Atomic update to claim invitation: exactly one caller will receive the modified document
    const invitation = await PortalInvitation.findOneAndUpdate(
      {
        tokenHash,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!invitation) {
      throw new AppError('Invalid, expired, or already accepted invitation token.', 400);
    }

    // Check unique constraints: no active portal user for the same client+contact or client+email
    const existingUser = await PortalUser.findOne({
      clientId: invitation.clientId,
      $or: [{ contactId: invitation.contactId }, { email: invitation.email.toLowerCase().trim() }],
    });

    if (existingUser) {
      throw new AppError('A customer portal account already exists for this contact or email address.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const finalName = name?.trim() || invitation.name;

    const portalUser = await PortalUser.create({
      clientId: invitation.clientId,
      contactId: invitation.contactId,
      leadId: invitation.leadId,
      name: finalName,
      email: invitation.email.toLowerCase().trim(),
      phone: phone?.trim(),
      passwordHash,
      status: 'active',
      tokenVersion: 0,
      consentGiven: true,
      consentGivenAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Sync name/phone to Contact if missing
    await Contact.updateOne(
      { _id: invitation.contactId, clientId: invitation.clientId },
      {
        $set: {
          name: finalName,
          ...(phone ? { phone: phone.trim() } : {}),
        },
      }
    );

    const client = await Client.findById(invitation.clientId);

    await AuditService.log({
      clientId: invitation.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.invitation.accept',
      resourceType: 'portal_user',
      resourceId: portalUser._id.toString(),
      ipAddress,
      userAgent,
      success: true,
      metadata: { contactId: invitation.contactId.toString() },
    });

    const sessionToken = this.generatePortalToken(portalUser);

    return {
      token: sessionToken,
      user: {
        id: portalUser._id.toString(),
        clientId: portalUser.clientId.toString(),
        clientName: client?.name || 'Workspace',
        contactId: portalUser.contactId.toString(),
        leadId: portalUser.leadId?.toString(),
        name: portalUser.name,
        email: portalUser.email,
        phone: portalUser.phone,
        status: portalUser.status,
        communicationPreferences: portalUser.communicationPreferences,
        consentGiven: portalUser.consentGiven,
        consentGivenAt: portalUser.consentGivenAt,
        lastLoginAt: portalUser.lastLoginAt,
      },
    };
  }

  /**
   * Requests a password reset link without revealing whether the email exists.
   */
  public static async requestPasswordReset(params: {
    email: string;
    clientId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ message: string; previewToken?: string }> {
    const { email, clientId, ipAddress, userAgent } = params;
    const normalizedEmail = email.toLowerCase().trim();

    const query: Record<string, any> = { email: normalizedEmail, status: 'active' };
    if (clientId) query.clientId = clientId;

    const portalUser = await PortalUser.findOne(query);

    let previewToken: string | undefined;

    if (portalUser) {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');

      portalUser.passwordResetTokenHash = resetTokenHash;
      portalUser.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await portalUser.save();

      await AuditService.log({
        clientId: portalUser.clientId.toString(),
        userId: portalUser._id.toString(),
        userEmail: normalizedEmail,
        action: 'portal.password_reset.request',
        resourceType: 'portal_auth',
        ipAddress,
        userAgent,
        success: true,
        metadata: { expiresAt: portalUser.passwordResetExpires },
      });

      if (env.NODE_ENV !== 'production') {
        previewToken = rawResetToken;
      }
    }

    return {
      message: 'If the provided email is registered, password reset instructions have been sent.',
      previewToken,
    };
  }

  /**
   * Resets password using valid token and invalidates all existing active sessions.
   */
  public static async resetPassword(params: {
    token: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ message: string }> {
    const { token, newPassword, ipAddress, userAgent } = params;
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const portalUser = await PortalUser.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
      status: 'active',
    }).select('+passwordResetTokenHash');

    if (!portalUser) {
      throw new AppError('Invalid or expired password reset token.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password, clear reset token, and increment tokenVersion to revoke all active sessions
    await PortalUser.updateOne(
      { _id: portalUser._id },
      {
        $set: { passwordHash },
        $inc: { tokenVersion: 1 },
        $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 },
      }
    );

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.password_reset.complete',
      resourceType: 'portal_auth',
      ipAddress,
      userAgent,
      success: true,
      metadata: { sessionRevoked: true },
    });

    return { message: 'Password has been reset successfully. Please sign in with your new password.' };
  }

  /**
   * Updates customer password while authenticated and rotates token version.
   */
  public static async changePassword(params: {
    portalUserId: string;
    currentPassword: string;
    newPassword: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ token: string; message: string }> {
    const { portalUserId, currentPassword, newPassword, ipAddress, userAgent } = params;

    const portalUser = await PortalUser.findById(portalUserId).select('+passwordHash');
    if (!portalUser) {
      throw new AppError('Customer user not found', 404);
    }

    const isMatch = await portalUser.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Current password is incorrect.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    portalUser.passwordHash = passwordHash;
    portalUser.tokenVersion += 1;
    await portalUser.save();

    await AuditService.log({
      clientId: portalUser.clientId.toString(),
      userId: portalUser._id.toString(),
      userEmail: portalUser.email,
      action: 'portal.password_change',
      resourceType: 'portal_auth',
      ipAddress,
      userAgent,
      success: true,
    });

    const refreshedToken = this.generatePortalToken(portalUser);
    return { token: refreshedToken, message: 'Password updated successfully.' };
  }

  /**
   * Invalidates current user session.
   */
  public static async logout(portalUserId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const portalUser = await PortalUser.findById(portalUserId);
    if (portalUser) {
      // Increment tokenVersion to revoke any remaining token instances
      await PortalUser.updateOne({ _id: portalUser._id }, { $inc: { tokenVersion: 1 } });

      await AuditService.log({
        clientId: portalUser.clientId.toString(),
        userId: portalUser._id.toString(),
        userEmail: portalUser.email,
        action: 'portal.logout',
        resourceType: 'portal_auth',
        ipAddress,
        userAgent,
        success: true,
      });
    }
  }
}
