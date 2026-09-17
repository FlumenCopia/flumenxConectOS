import mongoose from 'mongoose';
import { LeadActivity, ILeadActivity, LeadActivityType } from '../models/LeadActivity';

export interface LogLeadActivityParams {
  leadId: string | mongoose.Types.ObjectId;
  clientId: string | mongoose.Types.ObjectId;
  userId?: string | mongoose.Types.ObjectId;
  activityType: LeadActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class LeadActivityService {
  /**
   * Logs a lead lifecycle or operational event into the LeadActivity timeline.
   */
  public static async log(params: LogLeadActivityParams): Promise<ILeadActivity> {
    const rawLeadId = (params.leadId as any)?._id || params.leadId;
    const rawClientId = (params.clientId as any)?._id || params.clientId;
    const rawUserId = (params.userId as any)?._id || params.userId;

    const activity = new LeadActivity({
      leadId: new mongoose.Types.ObjectId(rawLeadId.toString()),
      clientId: new mongoose.Types.ObjectId(rawClientId.toString()),
      userId: rawUserId ? new mongoose.Types.ObjectId(rawUserId.toString()) : undefined,
      activityType: params.activityType,
      description: params.description,
      metadata: params.metadata || {},
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return await activity.save();
  }

  /**
   * Fetches paginated activity history for a specific lead within tenant boundary.
   */
  public static async getLeadActivities(
    leadId: string,
    clientId: string | null,
    page = 1,
    limit = 25
  ): Promise<{ activities: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const filter: any = { leadId: new mongoose.Types.ObjectId(leadId) };
    if (clientId) {
      filter.clientId = new mongoose.Types.ObjectId(clientId);
    }

    const skip = (page - 1) * limit;
    const [activities, total] = await Promise.all([
      LeadActivity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email avatarUrl')
        .lean(),
      LeadActivity.countDocuments(filter),
    ]);

    return {
      activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
