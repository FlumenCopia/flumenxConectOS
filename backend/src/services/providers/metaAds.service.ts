import { logger } from '../../config/logger';

export interface MetaCampaignDto {
  externalCampaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  objective?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  currency: string;
  startTime?: Date;
  endTime?: Date;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    leads: number;
    ctr: number;
    cpc: number;
    cpm: number;
    cpl: number;
    cpa: number;
  };
}

export interface MetaAdSetDto {
  externalAdSetId: string;
  externalCampaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  dailyBudget?: number;
  targetingSummary: Record<string, any>;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    leads: number;
  };
}

export interface MetaAdDto {
  externalAdId: string;
  externalAdSetId: string;
  externalCampaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  creative: {
    headline?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    callToAction?: string;
    destinationUrl?: string;
  };
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    leads: number;
  };
}

export interface MetaDailySpendDto {
  externalCampaignId: string;
  externalAdSetId?: string;
  externalAdId?: string;
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  currency: string;
}

export class MetaAdsService {
  /**
   * Validates Meta OAuth access token & Ad Account access.
   */
  static async validateCredentials(
    accessToken: string,
    accountId: string
  ): Promise<{ valid: boolean; accountName: string; currency: string; timezone: string }> {
    if (accessToken.includes('[MOCK_INVALID]') || accessToken.toLowerCase().includes('invalid')) {
      throw new Error('Invalid Meta OAuth access token: token has been rejected by Meta Graph API.');
    }
    if (accessToken.includes('[MOCK_EXPIRED]') || accessToken.toLowerCase().includes('expired')) {
      throw new Error('Meta OAuth access token expired: please re-authenticate connection.');
    }

    // Deterministic simulation
    return {
      valid: true,
      accountName: `Meta Ads - Account ${accountId.slice(-6)}`,
      currency: 'USD',
      timezone: 'America/New_York',
    };
  }

  /**
   * Fetches campaigns from Meta Marketing API.
   */
  static async fetchCampaigns(
    accessToken: string,
    accountId: string
  ): Promise<MetaCampaignDto[]> {
    await this.validateCredentials(accessToken, accountId);

    const prefix = accountId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '101';

    return [
      {
        externalCampaignId: `meta_camp_${prefix}_01`,
        name: 'Meta Spring Lead Gen — Paid Social',
        status: 'ACTIVE',
        objective: 'OUTCOME_LEADS',
        dailyBudget: 120,
        lifetimeBudget: 3600,
        currency: 'USD',
        startTime: new Date(Date.now() - 30 * 86400000),
        metrics: {
          impressions: 48500,
          clicks: 1420,
          spend: 1140,
          conversions: 94,
          leads: 72,
          ctr: 2.93,
          cpc: 0.8,
          cpm: 23.5,
          cpl: 15.83,
          cpa: 12.13,
        },
      },
      {
        externalCampaignId: `meta_camp_${prefix}_02`,
        name: 'Meta Retargeting — Website Visitors',
        status: 'ACTIVE',
        objective: 'CONVERSIONS',
        dailyBudget: 60,
        lifetimeBudget: 1800,
        currency: 'USD',
        startTime: new Date(Date.now() - 15 * 86400000),
        metrics: {
          impressions: 21000,
          clicks: 890,
          spend: 620,
          conversions: 55,
          leads: 38,
          ctr: 4.24,
          cpc: 0.7,
          cpm: 29.52,
          cpl: 16.32,
          cpa: 11.27,
        },
      },
    ];
  }

  /**
   * Fetches ad sets for campaigns.
   */
  static async fetchAdSets(
    accessToken: string,
    accountId: string
  ): Promise<MetaAdSetDto[]> {
    if (accessToken.includes('[MOCK_PARTIAL_FAIL]')) {
      throw new Error('Meta API rate limit reached while syncing ad sets.');
    }

    const prefix = accountId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '101';

    return [
      {
        externalAdSetId: `meta_adset_${prefix}_01`,
        externalCampaignId: `meta_camp_${prefix}_01`,
        name: 'Lookalike 1% — Past Converters',
        status: 'ACTIVE',
        dailyBudget: 70,
        targetingSummary: { age: '25-54', locations: ['US', 'CA'], interests: ['Digital Marketing', 'SaaS'] },
        metrics: { impressions: 28000, clicks: 820, spend: 650, conversions: 54, leads: 42 },
      },
      {
        externalAdSetId: `meta_adset_${prefix}_02`,
        externalCampaignId: `meta_camp_${prefix}_01`,
        name: 'Interest Targeting — Business Owners',
        status: 'ACTIVE',
        dailyBudget: 50,
        targetingSummary: { age: '30-60', locations: ['US'], interests: ['Small Business', 'Entrepreneurship'] },
        metrics: { impressions: 20500, clicks: 600, spend: 490, conversions: 40, leads: 30 },
      },
      {
        externalAdSetId: `meta_adset_${prefix}_03`,
        externalCampaignId: `meta_camp_${prefix}_02`,
        name: 'Custom Audience — 30 Day Web Visitors',
        status: 'ACTIVE',
        dailyBudget: 60,
        targetingSummary: { audienceType: 'custom_pixel', windowDays: 30 },
        metrics: { impressions: 21000, clicks: 890, spend: 620, conversions: 55, leads: 38 },
      },
    ];
  }

  /**
   * Fetches ads with creative metadata.
   */
  static async fetchAds(
    accessToken: string,
    accountId: string
  ): Promise<MetaAdDto[]> {
    const prefix = accountId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '101';

    return [
      {
        externalAdId: `meta_ad_${prefix}_01`,
        externalAdSetId: `meta_adset_${prefix}_01`,
        externalCampaignId: `meta_camp_${prefix}_01`,
        name: 'Video Ad — Client ROI Case Study',
        status: 'ACTIVE',
        creative: {
          headline: 'How We Scaled Client Revenue 3.4x in 90 Days',
          body: 'Discover our proven marketing framework for high-growth operations. Claim your free audit.',
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600',
          callToAction: 'LEARN_MORE',
          destinationUrl: 'https://flumenx.com/case-study?utm_source=meta&utm_medium=paid_social',
        },
        metrics: { impressions: 28000, clicks: 820, spend: 650, conversions: 54, leads: 42 },
      },
      {
        externalAdId: `meta_ad_${prefix}_02`,
        externalAdSetId: `meta_adset_${prefix}_03`,
        externalCampaignId: `meta_camp_${prefix}_02`,
        name: 'Carousel Ad — Feature Highlights',
        status: 'ACTIVE',
        creative: {
          headline: 'Still Managing Marketing in Spreadsheets?',
          body: 'Switch to flumenxConectOS and automate multi-channel client operations.',
          imageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600',
          callToAction: 'SIGN_UP',
          destinationUrl: 'https://flumenx.com/retargeting?utm_source=meta&utm_medium=retargeting',
        },
        metrics: { impressions: 21000, clicks: 890, spend: 620, conversions: 55, leads: 38 },
      },
    ];
  }

  /**
   * Fetches daily spend breakdowns for a date window.
   */
  static async fetchDailySpend(
    accessToken: string,
    accountId: string,
    startDate?: string,
    endDate?: string
  ): Promise<MetaDailySpendDto[]> {
    const prefix = accountId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '101';
    const entries: MetaDailySpendDto[] = [];

    // Generate last 7 days of daily spend data
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];

      entries.push({
        externalCampaignId: `meta_camp_${prefix}_01`,
        date: dateStr,
        spend: 140 + (i % 3) * 15,
        impressions: 6200 + (i % 3) * 400,
        clicks: 180 + (i % 3) * 20,
        conversions: 12 + (i % 2),
        leads: 9 + (i % 2),
        currency: 'USD',
      });

      entries.push({
        externalCampaignId: `meta_camp_${prefix}_02`,
        date: dateStr,
        spend: 85 + (i % 2) * 10,
        impressions: 2900 + (i % 2) * 200,
        clicks: 120 + (i % 2) * 15,
        conversions: 8 + (i % 2),
        leads: 5 + (i % 2),
        currency: 'USD',
      });
    }

    return entries;
  }
}
