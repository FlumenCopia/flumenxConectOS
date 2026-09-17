import { apiClient, ApiResponse } from './api';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'previous_month'
  | 'custom';

export interface MetricWithDelta {
  value: number | null;
  previousValue?: number | null;
  changePercentage: number | null;
}

export interface OverviewMetrics {
  totalLeads: MetricWithDelta;
  wonLeads: MetricWithDelta;
  conversionRate: MetricWithDelta;
  formSubmissions: MetricWithDelta;
  tasksCompleted: MetricWithDelta;
  slaComplianceRate: MetricWithDelta;
  activeConversations: MetricWithDelta;
  totalSpend?: MetricWithDelta;
  closedRevenue?: MetricWithDelta;
  roas?: MetricWithDelta;
}

export interface OverviewReportData {
  dateRange: {
    preset: string;
    current: { start: string; end: string };
    previous: { start: string; end: string } | null;
  };
  metrics: OverviewMetrics;
}

export interface LeadAnalyticsData {
  dateRange: { preset: string; start: string; end: string };
  totalLeads: number;
  trend: Array<{ date: string; total: number; won: number; lost: number }>;
  sources: Array<{
    source: string;
    count: number;
    percentage: number;
    wonCount: number;
    conversionRate: number;
  }>;
  stages: Array<{
    stage: string;
    count: number;
    percentage: number;
    totalValue?: number;
  }>;
  scoreTiers: Array<{ tier: string; count: number }>;
}

export interface CampaignItemPerformance {
  campaignId: string;
  name: string;
  platform: string;
  status: string;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  spend?: number | null;
}

export interface CampaignAnalyticsData {
  dateRange: { preset: string; start: string; end: string };
  platforms: Array<{ platform: string; attributedLeads: number }>;
  touchpoints: Array<{ type: string; count: number }>;
  campaigns: CampaignItemPerformance[];
}

export interface FormItemPerformance {
  formId: string;
  title: string;
  status: string;
  views: number;
  submissions: number;
  conversionRate: number | null;
  leadsGenerated: number;
}

export interface FormAnalyticsData {
  dateRange: { preset: string; start: string; end: string };
  trend: Array<{ date: string; submissions: number }>;
  forms: FormItemPerformance[];
}

export interface TaskAndSlaAnalyticsData {
  dateRange: { preset: string; start: string; end: string };
  totalCompleted: number;
  slaComplianceRate: number;
  breachedCount: number;
  avgResolutionMinutes: number | null;
  statusBreakdown: Array<{ status: string; count: number }>;
  priorityBreakdown: Array<{ priority: string; count: number }>;
  dispositionBreakdown: Array<{ disposition: string; count: number }>;
}

export interface TeamMemberProductivity {
  userId: string;
  name: string;
  email: string;
  totalAssigned: number;
  completed: number;
  open: number;
  breached: number;
  completionRate: number;
}

export interface TeamProductivityData {
  dateRange: { preset: string; start: string; end: string };
  team: TeamMemberProductivity[];
}

export interface ConversationAnalyticsData {
  dateRange: { preset: string; start: string; end: string };
  totalConversations: number;
  channels: Array<{ channel: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
  messages: {
    total: number;
    inbound: number;
    outbound: number;
  };
}

export interface SavedReportItem {
  _id: string;
  clientId: string;
  createdBy: { _id: string; name: string; email: string } | string;
  name: string;
  description?: string;
  reportType: 'overview' | 'leads' | 'campaigns' | 'forms' | 'tasks' | 'team' | 'conversations' | 'custom';
  filters: Record<string, any>;
  dateRange: {
    preset: DateRangePreset;
    startDate?: string;
    endDate?: string;
  };
  visibility: 'private' | 'workspace';
  createdAt: string;
  updatedAt: string;
}

export interface ReportFilterParams {
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  compare?: boolean;
  source?: string;
  campaignId?: string;
  stage?: string;
  taskStatus?: string;
  priority?: string;
  formId?: string;
  channel?: string;
}

// ============================================================================
// API CLIENT FUNCTIONS
// ============================================================================

export const getOverviewReportApi = async (
  params?: ReportFilterParams,
  clientId?: string
): Promise<OverviewReportData> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<OverviewReportData>>('/reports/overview', {
    params,
    headers,
  });
  return res.data.data!;
};

export const getLeadAnalyticsApi = async (
  params?: ReportFilterParams,
  clientId?: string
): Promise<LeadAnalyticsData> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<LeadAnalyticsData>>('/reports/leads', {
    params,
    headers,
  });
  return res.data.data!;
};

export const getCampaignAnalyticsApi = async (
  params?: ReportFilterParams,
  clientId?: string
): Promise<CampaignAnalyticsData> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<CampaignAnalyticsData>>('/reports/campaigns', {
    params,
    headers,
  });
  return res.data.data!;
};

export const getFormAnalyticsApi = async (
  params?: ReportFilterParams,
  clientId?: string
): Promise<FormAnalyticsData> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<FormAnalyticsData>>('/reports/forms', {
    params,
    headers,
  });
  return res.data.data!;
};

export const getTaskAndSlaAnalyticsApi = async (
  params?: ReportFilterParams,
  clientId?: string
): Promise<TaskAndSlaAnalyticsData> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<TaskAndSlaAnalyticsData>>('/reports/tasks', {
    params,
    headers,
  });
  return res.data.data!;
};

export const getTeamProductivityApi = async (
  params?: ReportFilterParams,
  clientId?: string
): Promise<TeamProductivityData> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<TeamProductivityData>>('/reports/team', {
    params,
    headers,
  });
  return res.data.data!;
};

export const getConversationAnalyticsApi = async (
  params?: ReportFilterParams,
  clientId?: string
): Promise<ConversationAnalyticsData> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<ConversationAnalyticsData>>('/reports/conversations', {
    params,
    headers,
  });
  return res.data.data!;
};

export const exportReportCsvApi = async (
  params: {
    reportType: string;
    preset?: DateRangePreset;
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
  clientId?: string
): Promise<Blob> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get('/reports/export', {
    params,
    headers,
    responseType: 'blob',
  });
  return res.data;
};

export const listSavedReportsApi = async (clientId?: string): Promise<SavedReportItem[]> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get<ApiResponse<SavedReportItem[]>>('/reports/saved', {
    headers,
  });
  return res.data.data || [];
};

export const createSavedReportApi = async (
  data: {
    name: string;
    description?: string;
    reportType: string;
    filters?: Record<string, any>;
    dateRange?: { preset?: DateRangePreset; startDate?: string; endDate?: string };
    visibility?: 'private' | 'workspace';
  },
  clientId?: string
): Promise<SavedReportItem> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.post<ApiResponse<SavedReportItem>>('/reports/saved', data, {
    headers,
  });
  return res.data.data!;
};

export const deleteSavedReportApi = async (id: string, clientId?: string): Promise<void> => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  await apiClient.delete(`/reports/saved/${id}`, {
    headers,
  });
};
