import mongoose from 'mongoose';
import { Lead, ILead, LeadStage, LeadSource } from '../models/Lead';
import { User } from '../models/User';
import { LeadActivityService } from './leadActivity.service';
import { AuditService } from './audit.service';
import { TaskAutoFollowupService } from './taskAutoFollowup.service';
import { EventDispatcher } from './eventDispatcher.service';
import { AppError } from '../middleware/errorHandler';

export interface ServiceActor {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  ip?: string;
  userAgent?: string;
}

export class LeadService {
  /**
   * Derives a full name from available name or contact parts.
   */
  private static deriveFullName(data: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): string {
    if (data.fullName && data.fullName.trim().length > 0) {
      return data.fullName.trim();
    }
    const parts = [data.firstName, data.lastName].filter(Boolean).map((s) => s!.trim());
    if (parts.length > 0) {
      return parts.join(' ');
    }
    return data.email || data.phone || 'Unnamed Lead';
  }

  /**
   * Sanitizes text to prevent CSV / Spreadsheet formula injection attacks.
   */
  private static sanitizeCsvField(value: any): string {
    if (value === null || value === undefined) return '';
    let str = String(value).trim();
    // If field starts with =, +, -, @, or tab/carriage return, prepend single quote
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    // Escape double quotes by doubling them
    if (/[",\n\r]/.test(str)) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  public static extractClientId(clientRef: any): string {
    if (!clientRef) return '';
    return (clientRef._id || clientRef).toString();
  }

  /**
   * Creates a new lead within the specified client workspace.
   */
  public static async createLead(
    clientId: string,
    data: any,
    actor: ServiceActor
  ): Promise<ILead> {
    const fullName = this.deriveFullName(data);

    const lead = new Lead({
      ...data,
      clientId: new mongoose.Types.ObjectId(clientId),
      fullName,
      email: data.email ? data.email.toLowerCase().trim() : undefined,
      phone: data.phone ? data.phone.trim() : undefined,
      createdBy: new mongoose.Types.ObjectId(actor.id),
      updatedBy: new mongoose.Types.ObjectId(actor.id),
      isArchived: false,
    });

    const savedLead = await lead.save();

    // Log creation activity
    await LeadActivityService.log({
      leadId: savedLead._id,
      clientId: savedLead.clientId,
      userId: actor.id,
      activityType: 'created',
      description: `Lead created by ${actor.name} via ${savedLead.source}`,
      metadata: { source: savedLead.source, initialStage: savedLead.stage },
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });

    // If initial notes provided, log note activity
    if (data.notes && data.notes.trim().length > 0) {
      await LeadActivityService.log({
        leadId: savedLead._id,
        clientId: savedLead.clientId,
        userId: actor.id,
        activityType: 'note_added',
        description: data.notes.trim(),
        ipAddress: actor.ip,
        userAgent: actor.userAgent,
      });
    }

    // Audit log
    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: savedLead.clientId.toString(),
      action: 'lead.create',
      resourceType: 'lead',
      resourceId: savedLead._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { leadName: savedLead.fullName, stage: savedLead.stage },
    });

    // Auto-generate initial follow-up task
    try {
      await TaskAutoFollowupService.generateLeadFollowUpTask({
        clientId: savedLead.clientId,
        leadId: savedLead._id,
        source: 'manual',
        leadName: savedLead.fullName,
        leadEmail: savedLead.email,
        leadPhone: savedLead.phone,
        leadScore: savedLead.leadScore,
        notes: data.notes,
        actorId: actor.id,
      });
    } catch (taskErr) {
      // Non-fatal
    }

    // Dispatch workflow trigger event: lead.created
    try {
      await EventDispatcher.dispatch({
        clientId: savedLead.clientId.toString(),
        eventType: 'lead.created',
        eventId: `lead_created_${savedLead._id}`,
        entityId: savedLead._id.toString(),
        entityType: 'lead',
        payload: {
          lead: savedLead.toObject ? savedLead.toObject() : savedLead,
          source: savedLead.source,
          stage: savedLead.stage,
        },
        actor,
      });
    } catch (eventErr) {
      // Non-fatal
    }

    return savedLead;
  }

  /**
   * Queries leads with multi-attribute filtering, search, and pagination.
   */
  public static async getLeads(
    scopeClientId: string | null,
    query: any,
    actor: ServiceActor
  ): Promise<{ leads: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const filter: any = {};

    // Strict tenant isolation: regular users MUST be constrained by scopeClientId
    if (!actor.isSuperAdmin || scopeClientId) {
      if (!scopeClientId) {
        throw new AppError('Client workspace context required.', 400);
      }
      filter.clientId = new mongoose.Types.ObjectId(scopeClientId);
    } else if (query.clientId) {
      filter.clientId = new mongoose.Types.ObjectId(query.clientId);
    }

    // Soft archive filter
    if (query.includeArchived === 'true') {
      // Include all
    } else {
      filter.isArchived = false;
    }

    // Keyword search
    if (query.search && query.search.trim().length > 0) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { companyName: searchRegex },
      ];
    }

    // Stage filter
    if (query.stage && query.stage !== 'all') {
      filter.stage = query.stage;
    }

    // Source filter
    if (query.source && query.source !== 'all') {
      filter.source = query.source;
    }

    // Assigned user filter
    if (query.assignedTo && query.assignedTo !== 'all') {
      if (query.assignedTo === 'unassigned') {
        filter.assignedTo = { $exists: false };
      } else if (mongoose.Types.ObjectId.isValid(query.assignedTo)) {
        filter.assignedTo = new mongoose.Types.ObjectId(query.assignedTo);
      }
    }

    // Score range
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      filter.leadScore = {};
      if (query.minScore !== undefined) filter.leadScore.$gte = Number(query.minScore);
      if (query.maxScore !== undefined) filter.leadScore.$lte = Number(query.maxScore);
    }

    // Date range (createdAt)
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Follow-up status filter
    if (query.followUpFilter && query.followUpFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (query.followUpFilter === 'overdue') {
        filter.nextFollowUpAt = { $lt: now, $ne: null };
      } else if (query.followUpFilter === 'today') {
        filter.nextFollowUpAt = { $gte: startOfToday, $lte: endOfToday };
      } else if (query.followUpFilter === 'upcoming') {
        filter.nextFollowUpAt = { $gt: now };
      } else if (query.followUpFilter === 'none') {
        filter.nextFollowUpAt = null;
      }
    }

    // Tags filter
    if (query.tags && query.tags.trim().length > 0) {
      filter.tags = { $in: [query.tags.trim()] };
    }

    // Sorting & Pagination
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sort: any = { [sortField]: sortDirection };

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', 'name email avatarUrl')
        .populate('clientId', 'name slug')
        .lean(),
      Lead.countDocuments(filter),
    ]);

    return {
      leads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single lead by ID with strict tenant boundary enforcement.
   */
  public static async getLeadById(
    leadId: string,
    scopeClientId: string | null,
    actor: ServiceActor
  ): Promise<ILead> {
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw new AppError('Invalid lead identifier format.', 400);
    }

    const lead = await Lead.findById(leadId)
      .populate('assignedTo', 'name email phone avatarUrl')
      .populate('clientId', 'name slug logoUrl timezone currency');

    if (!lead) {
      throw new AppError('Lead not found.', 404);
    }

    // Strict Tenant Boundary Check
    if (!actor.isSuperAdmin && scopeClientId && lead.clientId._id.toString() !== scopeClientId) {
      await AuditService.log({
        userId: actor.id,
        userEmail: actor.email,
        clientId: scopeClientId,
        action: 'auth.client_access.violation',
        resourceType: 'lead',
        resourceId: leadId,
        ipAddress: actor.ip,
        userAgent: actor.userAgent,
        success: false,
        metadata: { attemptedLeadClient: lead.clientId._id.toString() },
      });
      throw new AppError('Access denied: Lead belongs to another client workspace.', 403);
    }

    return lead;
  }

  /**
   * Updates lead profile attributes.
   */
  public static async updateLead(
    leadId: string,
    scopeClientId: string | null,
    data: any,
    actor: ServiceActor
  ): Promise<ILead> {
    const lead = await this.getLeadById(leadId, scopeClientId, actor);

    // Prevent overriding clientId
    delete data.clientId;
    delete data._id;

    if (data.firstName || data.lastName || data.fullName) {
      lead.fullName = this.deriveFullName({
        fullName: data.fullName || lead.fullName,
        firstName: data.firstName !== undefined ? data.firstName : lead.firstName,
        lastName: data.lastName !== undefined ? data.lastName : lead.lastName,
        email: data.email || lead.email,
        phone: data.phone || lead.phone,
      });
    }

    Object.assign(lead, data);
    lead.updatedBy = new mongoose.Types.ObjectId(actor.id);
    const updated = await lead.save();

    await LeadActivityService.log({
      leadId: updated._id,
      clientId: updated.clientId,
      userId: actor.id,
      activityType: 'updated',
      description: `Lead details updated by ${actor.name}`,
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: this.extractClientId(updated.clientId),
      action: 'lead.update',
      resourceType: 'lead',
      resourceId: updated._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
    });

    // Dispatch workflow trigger event: lead.updated
    try {
      await EventDispatcher.dispatch({
        clientId: this.extractClientId(updated.clientId),
        eventType: 'lead.updated',
        eventId: `lead_updated_${updated._id}_${Date.now()}`,
        entityId: updated._id.toString(),
        entityType: 'lead',
        payload: {
          lead: updated.toObject ? updated.toObject() : updated,
          updatedFields: Object.keys(data),
        },
        actor,
      });
    } catch (eventErr) {
      // Non-fatal
    }

    return updated;
  }

  /**
   * Updates lead stage with lifecycle state machine validation.
   */
  public static async updateStage(
    leadId: string,
    scopeClientId: string | null,
    data: { stage: LeadStage; lostReason?: string; notes?: string },
    actor: ServiceActor
  ): Promise<ILead> {
    const lead = await this.getLeadById(leadId, scopeClientId, actor);
    const previousStage = lead.stage;
    const nextStage = data.stage;

    if (nextStage === 'lost' && (!data.lostReason || data.lostReason.trim().length === 0)) {
      throw new AppError('A valid reason is required when transitioning a lead to Lost stage.', 400);
    }

    lead.stage = nextStage;
    if (nextStage === 'lost') {
      lead.lostReason = data.lostReason!.trim();
    } else if ((previousStage as string) === 'lost' && (nextStage as string) !== 'lost') {
      // Reopened
      lead.lostReason = undefined;
    }

    lead.updatedBy = new mongoose.Types.ObjectId(actor.id);
    const updated = await lead.save();

    // Log stage change activity
    await LeadActivityService.log({
      leadId: updated._id,
      clientId: updated.clientId,
      userId: actor.id,
      activityType: 'stage_changed',
      description: `Stage changed from ${previousStage} to ${nextStage}${
        data.lostReason ? ` (Reason: ${data.lostReason})` : ''
      }`,
      metadata: {
        previousStage,
        nextStage,
        lostReason: data.lostReason,
        notes: data.notes,
      },
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });

    if (data.notes && data.notes.trim().length > 0) {
      await LeadActivityService.log({
        leadId: updated._id,
        clientId: updated.clientId,
        userId: actor.id,
        activityType: 'note_added',
        description: data.notes.trim(),
        ipAddress: actor.ip,
        userAgent: actor.userAgent,
      });
    }

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: this.extractClientId(updated.clientId),
      action: 'lead.stage_update',
      resourceType: 'lead',
      resourceId: updated._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { previousStage, nextStage },
    });

    // Dispatch workflow trigger event: lead.stage_changed
    try {
      await EventDispatcher.dispatch({
        clientId: this.extractClientId(updated.clientId),
        eventType: 'lead.stage_changed',
        eventId: `lead_stage_${updated._id}_${nextStage}_${Date.now()}`,
        entityId: updated._id.toString(),
        entityType: 'lead',
        payload: {
          lead: updated.toObject ? updated.toObject() : updated,
          previousStage,
          nextStage,
          stage: nextStage,
        },
        actor,
      });
    } catch (eventErr) {
      // Non-fatal
    }

    return updated;
  }

  /**
   * Assigns lead to a team member.
   */
  public static async assignLead(
    leadId: string,
    scopeClientId: string | null,
    data: { assignedTo: string | null; notes?: string },
    actor: ServiceActor
  ): Promise<ILead> {
    const lead = await this.getLeadById(leadId, scopeClientId, actor);
    const previousAssignee = lead.assignedTo?.toString();
    const nextAssignee = data.assignedTo ? new mongoose.Types.ObjectId(data.assignedTo) : undefined;

    lead.assignedTo = nextAssignee;
    lead.updatedBy = new mongoose.Types.ObjectId(actor.id);
    const updated = await lead.save();

    await LeadActivityService.log({
      leadId: updated._id,
      clientId: updated.clientId,
      userId: actor.id,
      activityType: 'assigned',
      description: nextAssignee
        ? `Lead assigned to user ID ${data.assignedTo}`
        : 'Lead unassigned',
      metadata: { previousAssignee, nextAssignee: data.assignedTo },
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: this.extractClientId(updated.clientId),
      action: 'lead.assign',
      resourceType: 'lead',
      resourceId: updated._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { assignedTo: data.assignedTo },
    });

    return updated;
  }

  /**
   * Updates lead score.
   */
  public static async updateScore(
    leadId: string,
    scopeClientId: string | null,
    data: { leadScore: number; reason?: string },
    actor: ServiceActor
  ): Promise<ILead> {
    const lead = await this.getLeadById(leadId, scopeClientId, actor);
    const previousScore = lead.leadScore;
    const nextScore = data.leadScore;

    lead.leadScore = nextScore;
    lead.updatedBy = new mongoose.Types.ObjectId(actor.id);
    const updated = await lead.save();

    await LeadActivityService.log({
      leadId: updated._id,
      clientId: updated.clientId,
      userId: actor.id,
      activityType: 'score_changed',
      description: `Lead score adjusted from ${previousScore} to ${nextScore}${
        data.reason ? ` (${data.reason})` : ''
      }`,
      metadata: { previousScore, nextScore, reason: data.reason },
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: this.extractClientId(updated.clientId),
      action: 'lead.score_update',
      resourceType: 'lead',
      resourceId: updated._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { previousScore, nextScore },
    });

    return updated;
  }

  /**
   * Soft-archives lead.
   */
  public static async deleteLead(
    leadId: string,
    scopeClientId: string | null,
    actor: ServiceActor
  ): Promise<ILead> {
    const lead = await this.getLeadById(leadId, scopeClientId, actor);

    lead.isArchived = true;
    lead.archivedAt = new Date();
    lead.updatedBy = new mongoose.Types.ObjectId(actor.id);
    const updated = await lead.save();

    await LeadActivityService.log({
      leadId: updated._id,
      clientId: updated.clientId,
      userId: actor.id,
      activityType: 'archived',
      description: `Lead archived by ${actor.name}`,
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: this.extractClientId(updated.clientId),
      action: 'lead.archive',
      resourceType: 'lead',
      resourceId: updated._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
    });

    return updated;
  }

  /**
   * Aggregates lead counts and total estimated values across all pipeline stages.
   */
  public static async getPipelineSummary(
    scopeClientId: string | null,
    actor: ServiceActor
  ): Promise<{ stages: Record<string, { count: number; value: number }>; totalCount: number; totalValue: number }> {
    const match: any = { isArchived: false };
    if (!actor.isSuperAdmin || scopeClientId) {
      if (!scopeClientId) {
        throw new AppError('Client workspace context required.', 400);
      }
      match.clientId = new mongoose.Types.ObjectId(scopeClientId);
    }

    const results = await Lead.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
          value: { $sum: '$estimatedValue' },
        },
      },
    ]);

    const stages: Record<string, { count: number; value: number }> = {
      new: { count: 0, value: 0 },
      contacted: { count: 0, value: 0 },
      qualified: { count: 0, value: 0 },
      proposal_sent: { count: 0, value: 0 },
      won: { count: 0, value: 0 },
      lost: { count: 0, value: 0 },
      unqualified: { count: 0, value: 0 },
    };

    let totalCount = 0;
    let totalValue = 0;

    for (const r of results) {
      if (stages[r._id]) {
        stages[r._id] = { count: r.count, value: r.value || 0 };
        totalCount += r.count;
        totalValue += r.value || 0;
      }
    }

    return { stages, totalCount, totalValue };
  }

  /**
   * Exports tenant-scoped leads to CSV with formula injection defense.
   */
  public static async exportLeadsCsv(
    scopeClientId: string | null,
    query: any,
    actor: ServiceActor
  ): Promise<string> {
    const result = await this.getLeads(scopeClientId, { ...query, limit: 1000 }, actor);
    const leads = result.leads;

    const headers = [
      'Lead ID',
      'Full Name',
      'Email',
      'Phone',
      'Company',
      'Job Title',
      'Stage',
      'Lead Score',
      'Source',
      'Campaign',
      'Estimated Value',
      'Currency',
      'Assigned To',
      'Next Follow-up',
      'Created At',
    ];

    const rows = leads.map((l) => [
      this.sanitizeCsvField(l._id),
      this.sanitizeCsvField(l.fullName),
      this.sanitizeCsvField(l.email),
      this.sanitizeCsvField(l.phone),
      this.sanitizeCsvField(l.companyName),
      this.sanitizeCsvField(l.jobTitle),
      this.sanitizeCsvField(l.stage),
      this.sanitizeCsvField(l.leadScore),
      this.sanitizeCsvField(l.source),
      this.sanitizeCsvField(l.campaignName),
      this.sanitizeCsvField(l.estimatedValue),
      this.sanitizeCsvField(l.currency),
      this.sanitizeCsvField(l.assignedTo?.name || 'Unassigned'),
      this.sanitizeCsvField(l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toISOString() : ''),
      this.sanitizeCsvField(new Date(l.createdAt).toISOString()),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: scopeClientId || undefined,
      action: 'lead.export',
      resourceType: 'lead',
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { exportedCount: leads.length },
    });

    return csvContent;
  }
}
