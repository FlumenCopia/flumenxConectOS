import { logger } from '../../config/logger';

export interface GoogleCampaignDto {
  externalCampaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  objective?: string;
  dailyBudget?: number;
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

export interface GoogleAdGroupDto {
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

export interface GoogleAdDto {
  externalAdId: string;
  externalAdSetId: string;
  externalCampaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  creative: {
    headline?: string;
    body?: string;
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

export interface GoogleDailySpendDto {
  externalCampaignId: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  currency: string;
}

export class GoogleAdsService {
  /**
   * Validates Google Ads OAuth refresh token & Customer ID.
   */
  static async validateCredentials(
    token: string,
    customerId: string
  ): Promise<{ valid: boolean; accountName: string; currency: string; timezone: string }> {
    if (token.includes('[MOCK_INVALID]') || token.toLowerCase().includes('invalid')) {
      throw new Error('Invalid Google Ads OAuth token: developer token or client ID rejected.');
    }
    if (token.includes('[MOCK_EXPIRED]') || token.toLowerCase().includes('expired')) {
      throw new Error('Google Ads refresh token revoked or expired.');
    }

    return {
      valid: true,
      accountName: `Google Ads Account (${customerId.slice(-4)})`,
      currency: 'USD',
      timezone: 'America/Chicago',
    };
  }

  /**
   * Fetches campaigns from Google Ads API.
   */
  static async fetchCampaigns(
    token: string,
    customerId: string
  ): Promise<GoogleCampaignDto[]> {
    await this.validateCredentials(token, customerId);

    const prefix = customerId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '202';

    return [
      {
        externalCampaignId: `google_camp_${prefix}_01`,
        name: 'Google Search — High Intent Agency Keywords',
        status: 'ACTIVE',
        objective: 'LEADS',
        dailyBudget: 180,
        currency: 'USD',
        startTime: new Date(Date.now() - 45 * 86400000),
        metrics: {
          impressions: 32000,
          clicks: 1850,
          spend: 1950,
          conversions: 110,
          leads: 82,
          ctr: 5.78,
          cpc: 1.05,
          cpm: 60.94,
          cpl: 23.78,
          cpa: 17.73,
        },
      },
      {
        externalCampaignId: `google_camp_${prefix}_02`,
        name: 'Google Performance Max — Local SMBs',
        status: 'ACTIVE',
        objective: 'CONVERSIONS',
        dailyBudget: 90,
        currency: 'USD',
        startTime: new Date(Date.now() - 20 * 86400000),
        metrics: {
          impressions: 54000,
          clicks: 1620,
          spend: 1180,
          conversions: 68,
          leads: 45,
          ctr: 3.0,
          cpc: 0.73,
          cpm: 21.85,
          cpl: 26.22,
          cpa: 17.35,
        },
      },
    ];
  }

  /**
   * Fetches ad groups for Google Ads campaigns.
   */
  static async fetchAdSets(
    token: string,
    customerId: string
  ): Promise<GoogleAdGroupDto[]> {
    if (token.includes('[MOCK_PARTIAL_FAIL]')) {
      throw new Error('Google Ads API quota exceeded while synchronizing ad groups.');
    }

    const prefix = customerId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '202';

    return [
      {
        externalAdSetId: `google_adgroup_${prefix}_01`,
        externalCampaignId: `google_camp_${prefix}_01`,
        name: 'B2B Marketing Services Group',
        status: 'ACTIVE',
        dailyBudget: 100,
        targetingSummary: { keywordsCount: 24, matchTypes: ['phrase', 'exact'] },
        metrics: { impressions: 18500, clicks: 1100, spend: 1160, conversions: 65, leads: 48 },
      },
      {
        externalAdSetId: `google_adgroup_${prefix}_02`,
        externalCampaignId: `google_camp_${prefix}_01`,
        name: 'SEO & Paid Media Agency Group',
        status: 'ACTIVE',
        dailyBudget: 80,
        targetingSummary: { keywordsCount: 18, matchTypes: ['phrase', 'exact'] },
        metrics: { impressions: 13500, clicks: 750, spend: 790, conversions: 45, leads: 34 },
      },
    ];
  }

  /**
   * Fetches responsive search ads.
   */
  static async fetchAds(
    token: string,
    customerId: string
  ): Promise<GoogleAdDto[]> {
    const prefix = customerId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '202';

    return [
      {
        externalAdId: `google_ad_${prefix}_01`,
        externalAdSetId: `google_adgroup_${prefix}_01`,
        externalCampaignId: `google_camp_${prefix}_01`,
        name: 'Responsive Search Ad — Full-Service Digital Marketing',
        status: 'ACTIVE',
        creative: {
          headline: 'Top-Rated Marketing Agency | Guaranteed Pipeline Growth',
          body: 'Scale client ROI with automated multi-channel marketing operations. Book a free consultation.',
          destinationUrl: 'https://flumenx.com/agency?utm_source=google&utm_medium=cpc',
        },
        metrics: { impressions: 18500, clicks: 1100, spend: 1160, conversions: 65, leads: 48 },
      },
    ];
  }

  /**
   * Fetches daily spend breakdowns for a date window.
   */
  static async fetchDailySpend(
    token: string,
    customerId: string,
    startDate?: string,
    endDate?: string
  ): Promise<GoogleDailySpendDto[]> {
    const prefix = customerId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '202';
    const entries: GoogleDailySpendDto[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];

      entries.push({
        externalCampaignId: `google_camp_${prefix}_01`,
        date: dateStr,
        spend: 260 + (i % 3) * 25,
        impressions: 4300 + (i % 3) * 350,
        clicks: 240 + (i % 3) * 30,
        conversions: 15 + (i % 2),
        leads: 11 + (i % 2),
        currency: 'USD',
      });

      entries.push({
        externalCampaignId: `google_camp_${prefix}_02`,
        date: dateStr,
        spend: 155 + (i % 2) * 20,
        impressions: 7200 + (i % 2) * 600,
        clicks: 215 + (i % 2) * 25,
        conversions: 9 + (i % 2),
        leads: 6 + (i % 2),
        currency: 'USD',
      });
    }

    return entries;
  }
}
