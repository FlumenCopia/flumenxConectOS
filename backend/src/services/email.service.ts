import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface PasswordResetEmailOptions {
  to: string;
  resetToken: string;
  expiresAt: Date;
}

export interface ClientInvitationEmailOptions {
  to: string;
  clientName: string;
  roleName: string;
  inviteToken: string;
  expiresAt: Date;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Initializes or returns the cached nodemailer SMTP transport if configured.
   */
  private static getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      return null;
    }

    const port = env.SMTP_PORT || 465;
    const secure = env.SMTP_SECURE !== undefined ? env.SMTP_SECURE : port === 465;

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    return this.transporter;
  }

  /**
   * Verify SMTP credentials and connection.
   */
  public static async verifyConnection(): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.warn('[EmailService] SMTP not configured in environment.');
      return false;
    }

    try {
      await transporter.verify();
      logger.info('[EmailService] SMTP connection verified successfully.');
      return true;
    } catch (error) {
      logger.error('[EmailService] SMTP connection verification failed:', error);
      return false;
    }
  }

  /**
   * Dispatches password reset email with secure token link.
   */
  public static async sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
    const { to, resetToken, expiresAt } = options;
    const appUrl = (env.APP_URL || env.CORS_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(to)}`;
    const fromAddress = env.SMTP_FROM || `"FlumenX ConectOS" <${env.SMTP_USER || 'noreply@flumenx.in'}>`;

    const transporter = this.getTransporter();

    if (transporter) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to,
          subject: 'Reset Your Password — FlumenX ConectOS',
          text: `You recently requested to reset your password for FlumenX ConectOS.\n\nPlease click the link below to set a new password:\n${resetUrl}\n\nThis link is valid until ${expiresAt.toLocaleString()}.\nIf you did not request this, please ignore this email.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 8px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #0f172a; font-size: 24px; margin: 0; font-weight: 700;">FlumenX ConectOS</h1>
                <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Digital Marketing Operations Platform</p>
              </div>
              <div style="background-color: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h2 style="color: #1e293b; font-size: 18px; margin-top: 0; font-weight: 600;">Password Reset Request</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  We received a request to reset the password associated with your account (<strong>${to}</strong>).
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                    Reset Password
                  </a>
                </div>
                <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
                  Or copy and paste this link into your browser:<br/>
                  <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
                  This link expires on <strong>${expiresAt.toLocaleString()}</strong>. If you did not make this request, you can safely disregard this email.
                </p>
              </div>
            </div>
          `,
        });
        logger.info(`[EmailService] Password reset dispatched via SMTP to ${to}`);
      } catch (err) {
        logger.error(`[EmailService] Failed to send password reset to ${to}:`, err);
        // Do not throw to avoid exposing mail provider failures to end users
      }
    } else {
      logger.info(
        `[EmailService:DEV] SMTP not configured. Password reset link generated for ${to}: ${resetUrl} (valid until ${expiresAt.toISOString()})`
      );
    }
  }

  /**
   * Dispatches client team invitation email with secure one-time acceptance link.
   */
  public static async sendClientInvitationEmail(options: ClientInvitationEmailOptions): Promise<void> {
    const { to, clientName, roleName, inviteToken, expiresAt } = options;
    const appUrl = (env.APP_URL || env.CORS_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    const inviteUrl = `${appUrl}/invite/accept?token=${encodeURIComponent(inviteToken)}`;
    const fromAddress = env.SMTP_FROM || `"FlumenX ConectOS" <${env.SMTP_USER || 'noreply@flumenx.in'}>`;

    const transporter = this.getTransporter();

    if (transporter) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to,
          subject: `You have been invited to join ${clientName} on FlumenX ConectOS`,
          text: `You have been invited to join ${clientName} as a ${roleName}.\n\nClick the link below to accept your invitation:\n${inviteUrl}\n\nThis invitation is valid until ${expiresAt.toLocaleString()}.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 8px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #0f172a; font-size: 24px; margin: 0; font-weight: 700;">FlumenX ConectOS</h1>
                <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Workspace Team Invitation</p>
              </div>
              <div style="background-color: #ffffff; padding: 32px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <h2 style="color: #1e293b; font-size: 18px; margin-top: 0; font-weight: 600;">Join ${clientName}</h2>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                  You have been invited to join the <strong>${clientName}</strong> workspace with the role of <strong>${roleName}</strong>.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                    Accept Invitation
                  </a>
                </div>
                <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
                  Or copy and paste this link into your browser:<br/>
                  <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
                  This invitation is valid until <strong>${expiresAt.toLocaleString()}</strong>.
                </p>
              </div>
            </div>
          `,
        });
        logger.info(`[EmailService] Team invite dispatched via SMTP for ${to} to join ${clientName}`);
      } catch (err) {
        logger.error(`[EmailService] Failed to send team invite to ${to}:`, err);
      }
    } else {
      logger.info(
        `[EmailService:DEV] SMTP not configured. Team invite link generated for ${to} (${clientName} - ${roleName}): ${inviteUrl} (valid until ${expiresAt.toISOString()})`
      );
    }
  }
}
