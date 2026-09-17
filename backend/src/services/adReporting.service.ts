import mongoose from 'mongoose';
import { AdSpendDaily } from '../models/AdSpendDaily';
import { AdCampaign, IAdCampaign } from '../models/AdCampaign';
import { AdSet, IAdSet } from '../models/AdSet';
import { Ad, IAd } from '../models/Ad';
import { LeadAttribution } from '../models/LeadAttribution';
import { Lead } from '../models/Lead';

export interface AdReportingFilter {
  startDate?: string;
  endDate?: string;
  platform?: 'meta' | 'google';
  campaignId?: string;
}

export interface ExecutiveSummaryReport {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalLeads: number;
  totalAttributedLeads: number;
  ctr: number; // percentage e.g. 2.45%
  cpc: number; // cost per click
  cpm: number; // cost per mille
  cpl: number; // cost per lead
  cpa: number; // cost per acquisition
  verifiedRevenue: number;
  roas: number | null; // null if no verified closed revenue exists
  currency: string;
}

export interface DailyTimeSeriesItem {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  cpc: number;
  ctr: number;
}

export class AdReportingService {
  /**
   * Executive performance summary with clean, audited math.
   * ROAS is never fabricated: returns null if no verified revenue exists.
   */
  static async getExecutiveSummary(
    clientId: string,
    filter: AdReportingFilter
  ): Promise<ExecutiveSummaryReport> {
    const matchQuery: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filter.platform) {
      matchQuery.platform = filter.platform;
    }

    if (filter.startDate || filter.endDate) {
      matchQuery.date = {};
      if (filter.startDate) matchQuery.date.$gte = filter.startDate;
      if (filter.endDate) matchQuery.date.$lte = filter.endDate;
    }

    if (filter.campaignId) {
      matchQuery.externalCampaignId = filter.campaignId;
    }

    // 1. Aggregate spend, impressions, clicks, conversions, leads from AdSpendDaily
    const [spendAgg] = await AdSpendDaily.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$spend' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalConversions: { $sum: '$conversions' },
          totalLeads: { $sum: '$leads' },
        },
      },
    ]);

    const totalSpend = Number((spendAgg?.totalSpend || 0).toFixed(2));
    const totalImpressions = spendAgg?.totalImpressions || 0;
    const totalClicks = spendAgg?.totalClicks || 0;
    const totalConversions = spendAgg?.totalConversions || 0;
    const totalLeads = spendAgg?.totalLeads || 0;

    // 2. Count CRM-attributed Leads
    const attrMatchQuery: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filter.platform) {
      attrMatchQuery.platform = filter.platform;
    }

    if (filter.startDate || filter.endDate) {
      attrMatchQuery.timestamp = {};
      if (filter.startDate) attrMatchQuery.timestamp.$gte = new Date(filter.startDate);
      if (filter.endDate) attrMatchQuery.timestamp.$lte = new Date(filter.endDate);
    }

    const attributedLeadIds = await LeadAttribution.distinct('leadId', attrMatchQuery);
    const totalAttributedLeads = attributedLeadIds.length;

    // 3. Compute Verified Revenue from won/closed CRM leads
    let verifiedRevenue = 0;
    if (attributedLeadIds.length > 0) {
      const wonLeads = await Lead.find({
        _id: { $in: attributedLeadIds },
        clientId: new mongoose.Types.ObjectId(clientId),
        stage: 'won',
      }).select('estimatedValue');

      verifiedRevenue = wonLeads.reduce((acc, l) => acc + (l.estimatedValue || 0), 0);
      verifiedRevenue = Number(verifiedRevenue.toFixed(2));
    }

    // 4. Calculate Core Metrics
    const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
    const cpc = totalClicks > 0 ? Number((totalSpend / totalClicks).toFixed(2)) : 0;
    const cpm = totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : 0;
    const cpl = totalLeads > 0 ? Number((totalSpend / totalLeads).toFixed(2)) : 0;
    const cpa = totalConversions > 0 ? Number((totalSpend / totalConversions).toFixed(2)) : 0;

    // 5. Calculate ROAS without fabrication
    let roas: number | null = null;
    if (verifiedRevenue > 0 && totalSpend > 0) {
      roas = Number((verifiedRevenue / totalSpend).toFixed(2));
    }

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalLeads,
      totalAttributedLeads,
      ctr,
      cpc,
      cpm,
      cpl,
      cpa,
      verifiedRevenue,
      roas,
      currency: 'USD',
    };
  }

  /**
   * Daily performance time-series for charts and trend visualizers.
   */
  static async getTimeSeries(
    clientId: string,
    filter: AdReportingFilter
  ): Promise<DailyTimeSeriesItem[]> {
    const matchQuery: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filter.platform) {
      matchQuery.platform = filter.platform;
    }

    if (filter.startDate || filter.endDate) {
      matchQuery.date = {};
      if (filter.startDate) matchQuery.date.$gte = filter.startDate;
      if (filter.endDate) matchQuery.date.$lte = filter.endDate;
    }

    if (filter.campaignId) {
      matchQuery.externalCampaignId = filter.campaignId;
    }

    const items = await AdSpendDaily.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$date',
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          clicks: { $sum: '$clicks' },
          conversions: { $sum: '$conversions' },
          leads: { $sum: '$leads' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return items.map((item) => {
      const spend = Number((item.spend || 0).toFixed(2));
      const impressions = item.impressions || 0;
      const clicks = item.clicks || 0;
      const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
      const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;

      return {
        date: item._id,
        spend,
        impressions,
        clicks,
        conversions: item.conversions || 0,
        leads: item.leads || 0,
        cpc,
        ctr,
      };
    });
  }

  /**
   * Campaigns breakdown report with spend, clicks, impressions, CPL, CPA, and CRM attributed leads.
   */
  static async getCampaignsReport(
    clientId: string,
    filter: {
      platform?: 'meta' | 'google';
      status?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ campaigns: any[]; total: number; page: number; totalPages: number }> {
    const query: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filter.platform) {
      query.platform = filter.platform;
    }

    if (filter.status) {
      query.status = filter.status.toUpperCase();
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      AdCampaign.find(query)
        .sort({ 'metrics.spend': -1, lastSyncedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdCampaign.countDocuments(query),
    ]);

    // Enhance each campaign with attributed leads count
    const enhancedCampaigns = await Promise.all(
      campaigns.map(async (camp) => {
        const attributedLeadsCount = await LeadAttribution.countDocuments({
          clientId: new mongoose.Types.ObjectId(clientId),
          $or: [
            { campaignId: camp._id },
            { externalCampaignId: camp.externalCampaignId },
          ],
        });

        // Compute CPL and CPA accurately
        const spend = camp.metrics?.spend || 0;
        const leads = camp.metrics?.leads || 0;
        const conversions = camp.metrics?.conversions || 0;
        const clicks = camp.metrics?.clicks || 0;
        const impressions = camp.metrics?.impressions || 0;

        const cpl = leads > 0 ? Number((spend / leads).toFixed(2)) : 0;
        const cpa = conversions > 0 ? Number((spend / conversions).toFixed(2)) : 0;
        const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;
        const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;

        return {
          ...camp,
          metrics: {
            ...camp.metrics,
            cpl,
            cpa,
            cpc,
            ctr,
            attributedLeads: attributedLeadsCount,
          },
        };
      })
    );

    return {
      campaigns: enhancedCampaigns,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get AdSets for a specific campaign or client.
   */
  static async getAdSets(
    clientId: string,
    filter: { campaignId?: string; externalCampaignId?: string; platform?: 'meta' | 'google' }
  ): Promise<any[]> {
    const query: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filter.platform) query.platform = filter.platform;
    if (filter.campaignId) query.campaignId = new mongoose.Types.ObjectId(filter.campaignId);
    if (filter.externalCampaignId) query.externalCampaignId = filter.externalCampaignId;

    return AdSet.find(query).sort({ 'metrics.spend': -1, updatedAt: -1 }).lean();
  }

  /**
   * Get Ads for a specific campaign, ad set, or client.
   */
  static async getAds(
    clientId: string,
    filter: {
      campaignId?: string;
      externalCampaignId?: string;
      adSetId?: string;
      externalAdSetId?: string;
      platform?: 'meta' | 'google';
    }
  ): Promise<any[]> {
    const query: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filter.platform) query.platform = filter.platform;
    if (filter.campaignId) query.campaignId = new mongoose.Types.ObjectId(filter.campaignId);
    if (filter.externalCampaignId) query.externalCampaignId = filter.externalCampaignId;
    if (filter.adSetId) query.adSetId = new mongoose.Types.ObjectId(filter.adSetId);
    if (filter.externalAdSetId) query.externalAdSetId = filter.externalAdSetId;

    return Ad.find(query).sort({ 'metrics.spend': -1, updatedAt: -1 }).lean();
  }
}
