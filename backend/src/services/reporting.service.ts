import mongoose from 'mongoose';
import { Lead } from '../models/Lead';
import { FormSubmission } from '../models/FormSubmission';
import { WebsiteForm } from '../models/WebsiteForm';
import { AdCampaign } from '../models/AdCampaign';
import { AdSpendDaily } from '../models/AdSpendDaily';
import { LeadAttribution } from '../models/LeadAttribution';
import { Task } from '../models/Task';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { ClientMembership } from '../models/ClientMembership';
import { SavedReport, ISavedReport, ReportVisibility } from '../models/SavedReport';
import { buildSafeCsv } from '../utils/csv';
import { AppError } from '../middleware/errorHandler';

export interface DateRangeResolution {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
  preset: string;
}

export interface MetricWithDelta<T = number | null> {
  value: T;
  previousValue?: T;
  changePercentage?: number | null;
}

export class ReportingService {
  /**
   * Resolves date range and previous equivalent comparison period.
   */
  public static resolveDateRange(
    preset: string = 'last_30_days',
    customStart?: Date,
    customEnd?: Date
  ): DateRangeResolution {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    switch (preset) {
      case 'today': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      }
      case 'yesterday': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      }
      case 'last_7_days': {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'last_30_days': {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      }
      case 'this_month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      }
      case 'previous_month': {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      }
      case 'custom': {
        if (!customStart || !customEnd) {
          throw new AppError('Custom date range requires startDate and endDate', 400);
        }
        start = new Date(customStart);
        end = new Date(customEnd);
        break;
      }
      default: {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        preset = 'last_30_days';
      }
    }

    const durationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - durationMs);
    const prevEnd = new Date(start.getTime());

    return {
      current: { start, end },
      previous: { start: prevStart, end: prevEnd },
      preset,
    };
  }

  public static calculatePercentageChange(current: number, previous: number): number | null {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  // =========================================================================
  // 1. OVERVIEW KPIS
  // =========================================================================

  public static async getOverviewKpis(
    clientId: string,
    params: {
      preset?: string;
      startDate?: Date;
      endDate?: Date;
      compare?: boolean;
      hasFinancialAccess?: boolean;
    }
  ) {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, previous, preset } = this.resolveDateRange(
      params.preset,
      params.startDate,
      params.endDate
    );

    const runPeriodMetrics = async (range: { start: Date; end: Date }) => {
      const [
        totalLeads,
        wonLeads,
        formSubmissions,
        tasksCompleted,
        tasksCompletedWithinSla,
        activeConversations,
        adSpendResult,
        revenueResult,
      ] = await Promise.all([
        Lead.countDocuments({
          clientId: clientObjectId,
          createdAt: { $gte: range.start, $lte: range.end },
          isArchived: false,
        }),
        Lead.countDocuments({
          clientId: clientObjectId,
          stage: 'won',
          createdAt: { $gte: range.start, $lte: range.end },
          isArchived: false,
        }),
        FormSubmission.countDocuments({
          clientId: clientObjectId,
          createdAt: { $gte: range.start, $lte: range.end },
        }),
        Task.countDocuments({
          clientId: clientObjectId,
          status: 'completed',
          completedAt: { $gte: range.start, $lte: range.end },
        }),
        Task.countDocuments({
          clientId: clientObjectId,
          status: 'completed',
          slaBreached: false,
          completedAt: { $gte: range.start, $lte: range.end },
        }),
        Conversation.countDocuments({
          clientId: clientObjectId,
          status: { $in: ['open', 'pending'] },
          updatedAt: { $gte: range.start, $lte: range.end },
        }),
        params.hasFinancialAccess
          ? AdSpendDaily.aggregate([
              {
                $match: {
                  clientId: clientObjectId,
                  $or: [
                    {
                      date: {
                        $gte: range.start.toISOString().split('T')[0],
                        $lte: range.end.toISOString().split('T')[0],
                      },
                    },
                    { date: { $gte: range.start, $lte: range.end } as any },
                  ],
                },
              },
              { $group: { _id: null, totalSpend: { $sum: '$spend' } } },
            ])
          : Promise.resolve([]),
        params.hasFinancialAccess
          ? Lead.aggregate([
              {
                $match: {
                  clientId: clientObjectId,
                  stage: 'won',
                  createdAt: { $gte: range.start, $lte: range.end },
                  estimatedValue: { $gt: 0 },
                },
              },
              { $group: { _id: null, totalRevenue: { $sum: '$estimatedValue' } } },
            ])
          : Promise.resolve([]),
      ]);

      const conversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;
      const slaComplianceRate =
        tasksCompleted > 0
          ? Number(((tasksCompletedWithinSla / tasksCompleted) * 100).toFixed(1))
          : 100;

      let spend: number | null = null;
      let revenue: number | null = null;
      let roas: number | null = null;

      if (params.hasFinancialAccess) {
        if (adSpendResult.length > 0 && adSpendResult[0].totalSpend > 0) {
          spend = Number(adSpendResult[0].totalSpend.toFixed(2));
        }
        if (revenueResult.length > 0 && revenueResult[0].totalRevenue > 0) {
          revenue = Number(revenueResult[0].totalRevenue.toFixed(2));
        }
        if (spend !== null && spend > 0 && revenue !== null) {
          roas = Number((revenue / spend).toFixed(2));
        }
      }

      return {
        totalLeads,
        wonLeads,
        conversionRate,
        formSubmissions,
        tasksCompleted,
        slaComplianceRate,
        activeConversations,
        spend,
        revenue,
        roas,
      };
    };

    const currentMetrics = await runPeriodMetrics(current);
    const compare = params.compare !== false;
    const previousMetrics = compare ? await runPeriodMetrics(previous) : null;

    const buildMetric = (curr: number, prev: number | null | undefined): MetricWithDelta => ({
      value: curr,
      previousValue: prev ?? undefined,
      changePercentage: prev !== null && prev !== undefined ? this.calculatePercentageChange(curr, prev) : null,
    });

    const buildNullableMetric = (curr: number | null, prev: number | null | undefined): MetricWithDelta => ({
      value: curr,
      previousValue: prev ?? undefined,
      changePercentage:
        curr !== null && prev !== null && prev !== undefined && prev > 0
          ? this.calculatePercentageChange(curr, prev)
          : null,
    });

    return {
      dateRange: {
        preset,
        current,
        previous: compare ? previous : null,
      },
      metrics: {
        totalLeads: buildMetric(currentMetrics.totalLeads, previousMetrics?.totalLeads),
        wonLeads: buildMetric(currentMetrics.wonLeads, previousMetrics?.wonLeads),
        conversionRate: buildMetric(currentMetrics.conversionRate, previousMetrics?.conversionRate),
        formSubmissions: buildMetric(currentMetrics.formSubmissions, previousMetrics?.formSubmissions),
        tasksCompleted: buildMetric(currentMetrics.tasksCompleted, previousMetrics?.tasksCompleted),
        slaComplianceRate: buildMetric(currentMetrics.slaComplianceRate, previousMetrics?.slaComplianceRate),
        activeConversations: buildMetric(currentMetrics.activeConversations, previousMetrics?.activeConversations),
        ...(params.hasFinancialAccess
          ? {
              totalSpend: buildNullableMetric(currentMetrics.spend, previousMetrics?.spend),
              closedRevenue: buildNullableMetric(currentMetrics.revenue, previousMetrics?.revenue),
              roas: buildNullableMetric(currentMetrics.roas, previousMetrics?.roas),
            }
          : {}),
      },
    };
  }

  // =========================================================================
  // 2. LEAD ANALYTICS
  // =========================================================================

  public static async getLeadAnalytics(
    clientId: string,
    params: {
      preset?: string;
      startDate?: Date;
      endDate?: Date;
      source?: string;
      stage?: string;
      hasFinancialAccess?: boolean;
    }
  ) {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, preset } = this.resolveDateRange(params.preset, params.startDate, params.endDate);

    const match: any = {
      clientId: clientObjectId,
      createdAt: { $gte: current.start, $lte: current.end },
      isArchived: false,
    };
    if (params.source) match.source = params.source;
    if (params.stage) match.stage = params.stage;

    const [dailyTrend, sourceBreakdown, stageDistribution, scoreTiers] = await Promise.all([
      // Daily Trend
      Lead.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: 1 },
            won: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
            lost: { $sum: { $cond: [{ $eq: ['$stage', 'lost'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Source Breakdown
      Lead.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$source',
            count: { $sum: 1 },
            wonCount: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Stage Distribution
      Lead.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
            totalValue: { $sum: '$estimatedValue' },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Score Tier Breakdown
      Lead.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$scoreTier',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalLeadsCount = stageDistribution.reduce((acc, curr) => acc + curr.count, 0);

    const sources = sourceBreakdown.map((s) => ({
      source: s._id || 'other',
      count: s.count,
      percentage: totalLeadsCount > 0 ? Number(((s.count / totalLeadsCount) * 100).toFixed(1)) : 0,
      wonCount: s.wonCount,
      conversionRate: s.count > 0 ? Number(((s.wonCount / s.count) * 100).toFixed(1)) : 0,
    }));

    const stages = stageDistribution.map((st) => ({
      stage: st._id,
      count: st.count,
      percentage: totalLeadsCount > 0 ? Number(((st.count / totalLeadsCount) * 100).toFixed(1)) : 0,
      ...(params.hasFinancialAccess ? { totalValue: st.totalValue || 0 } : {}),
    }));

    return {
      dateRange: { preset, ...current },
      totalLeads: totalLeadsCount,
      trend: dailyTrend.map((d) => ({
        date: d._id,
        total: d.total,
        won: d.won,
        lost: d.lost,
      })),
      sources,
      stages,
      scoreTiers: scoreTiers.map((sc) => ({ tier: sc._id || 'cold', count: sc.count })),
    };
  }

  // =========================================================================
  // 3. CAMPAIGN & AD ATTRIBUTION ANALYTICS
  // =========================================================================

  public static async getCampaignAnalytics(
    clientId: string,
    params: {
      preset?: string;
      startDate?: Date;
      endDate?: Date;
      campaignId?: string;
      hasFinancialAccess?: boolean;
    }
  ) {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, preset } = this.resolveDateRange(params.preset, params.startDate, params.endDate);

    const matchAttribution: any = {
      clientId: clientObjectId,
      createdAt: { $gte: current.start, $lte: current.end },
    };
    if (params.campaignId) {
      matchAttribution.campaignId = new mongoose.Types.ObjectId(params.campaignId);
    }

    const matchSpend: any = {
      clientId: clientObjectId,
      $or: [
        {
          date: {
            $gte: current.start.toISOString().split('T')[0],
            $lte: current.end.toISOString().split('T')[0],
          },
        },
        { date: { $gte: current.start, $lte: current.end } },
      ],
    };
    if (params.campaignId) {
      matchSpend.campaignId = new mongoose.Types.ObjectId(params.campaignId);
    }

    const [platformBreakdown, touchpointBreakdown, campaignSpendRows, campaigns] = await Promise.all([
      // Attribution Platform Distribution
      LeadAttribution.aggregate([
        { $match: matchAttribution },
        {
          $group: {
            _id: '$platform',
            attributedLeads: { $sum: 1 },
          },
        },
        { $sort: { attributedLeads: -1 } },
      ]),

      // Touchpoint Type Distribution
      LeadAttribution.aggregate([
        { $match: matchAttribution },
        {
          $group: {
            _id: '$touchpointType',
            count: { $sum: 1 },
          },
        },
      ]),

      // Spend Aggregation by Campaign
      AdSpendDaily.aggregate([
        { $match: matchSpend },
        {
          $group: {
            _id: '$campaignId',
            totalSpend: { $sum: '$spend' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            conversions: { $sum: '$conversions' },
            leads: { $sum: '$leads' },
          },
        },
      ]),

      // Campaign list
      AdCampaign.find({ clientId: clientObjectId }).lean(),
    ]);

    const campaignMap = new Map(campaigns.map((c: any) => [c._id.toString(), c]));

    const campaignPerformance = campaignSpendRows.map((row: any) => {
      const cId = row._id ? row._id.toString() : '';
      const cMeta = campaignMap.get(cId);
      const spend = params.hasFinancialAccess ? Number(row.totalSpend.toFixed(2)) : null;
      const clicks = row.clicks || 0;
      const impressions = row.impressions || 0;
      const leads = row.leads || 0;

      const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null;
      const cpc = spend !== null && clicks > 0 ? Number((spend / clicks).toFixed(2)) : null;
      const cpl = spend !== null && leads > 0 ? Number((spend / leads).toFixed(2)) : null;

      return {
        campaignId: cId,
        name: cMeta?.name || 'Unknown Campaign',
        platform: cMeta?.platform || 'meta',
        status: cMeta?.status || 'active',
        impressions,
        clicks,
        leads,
        ctr,
        cpc,
        cpl,
        ...(params.hasFinancialAccess ? { spend } : {}),
      };
    });

    return {
      dateRange: { preset, ...current },
      platforms: platformBreakdown.map((p) => ({
        platform: p._id,
        attributedLeads: p.attributedLeads,
      })),
      touchpoints: touchpointBreakdown.map((t) => ({
        type: t._id,
        count: t.count,
      })),
      campaigns: campaignPerformance,
    };
  }

  // =========================================================================
  // 4. FORM ANALYTICS
  // =========================================================================

  public static async getFormAnalytics(
    clientId: string,
    params: {
      preset?: string;
      startDate?: Date;
      endDate?: Date;
      formId?: string;
    }
  ) {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, preset } = this.resolveDateRange(params.preset, params.startDate, params.endDate);

    const match: any = {
      clientId: clientObjectId,
      createdAt: { $gte: current.start, $lte: current.end },
    };
    if (params.formId) {
      match.formId = new mongoose.Types.ObjectId(params.formId);
    }

    const [submissionTrend, formSubmissions, forms] = await Promise.all([
      FormSubmission.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      FormSubmission.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$formId',
            submissionsCount: { $sum: 1 },
            leadsGenerated: { $sum: { $cond: [{ $ne: ['$leadId', null] }, 1, 0] } },
          },
        },
      ]),
      WebsiteForm.find({ clientId: clientObjectId }).lean(),
    ]);

    const formMap = new Map(forms.map((f: any) => [f._id.toString(), f]));

    const performance = formSubmissions.map((s: any) => {
      const fId = s._id ? s._id.toString() : '';
      const f = formMap.get(fId);
      const views = f?.viewsCount || 0;
      const submissions = s.submissionsCount;
      const conversionRate = views > 0 ? Number(((submissions / views) * 100).toFixed(1)) : null;

      return {
        formId: fId,
        title: f?.name || f?.title || 'Unknown Form',
        status: f?.status || 'published',
        views,
        submissions,
        conversionRate,
        leadsGenerated: s.leadsGenerated,
      };
    });

    return {
      dateRange: { preset, ...current },
      trend: submissionTrend.map((t) => ({ date: t._id, submissions: t.total })),
      forms: performance,
    };
  }

  // =========================================================================
  // 5. TASK & SLA ANALYTICS
  // =========================================================================

  public static async getTaskAndSlaAnalytics(
    clientId: string,
    params: {
      preset?: string;
      startDate?: Date;
      endDate?: Date;
      priority?: string;
      taskStatus?: string;
    }
  ) {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, preset } = this.resolveDateRange(params.preset, params.startDate, params.endDate);

    const match: any = {
      clientId: clientObjectId,
      createdAt: { $gte: current.start, $lte: current.end },
    };
    if (params.priority) match.priority = params.priority;
    if (params.taskStatus) match.status = params.taskStatus;

    const [statusDist, priorityDist, dispositionDist, completedTasksStats] = await Promise.all([
      Task.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: match },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: { ...match, disposition: { $exists: true, $ne: null } } },
        { $group: { _id: '$disposition', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        {
          $match: {
            ...match,
            status: 'completed',
            completedAt: { $exists: true, $ne: null },
          },
        },
        {
          $project: {
            slaBreached: 1,
            durationMinutes: {
              $divide: [{ $subtract: ['$completedAt', '$createdAt'] }, 60000],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalCompleted: { $sum: 1 },
            withinSla: { $sum: { $cond: [{ $eq: ['$slaBreached', false] }, 1, 0] } },
            breached: { $sum: { $cond: [{ $eq: ['$slaBreached', true] }, 1, 0] } },
            avgResolutionMinutes: { $avg: '$durationMinutes' },
          },
        },
      ]),
    ]);

    const stats = completedTasksStats[0] || {
      totalCompleted: 0,
      withinSla: 0,
      breached: 0,
      avgResolutionMinutes: null,
    };

    const slaComplianceRate =
      stats.totalCompleted > 0
        ? Number(((stats.withinSla / stats.totalCompleted) * 100).toFixed(1))
        : 100;

    return {
      dateRange: { preset, ...current },
      totalCompleted: stats.totalCompleted,
      slaComplianceRate,
      breachedCount: stats.breached,
      avgResolutionMinutes:
        stats.avgResolutionMinutes !== null ? Math.round(stats.avgResolutionMinutes) : null,
      statusBreakdown: statusDist.map((s) => ({ status: s._id, count: s.count })),
      priorityBreakdown: priorityDist.map((p) => ({ priority: p._id, count: p.count })),
      dispositionBreakdown: dispositionDist.map((d) => ({ disposition: d._id, count: d.count })),
    };
  }

  // =========================================================================
  // 6. TEAM PRODUCTIVITY (Restricted to reports.view_team)
  // =========================================================================

  public static async getTeamProductivity(
    clientId: string,
    params: {
      preset?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, preset } = this.resolveDateRange(params.preset, params.startDate, params.endDate);

    // 1. Get all active workspace members
    const memberships = await ClientMembership.find({
      clientId: clientObjectId,
      status: 'active',
    }).populate('userId', 'name email avatarUrl status');

    const activeUsers = memberships
      .map((m: any) => m.userId)
      .filter((u: any) => u && u.status === 'active');

    // 2. Aggregate tasks assigned and completed per user
    const taskAggregations = await Task.aggregate([
      {
        $match: {
          clientId: clientObjectId,
          assignedTo: { $in: activeUsers.map((u: any) => u._id) },
          createdAt: { $gte: current.start, $lte: current.end },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          totalAssigned: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          breachedCount: { $sum: { $cond: [{ $eq: ['$slaBreached', true] }, 1, 0] } },
          openCount: { $sum: { $cond: [{ $in: ['$status', ['open', 'in_progress']] }, 1, 0] } },
        },
      },
    ]);

    const taskStatsMap = new Map(taskAggregations.map((a) => [a._id.toString(), a]));

    const team = activeUsers.map((user: any) => {
      const stats = taskStatsMap.get(user._id.toString()) || {
        totalAssigned: 0,
        completedCount: 0,
        breachedCount: 0,
        openCount: 0,
      };

      const completionRate =
        stats.totalAssigned > 0
          ? Number(((stats.completedCount / stats.totalAssigned) * 100).toFixed(1))
          : 0;

      return {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        totalAssigned: stats.totalAssigned,
        completed: stats.completedCount,
        open: stats.openCount,
        breached: stats.breachedCount,
        completionRate,
      };
    });

    return {
      dateRange: { preset, ...current },
      team,
    };
  }

  // =========================================================================
  // 7. CONVERSATION ANALYTICS
  // =========================================================================

  public static async getConversationAnalytics(
    clientId: string,
    params: {
      preset?: string;
      startDate?: Date;
      endDate?: Date;
      channel?: string;
    }
  ) {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, preset } = this.resolveDateRange(params.preset, params.startDate, params.endDate);

    const matchConv: any = {
      clientId: clientObjectId,
      createdAt: { $gte: current.start, $lte: current.end },
    };
    if (params.channel) matchConv.channel = params.channel;

    const matchMsg: any = {
      clientId: clientObjectId,
      createdAt: { $gte: current.start, $lte: current.end },
    };
    if (params.channel) matchMsg.channel = params.channel;

    const [channelBreakdown, statusBreakdown, messageStats] = await Promise.all([
      Conversation.aggregate([
        { $match: matchConv },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
      ]),
      Conversation.aggregate([
        { $match: matchConv },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Message.aggregate([
        { $match: matchMsg },
        {
          $group: {
            _id: '$direction',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalConversations = channelBreakdown.reduce((sum, c) => sum + c.count, 0);
    let inboundMessages = 0;
    let outboundMessages = 0;

    for (const m of messageStats) {
      if (m._id === 'inbound') inboundMessages = m.count;
      if (m._id === 'outbound') outboundMessages = m.count;
    }

    return {
      dateRange: { preset, ...current },
      totalConversations,
      channels: channelBreakdown.map((c) => ({ channel: c._id, count: c.count })),
      statuses: statusBreakdown.map((s) => ({ status: s._id, count: s.count })),
      messages: {
        total: inboundMessages + outboundMessages,
        inbound: inboundMessages,
        outbound: outboundMessages,
      },
    };
  }

  // =========================================================================
  // 8. CSV EXPORT WITH RFC-4180 & FORMULA INJECTION DEFENSE
  // =========================================================================

  public static async exportReportCsv(
    clientId: string,
    params: {
      reportType: string;
      preset?: string;
      startDate?: Date;
      endDate?: Date;
      hasFinancialAccess?: boolean;
      limit?: number;
    },
    actor: { id?: string; name?: string; email?: string }
  ): Promise<string> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const { current, preset } = this.resolveDateRange(params.preset, params.startDate, params.endDate);
    const limit = Math.min(Math.max(Number(params.limit) || 1000, 1), 5000);

    const metadata: Record<string, string | number> = {
      'Platform': 'flumenxConectOS',
      'Report Type': params.reportType.toUpperCase(),
      'Date Range Preset': preset,
      'From': current.start.toISOString(),
      'To': current.end.toISOString(),
      'Exported By': actor.name || actor.email || 'Authorized User',
      'Generated At': new Date().toISOString(),
    };

    let headers: string[] = [];
    let rows: (string | number | boolean | null | undefined)[][] = [];

    switch (params.reportType) {
      case 'leads': {
        headers = ['Lead ID', 'Full Name', 'Email', 'Phone', 'Source', 'Stage', 'Score', 'Created At'];
        const leads = await Lead.find({
          clientId: clientObjectId,
          createdAt: { $gte: current.start, $lte: current.end },
          isArchived: false,
        })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();

        rows = leads.map((l: any) => [
          l._id.toString(),
          l.fullName,
          l.email || '',
          l.phone || '',
          l.source,
          l.stage,
          l.leadScore,
          l.createdAt ? new Date(l.createdAt).toISOString() : '',
        ]);
        break;
      }

      case 'tasks': {
        headers = ['Task ID', 'Title', 'Type', 'Priority', 'Status', 'SLA Breached', 'Due Date', 'Created At'];
        const tasks = await Task.find({
          clientId: clientObjectId,
          createdAt: { $gte: current.start, $lte: current.end },
        })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();

        rows = tasks.map((t: any) => [
          t._id.toString(),
          t.title,
          t.taskType,
          t.priority,
          t.status,
          t.slaBreached ? 'YES' : 'NO',
          t.dueAt ? new Date(t.dueAt).toISOString() : '',
          t.createdAt ? new Date(t.createdAt).toISOString() : '',
        ]);
        break;
      }

      case 'campaigns': {
        headers = ['Campaign Name', 'Platform', 'Status', 'Impressions', 'Clicks', 'Leads'];
        if (params.hasFinancialAccess) {
          headers.push('Spend', 'CTR %', 'CPC', 'CPL');
        }

        const analytics = await this.getCampaignAnalytics(clientId, {
          preset,
          startDate: current.start,
          endDate: current.end,
          hasFinancialAccess: params.hasFinancialAccess,
        });

        rows = analytics.campaigns.slice(0, limit).map((c: any) => {
          const base = [c.name, c.platform, c.status, c.impressions, c.clicks, c.leads];
          if (params.hasFinancialAccess) {
            base.push(c.spend ?? 'N/A', c.ctr ?? 'N/A', c.cpc ?? 'N/A', c.cpl ?? 'N/A');
          }
          return base;
        });
        break;
      }

      case 'forms': {
        headers = ['Form Title', 'Status', 'Views', 'Submissions', 'Conversion Rate %', 'Leads Generated'];
        const analytics = await this.getFormAnalytics(clientId, {
          preset,
          startDate: current.start,
          endDate: current.end,
        });

        rows = analytics.forms.slice(0, limit).map((f: any) => [
          f.title,
          f.status,
          f.views,
          f.submissions,
          f.conversionRate ?? 'N/A',
          f.leadsGenerated,
        ]);
        break;
      }

      default: {
        // Overview Summary table
        headers = ['Metric', 'Current Value', 'Comparison Value', 'Change %'];
        const overview = await this.getOverviewKpis(clientId, {
          preset,
          startDate: current.start,
          endDate: current.end,
          hasFinancialAccess: params.hasFinancialAccess,
        });

        rows = [
          ['Total Leads', overview.metrics.totalLeads.value, overview.metrics.totalLeads.previousValue ?? 'N/A', overview.metrics.totalLeads.changePercentage ?? 'N/A'],
          ['Won Leads', overview.metrics.wonLeads.value, overview.metrics.wonLeads.previousValue ?? 'N/A', overview.metrics.wonLeads.changePercentage ?? 'N/A'],
          ['Conversion Rate %', overview.metrics.conversionRate.value, overview.metrics.conversionRate.previousValue ?? 'N/A', overview.metrics.conversionRate.changePercentage ?? 'N/A'],
          ['Form Submissions', overview.metrics.formSubmissions.value, overview.metrics.formSubmissions.previousValue ?? 'N/A', overview.metrics.formSubmissions.changePercentage ?? 'N/A'],
          ['Tasks Completed', overview.metrics.tasksCompleted.value, overview.metrics.tasksCompleted.previousValue ?? 'N/A', overview.metrics.tasksCompleted.changePercentage ?? 'N/A'],
          ['SLA Compliance %', overview.metrics.slaComplianceRate.value, overview.metrics.slaComplianceRate.previousValue ?? 'N/A', overview.metrics.slaComplianceRate.changePercentage ?? 'N/A'],
        ];
      }
    }

    return buildSafeCsv({
      metadata,
      headers,
      rows,
    });
  }

  // =========================================================================
  // 9. SAVED REPORTS (CRUD)
  // =========================================================================

  public static async listSavedReports(clientId: string, userId: string): Promise<ISavedReport[]> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    return SavedReport.find({
      clientId: clientObjectId,
      $or: [{ visibility: 'workspace' }, { createdBy: userObjectId }],
    }).sort({ createdAt: -1 });
  }

  public static async createSavedReport(
    clientId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      reportType: any;
      filters?: Record<string, any>;
      dateRange?: { preset?: string; startDate?: Date; endDate?: Date };
      visibility?: ReportVisibility;
    }
  ): Promise<ISavedReport> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    return SavedReport.create({
      clientId: clientObjectId,
      createdBy: userObjectId,
      name: data.name.trim(),
      description: data.description?.trim(),
      reportType: data.reportType || 'overview',
      filters: data.filters || {},
      dateRange: data.dateRange || { preset: 'last_30_days' },
      visibility: data.visibility || 'workspace',
    });
  }

  public static async getSavedReport(clientId: string, reportId: string, userId: string): Promise<ISavedReport> {
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const reportObjectId = new mongoose.Types.ObjectId(reportId);
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const report = await SavedReport.findOne({
      _id: reportObjectId,
      clientId: clientObjectId,
      $or: [{ visibility: 'workspace' }, { createdBy: userObjectId }],
    });

    if (!report) {
      throw new AppError('Saved report not found', 404);
    }

    return report;
  }

  public static async updateSavedReport(
    clientId: string,
    reportId: string,
    userId: string,
    data: Partial<{
      name: string;
      description?: string;
      reportType: any;
      filters?: Record<string, any>;
      dateRange?: { preset?: string; startDate?: Date; endDate?: Date };
      visibility?: ReportVisibility;
    }>
  ): Promise<ISavedReport> {
    const report = await this.getSavedReport(clientId, reportId, userId);

    if (data.name) report.name = data.name.trim();
    if (data.description !== undefined) report.description = data.description?.trim();
    if (data.reportType) report.reportType = data.reportType;
    if (data.filters) report.filters = data.filters;
    if (data.dateRange) report.dateRange = data.dateRange;
    if (data.visibility) report.visibility = data.visibility;

    return report.save();
  }

  public static async deleteSavedReport(clientId: string, reportId: string, userId: string): Promise<void> {
    const report = await this.getSavedReport(clientId, reportId, userId);
    await report.deleteOne();
  }
}
