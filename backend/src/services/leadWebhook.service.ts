import crypto from 'crypto';
import mongoose from 'mongoose';
import { ClientWebhook, IClientWebhook, WebhookStatus } from '../models/ClientWebhook';
import { Lead } from '../models/Lead';
import { LeadActivityService } from './leadActivity.service';
import { AuditService } from './audit.service';
import { TaskAutoFollowupService } from './taskAutoFollowup.service';
import { AppError } from '../middleware/errorHandler';

export interface WebhookIntakeContext {
  ip?: string;
  userAgent?: string;
  timestampHeader?: string;
}

export class LeadWebhookService {
  /**
   * Hashes a raw secret using SHA-256.
   */
  private static hashSecret(rawSecret: string): string {
    return crypto.createHash('sha256').update(rawSecret).digest('hex');
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private static secureCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'hex');
      const bufB = Buffer.from(b, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  /**
   * Generates a new webhook credential for a client workspace.
   * Returns the raw secret ONLY once at creation time.
   */
  public static async createWebhook(
    clientId: string,
    data: { name: string; allowedSources?: string[] },
    actor: { id: string; email: string; ip?: string; userAgent?: string }
  ): Promise<{ webhook: IClientWebhook; rawSecret: string }> {
    const keyId = `whk_${crypto.randomBytes(12).toString('hex')}`;
    const rawSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = this.hashSecret(rawSecret);

    const webhook = new ClientWebhook({
      clientId: new mongoose.Types.ObjectId(clientId),
      name: data.name.trim(),
      keyId,
      secretHash,
      status: 'active',
      allowedSources: data.allowedSources || ['webhook', 'meta_ads', 'google_ads', 'organic', 'manual'],
      createdBy: new mongoose.Types.ObjectId(actor.id),
    });

    const saved = await webhook.save();

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId,
      action: 'webhook.create',
      resourceType: 'webhook',
      resourceId: saved._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { keyId, name: saved.name },
    });

    return { webhook: saved, rawSecret };
  }

  /**
   * Lists all webhook credentials for a client workspace (secrets are never included).
   */
  public static async listWebhooks(clientId: string): Promise<IClientWebhook[]> {
    return await ClientWebhook.find({
      clientId: new mongoose.Types.ObjectId(clientId),
    })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');
  }

  /**
   * Rotates a webhook secret, returning the newly generated raw secret once.
   */
  public static async rotateWebhookSecret(
    clientId: string,
    webhookId: string,
    actor: { id: string; email: string; ip?: string; userAgent?: string }
  ): Promise<{ webhook: IClientWebhook; rawSecret: string }> {
    const webhook = await ClientWebhook.findOne({
      _id: new mongoose.Types.ObjectId(webhookId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!webhook) {
      throw new AppError('Webhook credential not found.', 404);
    }

    const rawSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    webhook.secretHash = this.hashSecret(rawSecret);
    const updated = await webhook.save();

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId,
      action: 'webhook.rotate',
      resourceType: 'webhook',
      resourceId: updated._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { keyId: updated.keyId },
    });

    return { webhook: updated, rawSecret };
  }

  /**
   * Updates webhook status (active, revoked, suspended).
   */
  public static async updateWebhookStatus(
    clientId: string,
    webhookId: string,
    status: WebhookStatus,
    actor: { id: string; email: string; ip?: string; userAgent?: string }
  ): Promise<IClientWebhook> {
    const webhook = await ClientWebhook.findOne({
      _id: new mongoose.Types.ObjectId(webhookId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!webhook) {
      throw new AppError('Webhook credential not found.', 404);
    }

    webhook.status = status;
    const updated = await webhook.save();

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId,
      action: 'webhook.status_update',
      resourceType: 'webhook',
      resourceId: updated._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { keyId: updated.keyId, status },
    });

    return updated;
  }

  /**
   * Permanently revokes / deletes a webhook credential.
   */
  public static async deleteWebhook(
    clientId: string,
    webhookId: string,
    actor: { id: string; email: string; ip?: string; userAgent?: string }
  ): Promise<void> {
    const webhook = await ClientWebhook.findOne({
      _id: new mongoose.Types.ObjectId(webhookId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });

    if (!webhook) {
      throw new AppError('Webhook credential not found.', 404);
    }

    await ClientWebhook.deleteOne({ _id: webhook._id });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId,
      action: 'webhook.delete',
      resourceType: 'webhook',
      resourceId: webhook._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { keyId: webhook.keyId },
    });
  }

  /**
   * Authenticates and processes an incoming webhook lead submission.
   */
  public static async processWebhookIntake(
    keyId: string,
    rawSecret: string,
    payload: any,
    ctx: WebhookIntakeContext
  ): Promise<any> {
    if (!keyId || !rawSecret) {
      throw new AppError('Missing webhook authentication credentials (key or secret).', 401);
    }

    // Replay attack and timestamp check (if timestamp header provided)
    if (ctx.timestampHeader) {
      const ts = Number(ctx.timestampHeader);
      if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
        await AuditService.log({
          action: 'webhook.replay_rejected',
          resourceType: 'webhook',
          ipAddress: ctx.ip,
          userAgent: ctx.userAgent,
          success: false,
          metadata: { keyId, providedTimestamp: ctx.timestampHeader },
        });
        throw new AppError('Webhook request timestamp expired or invalid. Replay rejected.', 400);
      }
    }

    const webhook = await ClientWebhook.findOne({ keyId }).select('+secretHash');
    if (!webhook || webhook.status !== 'active') {
      await AuditService.log({
        action: 'webhook.auth_failed',
        resourceType: 'webhook',
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        success: false,
        metadata: { keyId },
      });
      throw new AppError('Invalid or inactive webhook credential.', 401);
    }

    const incomingHash = this.hashSecret(rawSecret);
    if (!this.secureCompare(incomingHash, webhook.secretHash)) {
      await AuditService.log({
        action: 'webhook.invalid_secret',
        resourceType: 'webhook',
        resourceId: webhook._id.toString(),
        clientId: webhook.clientId.toString(),
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        success: false,
        metadata: { keyId },
      });
      throw new AppError('Invalid webhook secret.', 401);
    }

    // Strict tenant boundary: the lead is ALWAYS bound to webhook.clientId
    // Any clientId provided in payload is ignored / discarded
    const fullName =
      payload.fullName ||
      payload.name ||
      [payload.firstName, payload.lastName].filter(Boolean).join(' ') ||
      payload.email ||
      payload.phone ||
      'Inbound Webhook Lead';

    const source = payload.source || 'webhook';

    const lead = new Lead({
      clientId: webhook.clientId,
      fullName: fullName.trim(),
      firstName: payload.firstName?.trim(),
      lastName: payload.lastName?.trim(),
      email: payload.email ? payload.email.toLowerCase().trim() : undefined,
      phone: payload.phone ? payload.phone.trim() : undefined,
      companyName: (payload.companyName || payload.company)?.trim(),
      jobTitle: payload.jobTitle?.trim(),
      website: payload.website?.trim(),

      source,
      sourceDetails: payload.sourceDetails || `Ingested via Webhook: ${webhook.name}`,
      campaignName: payload.campaignName?.trim(),
      campaignId: payload.campaignId?.trim(),
      adSetName: payload.adSetName?.trim(),
      adId: payload.adId?.trim(),
      landingPageUrl: payload.landingPageUrl?.trim(),

      stage: 'new',
      leadScore: 50,
      estimatedValue: payload.estimatedValue || 0,
      currency: 'USD',
      tags: payload.tags || ['webhook-intake'],
      customFields: payload.customFields || {},
      isArchived: false,
    });

    const savedLead = await lead.save();

    // Update webhook last used timestamp
    webhook.lastUsedAt = new Date();
    await webhook.save();

    // Log activity
    await LeadActivityService.log({
      leadId: savedLead._id,
      clientId: savedLead.clientId,
      activityType: 'webhook_received',
      description: `Lead ingested from webhook credential '${webhook.name}' (Key: ${webhook.keyId})`,
      metadata: { source, keyId: webhook.keyId },
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    if (payload.notes || payload.message) {
      await LeadActivityService.log({
        leadId: savedLead._id,
        clientId: savedLead.clientId,
        activityType: 'note_added',
        description: (payload.notes || payload.message).trim(),
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }

    // Audit log (never exposing secret)
    await AuditService.log({
      clientId: webhook.clientId.toString(),
      action: 'webhook.intake_success',
      resourceType: 'lead',
      resourceId: savedLead._id.toString(),
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
      success: true,
      metadata: { leadId: savedLead._id.toString(), keyId: webhook.keyId },
    });

    // Automatic Follow-up Task Generation
    try {
      await TaskAutoFollowupService.generateLeadFollowUpTask({
        clientId: webhook.clientId,
        leadId: savedLead._id,
        source: 'webhook',
        leadName: savedLead.fullName,
        leadEmail: savedLead.email,
        leadPhone: savedLead.phone,
        leadScore: savedLead.leadScore,
        notes: `Webhook Intake: ${webhook.name}`,
      });
    } catch (taskErr) {
      // Non-fatal for webhook response
    }

    return {
      success: true,
      leadId: savedLead._id.toString(),
      fullName: savedLead.fullName,
      stage: savedLead.stage,
      createdAt: savedLead.createdAt,
    };
  }
}
