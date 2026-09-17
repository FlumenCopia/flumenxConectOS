import mongoose from 'mongoose';
import { LeadAttribution, ILeadAttribution, TouchType, AttributionPlatform, AttributionSourceType } from '../models/LeadAttribution';
import { AdCampaign } from '../models/AdCampaign';
import { Lead } from '../models/Lead';
import { logger } from '../config/logger';

export interface RecordAttributionParams {
  clientId: string | mongoose.Types.ObjectId;
  leadId: string | mongoose.Types.ObjectId;
  contactId?: string | mongoose.Types.ObjectId;
  formSubmissionId?: string | mongoose.Types.ObjectId;
  utmParams?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
  clickId?: string;
  landingPageUrl?: string;
  referrer?: string;
  timestamp?: Date;
  attributionSource?: AttributionSourceType;
  metadata?: Record<string, any>;
}

export interface AttributionFilterParams {
  leadId?: string;
  touchType?: TouchType;
  platform?: AttributionPlatform;
  campaignId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class AdAttributionService {
  /**
   * Helper to parse query parameters from a URL string safely.
   */
  private static parseUrlParams(urlStr?: string): {
    utms: Record<string, string>;
    clickId?: string;
  } {
    const result: { utms: Record<string, string>; clickId?: string } = { utms: {} };
    if (!urlStr) return result;

    try {
      const url = new URL(urlStr.startsWith('http') ? urlStr : `https://example.com/${urlStr.replace(/^\//, '')}`);
      const params = url.searchParams;

      if (params.get('utm_source')) result.utms.utmSource = params.get('utm_source')!.trim().toLowerCase();
      if (params.get('utm_medium')) result.utms.utmMedium = params.get('utm_medium')!.trim().toLowerCase();
      if (params.get('utm_campaign')) result.utms.utmCampaign = params.get('utm_campaign')!.trim();
      if (params.get('utm_term')) result.utms.utmTerm = params.get('utm_term')!.trim();
      if (params.get('utm_content')) result.utms.utmContent = params.get('utm_content')!.trim();

      if (params.get('fbclid')) result.clickId = params.get('fbclid')!.trim();
      if (params.get('gclid')) result.clickId = params.get('gclid')!.trim();
    } catch {
      // Fallback regex if URL parsing fails on raw queries
      const fbMatch = urlStr.match(/[?&]fbclid=([^&#]+)/i);
      if (fbMatch) result.clickId = decodeURIComponent(fbMatch[1]);
      const gMatch = urlStr.match(/[?&]gclid=([^&#]+)/i);
      if (gMatch) result.clickId = decodeURIComponent(gMatch[1]);
      const srcMatch = urlStr.match(/[?&]utm_source=([^&#]+)/i);
      if (srcMatch) result.utms.utmSource = decodeURIComponent(srcMatch[1]).toLowerCase();
      const medMatch = urlStr.match(/[?&]utm_medium=([^&#]+)/i);
      if (medMatch) result.utms.utmMedium = decodeURIComponent(medMatch[1]).toLowerCase();
      const cmpMatch = urlStr.match(/[?&]utm_campaign=([^&#]+)/i);
      if (cmpMatch) result.utms.utmCampaign = decodeURIComponent(cmpMatch[1]);
    }

    return result;
  }

  /**
   * Determine attribution platform from UTMs, Click IDs, and Referrer.
   */
  private static detectPlatform(
    clickId?: string,
    utmSource?: string,
    utmMedium?: string,
    referrer?: string
  ): AttributionPlatform {
    const src = (utmSource || '').toLowerCase();
    const med = (utmMedium || '').toLowerCase();
    const cid = (clickId || '').toLowerCase();
    const ref = (referrer || '').toLowerCase();

    // 1. Meta / Facebook / Instagram
    if (cid.startsWith('fb') || src.includes('meta') || src.includes('facebook') || src.includes('instagram')) {
      return 'meta';
    }

    // 2. Google Ads
    if (cid.startsWith('c') || cid.startsWith('g') || src.includes('google') || src.includes('adwords')) {
      if (cid || med === 'cpc' || med === 'ppc' || med === 'paid_search') {
        return 'google';
      }
    }

    // 3. Organic Search
    if (ref.includes('google.') || ref.includes('bing.') || ref.includes('yahoo.') || ref.includes('duckduckgo.')) {
      return 'organic';
    }

    // 4. Direct
    if (!ref && !src) {
      return 'direct';
    }

    // 5. Referral
    if (ref && !ref.includes('google') && !ref.includes('facebook') && !ref.includes('instagram')) {
      return 'referral';
    }

    return 'other';
  }

  /**
   * Record a lead attribution touchpoint.
   * Enforces the immutability of the 'first_touch' record!
   */
  static async recordLeadAttribution(params: RecordAttributionParams): Promise<ILeadAttribution> {
    const {
      clientId,
      leadId,
      contactId,
      formSubmissionId,
      utmParams = {},
      landingPageUrl,
      referrer,
      timestamp = new Date(),
      attributionSource = 'utm',
      metadata = {},
    } = params;

    // Parse URL query params if landingPageUrl provided
    const parsed = this.parseUrlParams(landingPageUrl);
    const finalUtmSource = utmParams.utmSource || parsed.utms.utmSource;
    const finalUtmMedium = utmParams.utmMedium || parsed.utms.utmMedium;
    const finalUtmCampaign = utmParams.utmCampaign || parsed.utms.utmCampaign;
    const finalUtmTerm = utmParams.utmTerm || parsed.utms.utmTerm;
    const finalUtmContent = utmParams.utmContent || parsed.utms.utmContent;
    const finalClickId = params.clickId || parsed.clickId;

    // Detect Platform
    const platform = this.detectPlatform(finalClickId, finalUtmSource, finalUtmMedium, referrer);

    // Resolve matching AdCampaign in database if platform is meta or google
    let matchedCampaign: any = null;
    if ((platform === 'meta' || platform === 'google') && finalUtmCampaign) {
      matchedCampaign = await AdCampaign.findOne({
        clientId: new mongoose.Types.ObjectId(clientId.toString()),
        platform,
        $or: [
          { externalCampaignId: finalUtmCampaign },
          { name: { $regex: new RegExp(`^${finalUtmCampaign.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') } },
        ],
      });
    }

    // Multi-touch logic: Check for existing first_touch record for this lead
    const existingFirstTouch = await LeadAttribution.findOne({
      clientId: new mongoose.Types.ObjectId(clientId.toString()),
      leadId: new mongoose.Types.ObjectId(leadId.toString()),
      touchType: 'first_touch',
    });

    let touchType: TouchType;

    if (!existingFirstTouch) {
      // First ever touch for this lead!
      touchType = 'first_touch';

      // Update CRM Lead source details if matched
      try {
        const lead = await Lead.findOne({
          _id: new mongoose.Types.ObjectId(leadId.toString()),
          clientId: new mongoose.Types.ObjectId(clientId.toString()),
        });

        if (lead) {
          if (platform === 'meta') lead.source = 'meta_ads';
          else if (platform === 'google') lead.source = 'google_ads';
          else if (platform === 'organic') lead.source = 'organic';

          if (matchedCampaign) {
            lead.campaignName = matchedCampaign.name;
            lead.campaignId = matchedCampaign.externalCampaignId;
          } else if (finalUtmCampaign) {
            lead.campaignName = finalUtmCampaign;
          }

          if (landingPageUrl && !lead.landingPageUrl) {
            lead.landingPageUrl = landingPageUrl;
          }

          await lead.save();
        }
      } catch (leadUpdateErr) {
        logger.warn(`Failed to update Lead source fields during attribution: ${leadUpdateErr}`);
      }

      // Increment campaign leads metric if matched
      if (matchedCampaign) {
        await AdCampaign.updateOne(
          { _id: matchedCampaign._id },
          { $inc: { 'metrics.leads': 1 } }
        );
      }
    } else {
      // First touch already exists and MUST be preserved untouched!
      // Demote previous last_touch to multi_touch if one exists
      await LeadAttribution.updateMany(
        {
          clientId: new mongoose.Types.ObjectId(clientId.toString()),
          leadId: new mongoose.Types.ObjectId(leadId.toString()),
          touchType: 'last_touch',
        },
        { touchType: 'multi_touch' }
      );

      touchType = 'last_touch';
    }

    const attribution = await LeadAttribution.create({
      clientId: new mongoose.Types.ObjectId(clientId.toString()),
      leadId: new mongoose.Types.ObjectId(leadId.toString()),
      contactId: contactId ? new mongoose.Types.ObjectId(contactId.toString()) : undefined,
      formSubmissionId: formSubmissionId ? new mongoose.Types.ObjectId(formSubmissionId.toString()) : undefined,
      touchType,
      platform,
      campaignId: matchedCampaign ? matchedCampaign._id : undefined,
      externalCampaignId: matchedCampaign ? matchedCampaign.externalCampaignId : (finalUtmCampaign || undefined),
      campaignName: matchedCampaign ? matchedCampaign.name : (finalUtmCampaign || undefined),
      clickId: finalClickId,
      utmSource: finalUtmSource,
      utmMedium: finalUtmMedium,
      utmCampaign: finalUtmCampaign,
      utmTerm: finalUtmTerm,
      utmContent: finalUtmContent,
      landingPageUrl,
      referrer,
      timestamp,
      confidence: finalClickId ? 1.0 : finalUtmSource ? 0.9 : 0.7,
      attributionSource: finalClickId ? 'click_id' : attributionSource,
      metadata,
    });

    return attribution;
  }

  /**
   * Helper to process attribution from a FormSubmission instance.
   */
  static async recordAttributionFromSubmission(
    submission: any,
    lead: any,
    contact?: any
  ): Promise<ILeadAttribution | null> {
    if (!submission || !lead) return null;

    try {
      const payload = submission.payload || {};
      const sourceUrl = submission.sourceUrl || '';
      const referrer = submission.referrer || '';

      // Check for UTM parameters inside payload or sourceUrl
      const utmSource = payload.utm_source || payload.utmSource;
      const utmMedium = payload.utm_medium || payload.utmMedium;
      const utmCampaign = payload.utm_campaign || payload.utmCampaign;
      const utmTerm = payload.utm_term || payload.utmTerm;
      const utmContent = payload.utm_content || payload.utmContent;
      const clickId = payload.fbclid || payload.gclid || payload.click_id || payload.clickId;

      return await this.recordLeadAttribution({
        clientId: submission.clientId,
        leadId: lead._id,
        contactId: contact?._id,
        formSubmissionId: submission._id,
        utmParams: {
          utmSource,
          utmMedium,
          utmCampaign,
          utmTerm,
          utmContent,
        },
        clickId,
        landingPageUrl: sourceUrl,
        referrer,
        attributionSource: 'form_metadata',
      });
    } catch (err) {
      logger.error('Error recording attribution from form submission:', err);
      return null;
    }
  }

  /**
   * Query attribution records with tenant isolation, filters, and pagination.
   */
  static async getLeadAttributions(
    clientId: string,
    filter: AttributionFilterParams
  ): Promise<{ attributions: ILeadAttribution[]; total: number; page: number; totalPages: number }> {
    const query: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (filter.leadId) {
      query.leadId = new mongoose.Types.ObjectId(filter.leadId);
    }
    if (filter.touchType) {
      query.touchType = filter.touchType;
    }
    if (filter.platform) {
      query.platform = filter.platform;
    }
    if (filter.campaignId) {
      query.$or = [
        { campaignId: new mongoose.Types.ObjectId(filter.campaignId) },
        { externalCampaignId: filter.campaignId },
      ];
    }
    if (filter.startDate || filter.endDate) {
      query.timestamp = {};
      if (filter.startDate) query.timestamp.$gte = new Date(filter.startDate);
      if (filter.endDate) query.timestamp.$lte = new Date(filter.endDate);
    }

    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const [attributions, total] = await Promise.all([
      LeadAttribution.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('leadId', 'fullName email phone stage estimatedValue')
        .populate('campaignId', 'name platform status')
        .lean(),
      LeadAttribution.countDocuments(query),
    ]);

    return {
      attributions: attributions as any,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get an aggregate summary of lead attributions for a client.
   */
  static async getAttributionSummary(
    clientId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    byPlatform: Record<string, number>;
    byTouchType: Record<string, number>;
    topCampaigns: Array<{ campaignName: string; platform: string; count: number }>;
    totalAttributedLeads: number;
  }> {
    const matchQuery: any = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    }

    const [platformAgg, touchTypeAgg, campaignAgg, distinctLeads] = await Promise.all([
      LeadAttribution.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$platform', count: { $sum: 1 } } },
      ]),
      LeadAttribution.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$touchType', count: { $sum: 1 } } },
      ]),
      LeadAttribution.aggregate([
        { $match: { ...matchQuery, campaignName: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: { campaignName: '$campaignName', platform: '$platform' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      LeadAttribution.distinct('leadId', matchQuery),
    ]);

    const byPlatform: Record<string, number> = {
      meta: 0,
      google: 0,
      organic: 0,
      direct: 0,
      referral: 0,
      other: 0,
    };
    for (const item of platformAgg) {
      if (item._id) byPlatform[item._id] = item.count;
    }

    const byTouchType: Record<string, number> = {
      first_touch: 0,
      last_touch: 0,
      multi_touch: 0,
    };
    for (const item of touchTypeAgg) {
      if (item._id) byTouchType[item._id] = item.count;
    }

    const topCampaigns = campaignAgg.map((item) => ({
      campaignName: item._id.campaignName,
      platform: item._id.platform,
      count: item.count,
    }));

    return {
      byPlatform,
      byTouchType,
      topCampaigns,
      totalAttributedLeads: distinctLeads.length,
    };
  }
}
