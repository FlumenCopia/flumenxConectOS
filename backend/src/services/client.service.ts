import mongoose, { Types } from 'mongoose';
import { Client, IClient, ClientStatus, ClientHealth, OnboardingItemStatus, defaultOnboardingChecklist } from '../models/Client';
import { ClientActivity } from '../models/ClientActivity';
import { ClientMembership } from '../models/ClientMembership';
import { AuditService } from './audit.service';
import { AppError } from '../middleware/errorHandler';

export interface ListClientsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  health?: string;
  managerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
}

export class ClientService {
  /**
   * Generates a URL-safe, unique slug for a client.
   */
  public static async generateUniqueSlug(name: string, existingId?: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let slug = baseSlug || 'client';
    let counter = 1;

    while (true) {
      const query: Record<string, any> = { slug };
      if (existingId) {
        query._id = { $ne: existingId };
      }
      const existing = await Client.findOne(query).select('_id');
      if (!existing) {
        return slug;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Lists clients with search, status/health/manager filtering, and pagination.
   */
  public static async listClients(params: ListClientsParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    // Filter out archived unless specifically requested
    if (!params.includeArchived) {
      filter.isArchived = { $ne: true };
    }

    if (params.status && params.status !== 'all') {
      filter.status = params.status;
    }

    if (params.health && params.health !== 'all') {
      filter.health = params.health.toLowerCase().replace(/\s+/g, '_');
    }

    if (params.managerId && params.managerId !== 'all') {
      if (mongoose.Types.ObjectId.isValid(params.managerId)) {
        filter.$or = [
          { primaryAccountManagerId: params.managerId },
          { backupAccountManagerId: params.managerId },
        ];
      }
    }

    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(params.search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { slug: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { legalName: searchRegex },
      ];
    }

    const sortField = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, any> = { [sortField]: sortOrder };

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .populate('primaryAccountManagerId', 'name email avatarUrl')
        .populate('backupAccountManagerId', 'name email avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Client.countDocuments(filter),
    ]);

    // Retrieve active member counts for each client
    const clientIds = clients.map((c) => c._id);
    const membershipCounts = await ClientMembership.aggregate([
      { $match: { clientId: { $in: clientIds }, status: 'active' } },
      { $group: { _id: '$clientId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>(
      membershipCounts.map((m) => [m._id.toString(), m.count])
    );

    const clientData = clients.map((c) => {
      const json = c.toJSON();
      return {
        ...json,
        activeMemberCount: countMap.get(c._id.toString()) || 0,
      };
    });

    return {
      clients: clientData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Provisions a new client workspace with standard onboarding checklist and activity tracking.
   */
  public static async createClient(
    data: Record<string, any>,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ): Promise<IClient> {
    const slug = data.slug
      ? await this.generateUniqueSlug(data.slug)
      : await this.generateUniqueSlug(data.name);

    // Initial 14-item onboarding checklist with item 0 completed
    const checklist = defaultOnboardingChecklist.map((item, idx) => ({
      title: item.title,
      description: item.description,
      status: (idx === 0 ? 'completed' : 'pending') as OnboardingItemStatus,
      completedBy: idx === 0 ? (new Types.ObjectId(actor.id) as any) : undefined,
      completedAt: idx === 0 ? new Date() : undefined,
    }));

    const client = await Client.create({
      ...data,
      slug,
      status: data.status || 'onboarding',
      health: data.health || 'healthy',
      onboardingStatus: 'in_progress',
      onboardingProgress: Math.round((1 / checklist.length) * 100),
      onboardingChecklist: checklist,
      createdBy: actor.id,
      primaryAccountManagerId: data.primaryAccountManagerId || undefined,
      backupAccountManagerId: data.backupAccountManagerId || undefined,
    });

    // Record Client Activity
    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.created',
      title: `Client workspace "${client.name}" created`,
      details: { slug: client.slug, status: client.status, health: client.health },
      ipAddress: actor.ip,
    });

    // Record Audit Log
    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.created',
      resourceType: 'client',
      resourceId: client._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { name: client.name, slug: client.slug },
    });

    return client;
  }

  /**
   * Retrieves single client workspace with populated account managers.
   */
  public static async getClientById(clientId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      const err = new Error('Invalid client ID format') as AppError;
      err.statusCode = 400;
      throw err;
    }

    const client = await Client.findById(clientId)
      .populate('primaryAccountManagerId', 'name email phone avatarUrl')
      .populate('backupAccountManagerId', 'name email phone avatarUrl')
      .populate('createdBy', 'name email');

    if (!client) {
      const err = new Error('Client workspace not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const memberCount = await ClientMembership.countDocuments({
      clientId: client._id,
      status: 'active',
    });

    return {
      ...client.toJSON(),
      memberCount,
    };
  }

  /**
   * Updates client business and profile details.
   */
  public static async updateClient(
    clientId: string,
    data: Record<string, any>,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ): Promise<IClient> {
    const client = await Client.findById(clientId);
    if (!client) {
      const err = new Error('Client workspace not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    if (data.name && data.name !== client.name && !data.slug) {
      // Keep existing slug unless explicitly altered
    } else if (data.slug && data.slug !== client.slug) {
      client.slug = await this.generateUniqueSlug(data.slug, client._id.toString());
    }

    // Apply allowed updates
    const fieldsToUpdate = [
      'name',
      'legalName',
      'email',
      'phone',
      'website',
      'industry',
      'address',
      'city',
      'state',
      'country',
      'timezone',
      'currency',
      'logoUrl',
      'brandColor',
      'notes',
    ];

    for (const field of fieldsToUpdate) {
      if (data[field] !== undefined) {
        (client as any)[field] = data[field];
      }
    }

    if (data.settings) {
      client.settings = { ...client.settings, ...data.settings };
    }

    await client.save();

    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.updated',
      title: `Client profile updated`,
      details: { updatedFields: Object.keys(data) },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.updated',
      resourceType: 'client',
      resourceId: client._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { fields: Object.keys(data) },
    });

    return client;
  }

  /**
   * Updates client operational status (active, paused, etc.).
   */
  public static async updateStatus(
    clientId: string,
    status: ClientStatus,
    reason: string | undefined,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ): Promise<IClient> {
    const client = await Client.findById(clientId);
    if (!client) {
      const err = new Error('Client workspace not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const previousStatus = client.status;
    client.status = status;
    if (status === 'archived') {
      client.isArchived = true;
      client.archivedAt = new Date();
    } else {
      client.isArchived = false;
      client.archivedAt = undefined;
    }

    await client.save();

    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.status_changed',
      title: `Status changed from "${previousStatus}" to "${status}"`,
      details: { previousStatus, newStatus: status, reason },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.status.updated',
      resourceType: 'client',
      resourceId: client._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { previousStatus, newStatus: status, reason },
    });

    return client;
  }

  /**
   * Updates client health status (healthy, needs_attention, at_risk, inactive).
   */
  public static async updateHealth(
    clientId: string,
    health: ClientHealth,
    notes: string | undefined,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ): Promise<IClient> {
    const client = await Client.findById(clientId);
    if (!client) {
      const err = new Error('Client workspace not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const previousHealth = client.health;
    client.health = health;
    await client.save();

    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.health_changed',
      title: `Health status changed from "${previousHealth}" to "${health}"`,
      details: { previousHealth, newHealth: health, notes },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.health.updated',
      resourceType: 'client',
      resourceId: client._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { previousHealth, newHealth: health, notes },
    });

    return client;
  }

  /**
   * Assigns primary and backup account managers to client workspace.
   */
  public static async updateManagers(
    clientId: string,
    managers: { primaryAccountManagerId?: string | null; backupAccountManagerId?: string | null },
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ): Promise<IClient> {
    const client = await Client.findById(clientId);
    if (!client) {
      const err = new Error('Client workspace not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    if (managers.primaryAccountManagerId !== undefined) {
      client.primaryAccountManagerId = managers.primaryAccountManagerId
        ? (new Types.ObjectId(managers.primaryAccountManagerId) as any)
        : undefined;
    }

    if (managers.backupAccountManagerId !== undefined) {
      client.backupAccountManagerId = managers.backupAccountManagerId
        ? (new Types.ObjectId(managers.backupAccountManagerId) as any)
        : undefined;
    }

    await client.save();

    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.managers_assigned',
      title: `Account managers updated`,
      details: managers,
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.managers.updated',
      resourceType: 'client',
      resourceId: client._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: managers,
    });

    return client;
  }

  /**
   * Soft-archives a client workspace.
   */
  public static async archiveClient(
    clientId: string,
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ): Promise<IClient> {
    return this.updateStatus(clientId, 'archived', 'Archived by administrator', actor);
  }

  /**
   * Updates an onboarding item and automatically recalculates overall progress.
   */
  public static async updateOnboardingItem(
    clientId: string,
    itemId: string,
    data: { status: OnboardingItemStatus; notes?: string; dueDate?: string | null },
    actor: { id: string; email: string; name?: string; ip?: string; userAgent?: string }
  ): Promise<IClient> {
    const client = await Client.findById(clientId);
    if (!client) {
      const err = new Error('Client workspace not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const item = client.onboardingChecklist.find((i: any) => i._id.toString() === itemId);
    if (!item) {
      const err = new Error('Onboarding checklist item not found') as AppError;
      err.statusCode = 404;
      throw err;
    }

    const prevStatus = item.status;
    item.status = data.status;

    if (data.status === 'completed' && prevStatus !== 'completed') {
      item.completedBy = new Types.ObjectId(actor.id) as any;
      item.completedAt = new Date();
    } else if (data.status !== 'completed') {
      item.completedBy = undefined;
      item.completedAt = undefined;
    }

    if (data.notes !== undefined) {
      item.notes = data.notes;
    }

    if (data.dueDate !== undefined) {
      item.dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
    }

    // Recalculate progress
    const total = client.onboardingChecklist.length;
    const completed = client.onboardingChecklist.filter(
      (i) => i.status === 'completed' || i.status === 'not_applicable'
    ).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    client.onboardingProgress = progress;
    if (progress === 100) {
      client.onboardingStatus = 'completed';
    } else if (progress > 0) {
      client.onboardingStatus = 'in_progress';
    } else {
      client.onboardingStatus = 'pending';
    }

    await client.save();

    await ClientActivity.create({
      clientId: client._id,
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      action: 'client.onboarding_updated',
      title: `Onboarding item "${item.title}" updated to "${data.status}"`,
      details: { itemId, itemTitle: item.title, previousStatus: prevStatus, newStatus: data.status, progress },
      ipAddress: actor.ip,
    });

    await AuditService.log({
      userId: actor.id,
      userEmail: actor.email,
      clientId: client._id.toString(),
      action: 'client.onboarding.item_updated',
      resourceType: 'client',
      resourceId: client._id.toString(),
      ipAddress: actor.ip,
      userAgent: actor.userAgent,
      success: true,
      metadata: { itemTitle: item.title, status: data.status, progress },
    });

    return client;
  }

  /**
   * Retrieves paginated activity timeline for a client workspace.
   */
  public static async getClientActivity(clientId: string, page = 1, limit = 20) {
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      const err = new Error('Invalid client ID format') as AppError;
      err.statusCode = 400;
      throw err;
    }

    const skip = (Math.max(1, page) - 1) * limit;

    const [activities, total] = await Promise.all([
      ClientActivity.find({ clientId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ClientActivity.countDocuments({ clientId }),
    ]);

    return {
      activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
