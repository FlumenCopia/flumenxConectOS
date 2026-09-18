import { apiClient, ApiResponse } from './api';

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost' | 'unqualified';
export type ScoreTier = 'cold' | 'warm' | 'hot';
export type LeadSource = 'meta_ads' | 'google_ads' | 'elementor_form' | 'custom_webhook' | 'manual' | 'referral' | 'other';

export interface LeadItem {
  _id: string;
  clientId: string | { _id: string; name: string; slug?: string };
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  stage: LeadStage;
  lostReason?: string;
  status?: string;
  score: number;
  scoreTier: ScoreTier;
  source: LeadSource;
  attribution?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    landingPage?: string;
    referrer?: string;
    adId?: string;
    formId?: string;
  };
  customFields?: Record<string, any>;
  tags?: string[];
  notes?: string;
  assignedTo?: { _id: string; name: string; email: string };
  followUpDate?: string;
  lastContactedAt?: string;
  intakeMethod: 'manual' | 'webhook' | 'import';
  intakePayloadSnapshot?: Record<string, any>;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivityItem {
  _id: string;
  leadId: string;
  clientId: string;
  userId?: { _id: string; name: string; email: string };
  action: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ClientWebhookItem {
  _id: string;
  clientId: string;
  name: string;
  source: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  createdAt: string;
  rawSecret?: string; // Only populated immediately upon creation!
}

export interface PipelineSummary {
  stage: LeadStage;
  count: number;
  totalScore: number;
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  search?: string;
  stage?: LeadStage | 'all';
  source?: LeadSource | 'all';
  scoreTier?: ScoreTier | 'all';
  assignedTo?: string | 'all';
  followUpFilter?: 'overdue' | 'upcoming' | 'none' | 'all';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// -------------------------------------------------------------
// Lead Management APIs
// -------------------------------------------------------------

export const getLeadsApi = async (filters: LeadFilters = {}) => {
  const query = new URLSearchParams();
  if (filters.page) query.set('page', filters.page.toString());
  if (filters.limit) query.set('limit', filters.limit.toString());
  if (filters.search) query.set('search', filters.search);
  if (filters.stage && filters.stage !== 'all') query.set('stage', filters.stage);
  if (filters.source && filters.source !== 'all') query.set('source', filters.source);
  if (filters.scoreTier && filters.scoreTier !== 'all') query.set('scoreTier', filters.scoreTier);
  if (filters.assignedTo && filters.assignedTo !== 'all') query.set('assignedTo', filters.assignedTo);
  if (filters.followUpFilter && filters.followUpFilter !== 'all') query.set('followUpFilter', filters.followUpFilter);
  if (filters.sortBy) query.set('sortBy', filters.sortBy);
  if (filters.sortOrder) query.set('sortOrder', filters.sortOrder);

  const res = await apiClient.get<ApiResponse<{ leads: LeadItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>(
    `/leads?${query.toString()}`
  );
  return res.data.data!;
};

export const getLeadApi = async (id: string) => {
  const res = await apiClient.get<ApiResponse<LeadItem>>(`/leads/${id}`);
  return res.data.data!;
};

export const createLeadApi = async (data: {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  source: LeadSource;
  notes?: string;
  tags?: string[];
  followUpDate?: string;
  assignedTo?: string;
  customFields?: Record<string, any>;
}) => {
  const res = await apiClient.post<ApiResponse<LeadItem>>('/leads', data);
  return res.data.data!;
};

export const updateLeadApi = async (id: string, data: Partial<LeadItem>) => {
  const res = await apiClient.put<ApiResponse<LeadItem>>(`/leads/${id}`, data);
  return res.data.data!;
};

export const updateLeadStageApi = async (id: string, stage: LeadStage, lostReason?: string) => {
  const res = await apiClient.patch<ApiResponse<LeadItem>>(`/leads/${id}/stage`, { stage, lostReason });
  return res.data.data!;
};

export const assignLeadApi = async (id: string, assignedTo: string | null) => {
  const res = await apiClient.patch<ApiResponse<LeadItem>>(`/leads/${id}/assign`, { assignedTo });
  return res.data.data!;
};

export const scheduleFollowUpApi = async (id: string, followUpDate: string | null, notes?: string) => {
  const res = await apiClient.patch<ApiResponse<LeadItem>>(`/leads/${id}/follow-up`, { followUpDate, notes });
  return res.data.data!;
};

export const deleteLeadApi = async (id: string) => {
  const res = await apiClient.delete<ApiResponse<{ leadId: string }>>(`/leads/${id}`);
  return res.data.data!;
};

export const getLeadActivitiesApi = async (id: string) => {
  const res = await apiClient.get<ApiResponse<LeadActivityItem[]>>(`/leads/${id}/activities`);
  return res.data.data!;
};

export const addLeadNoteApi = async (id: string, note: string) => {
  const res = await apiClient.post<ApiResponse<LeadActivityItem>>(`/leads/${id}/notes`, { note });
  return res.data.data!;
};

export const getPipelineSummaryApi = async () => {
  const res = await apiClient.get<ApiResponse<PipelineSummary[]>>('/leads/pipeline-summary');
  return res.data.data!;
};

export const exportLeadsCsvApi = async (filters: { stage?: string; source?: string } = {}) => {
  const query = new URLSearchParams();
  if (filters.stage && filters.stage !== 'all') query.set('stage', filters.stage);
  if (filters.source && filters.source !== 'all') query.set('source', filters.source);

  const res = await apiClient.get(`/leads/export?${query.toString()}`, {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// -------------------------------------------------------------
// Webhook Intake Management APIs
// -------------------------------------------------------------

export const getClientWebhooksApi = async (clientId: string) => {
  const res = await apiClient.get<ApiResponse<ClientWebhookItem[]>>(`/admin/clients/${clientId}/webhooks`);
  return res.data.data!;
};

export const createClientWebhookApi = async (clientId: string, data: { name: string; source: string }) => {
  const res = await apiClient.post<ApiResponse<ClientWebhookItem>>(`/admin/clients/${clientId}/webhooks`, data);
  return res.data.data!;
};

export const toggleWebhookStatusApi = async (clientId: string, webhookId: string, isActive: boolean) => {
  const res = await apiClient.patch<ApiResponse<ClientWebhookItem>>(`/admin/clients/${clientId}/webhooks/${webhookId}/status`, { isActive });
  return res.data.data!;
};

export const deleteClientWebhookApi = async (clientId: string, webhookId: string) => {
  const res = await apiClient.delete<ApiResponse<{ webhookId: string }>>(`/admin/clients/${clientId}/webhooks/${webhookId}`);
  return res.data.data!;
};
