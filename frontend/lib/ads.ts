import { apiClient, ApiResponse } from './api';

export type AdPlatform = 'meta' | 'google';
export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';
export type TouchType = 'first_touch' | 'last_touch' | 'multi_touch';

export interface AdPlatformConnectionItem {
  _id: string;
  clientId: string;
  platform: AdPlatform;
  accountName: string;
  accountId: string;
  status: ConnectionStatus;
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'partial' | 'failed';
  lastSyncError?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AdCampaignMetrics {
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
  roas?: number;
  attributedLeads?: number;
}

export interface AdCampaignItem {
  _id: string;
  clientId: string;
  connectionId: string;
  platform: AdPlatform;
  externalCampaignId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'REMOVED' | 'UNKNOWN';
  objective?: string;
  dailyBudget?: number;
  lifetimeBudget?: number;
  currency: string;
  startTime?: string;
  endTime?: string;
  metrics: AdCampaignMetrics;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdSetItem {
  _id: string;
  clientId: string;
  connectionId: string;
  campaignId: string;
  externalCampaignId: string;
  externalAdSetId: string;
  name: string;
  status: string;
  platform: AdPlatform;
  dailyBudget?: number;
  targeting?: Record<string, any>;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    leads: number;
  };
}

export interface AdCreativeItem {
  _id: string;
  clientId: string;
  connectionId: string;
  campaignId: string;
  adSetId?: string;
  externalAdId: string;
  name: string;
  status: string;
  platform: AdPlatform;
  headline?: string;
  bodyText?: string;
  destinationUrl?: string;
  imageUrl?: string;
  metrics: {
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    leads: number;
  };
}

export interface ExecutiveSummaryReport {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalLeads: number;
  totalAttributedLeads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  cpa: number;
  verifiedRevenue: number;
  roas: number | null;
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

export interface LeadAttributionItem {
  _id: string;
  clientId: string;
  leadId: {
    _id: string;
    fullName: string;
    email?: string;
    phone?: string;
    stage: string;
    estimatedValue?: number;
  };
  touchType: TouchType;
  platform: 'meta' | 'google' | 'organic' | 'direct' | 'referral' | 'other';
  campaignName?: string;
  externalCampaignId?: string;
  adSetName?: string;
  adName?: string;
  clickId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPageUrl?: string;
  referrer?: string;
  timestamp: string;
  confidence: number;
  attributionSource: string;
  createdAt: string;
}

export interface AttributionSummaryReport {
  byPlatform: Record<string, number>;
  byTouchType: Record<string, number>;
  topCampaigns: Array<{ campaignName: string; platform: string; count: number }>;
  totalAttributedLeads: number;
}

// -------------------------------------------------------------
// Connection Management APIs
// -------------------------------------------------------------

export const getAdConnectionsApi = async () => {
  const response = await apiClient.get<ApiResponse<AdPlatformConnectionItem[]>>('/ads/connections');
  return response.data;
};

export const createAdConnectionApi = async (payload: {
  platform: AdPlatform;
  accountName: string;
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  metadata?: Record<string, any>;
}) => {
  const response = await apiClient.post<ApiResponse<AdPlatformConnectionItem>>('/ads/connections', payload);
  return response.data;
};

export const updateConnectionStatusApi = async (id: string, status: ConnectionStatus) => {
  const response = await apiClient.put<ApiResponse<AdPlatformConnectionItem>>(`/ads/connections/${id}/status`, { status });
  return response.data;
};

export const revokeAdConnectionApi = async (id: string) => {
  const response = await apiClient.delete<ApiResponse<AdPlatformConnectionItem>>(`/ads/connections/${id}`);
  return response.data;
};

export const syncAdConnectionApi = async (id: string) => {
  const response = await apiClient.post<ApiResponse<any>>(`/ads/connections/${id}/sync`);
  return response.data;
};

export const syncAllAdConnectionsApi = async () => {
  const response = await apiClient.post<ApiResponse<any>>('/ads/sync-all');
  return response.data;
};

// -------------------------------------------------------------
// Reporting APIs
// -------------------------------------------------------------

export const getReportingSummaryApi = async (filters: {
  platform?: string;
  startDate?: string;
  endDate?: string;
  campaignId?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.platform && filters.platform !== 'all') query.set('platform', filters.platform);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  if (filters.campaignId) query.set('campaignId', filters.campaignId);

  const response = await apiClient.get<ApiResponse<ExecutiveSummaryReport>>(
    `/ads/reporting/summary?${query.toString()}`
  );
  return response.data;
};

export const getReportingTimeSeriesApi = async (filters: {
  platform?: string;
  startDate?: string;
  endDate?: string;
  campaignId?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.platform && filters.platform !== 'all') query.set('platform', filters.platform);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  if (filters.campaignId) query.set('campaignId', filters.campaignId);

  const response = await apiClient.get<ApiResponse<DailyTimeSeriesItem[]>>(
    `/ads/reporting/timeseries?${query.toString()}`
  );
  return response.data;
};

export const getAdCampaignsApi = async (filters: {
  platform?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.platform && filters.platform !== 'all') query.set('platform', filters.platform);
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  if (filters.page) query.set('page', filters.page.toString());
  if (filters.limit) query.set('limit', filters.limit.toString());

  const response = await apiClient.get<
    ApiResponse<{
      campaigns: AdCampaignItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/ads/campaigns?${query.toString()}`);
  return response.data;
};

export const getAdSetsApi = async (filters: {
  campaignId?: string;
  externalCampaignId?: string;
  platform?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.campaignId) query.set('campaignId', filters.campaignId);
  if (filters.externalCampaignId) query.set('externalCampaignId', filters.externalCampaignId);
  if (filters.platform && filters.platform !== 'all') query.set('platform', filters.platform);

  const response = await apiClient.get<ApiResponse<AdSetItem[]>>(`/ads/ad-sets?${query.toString()}`);
  return response.data;
};

export const getAdCreativesApi = async (filters: {
  campaignId?: string;
  externalCampaignId?: string;
  adSetId?: string;
  externalAdSetId?: string;
  platform?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.campaignId) query.set('campaignId', filters.campaignId);
  if (filters.externalCampaignId) query.set('externalCampaignId', filters.externalCampaignId);
  if (filters.adSetId) query.set('adSetId', filters.adSetId);
  if (filters.externalAdSetId) query.set('externalAdSetId', filters.externalAdSetId);
  if (filters.platform && filters.platform !== 'all') query.set('platform', filters.platform);

  const response = await apiClient.get<ApiResponse<AdCreativeItem[]>>(`/ads/ad-creatives?${query.toString()}`);
  return response.data;
};

// -------------------------------------------------------------
// Attribution APIs
// -------------------------------------------------------------

export const getLeadAttributionsApi = async (filters: {
  leadId?: string;
  touchType?: string;
  platform?: string;
  campaignId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.leadId) query.set('leadId', filters.leadId);
  if (filters.touchType && filters.touchType !== 'all') query.set('touchType', filters.touchType);
  if (filters.platform && filters.platform !== 'all') query.set('platform', filters.platform);
  if (filters.campaignId) query.set('campaignId', filters.campaignId);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  if (filters.page) query.set('page', filters.page.toString());
  if (filters.limit) query.set('limit', filters.limit.toString());

  const response = await apiClient.get<
    ApiResponse<{
      attributions: LeadAttributionItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/ads/attributions?${query.toString()}`);
  return response.data;
};

export const getAttributionSummaryApi = async (startDate?: string, endDate?: string) => {
  const query = new URLSearchParams();
  if (startDate) query.set('startDate', startDate);
  if (endDate) query.set('endDate', endDate);

  const response = await apiClient.get<ApiResponse<AttributionSummaryReport>>(
    `/ads/attributions/summary?${query.toString()}`
  );
  return response.data;
};
