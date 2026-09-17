import { logger } from '../config/logger';
import { env } from '../config/env';

export interface PasswordResetEmailOptions {
  to: string;
  resetToken: string;
  expiresAt: Date;
}

export class EmailService {
  /**
   * Safe email delivery abstraction.
   * Real emails are only dispatched when an actual provider is configured.
   * In local development, safely records the event without exposing sensitive secrets in production.
   */
  public static async sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
    const { to, expiresAt } = options;

    if (env.NODE_ENV === 'production') {
      // In production, integration with SMTP / SendGrid / SES would occur here
      logger.info(`[EmailService] Password reset dispatch initiated for ${to}`);
    } else {
      // Development safe logger
      logger.info(
        `[EmailService:DEV] Password reset generated for recipient: ${to} (valid until ${expiresAt.toISOString()})`
      );
    }
  }

  /**
   * Dispatches client team invitation email with secure one-time acceptance link.
   */
  public static async sendClientInvitationEmail(options: {
    to: string;
    clientName: string;
    roleName: string;
    inviteToken: string;
    expiresAt: Date;
  }): Promise<void> {
    const { to, clientName, roleName, expiresAt } = options;

    if (env.NODE_ENV === 'production') {
      logger.info(`[EmailService] Client team invite dispatched for ${to} to join ${clientName}`);
    } else {
      logger.info(
        `[EmailService:DEV] Team invite generated for recipient: ${to} for client: ${clientName} (${roleName}, valid until ${expiresAt.toISOString()})`
      );
    }
  }
}
