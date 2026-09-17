import { apiClient, ApiResponse } from './api';

export type FormStatus = 'draft' | 'published' | 'paused' | 'archived';

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'hidden';

export type LeadFieldMapping =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'companyName'
  | 'jobTitle'
  | 'website'
  | 'estimatedValue'
  | 'notes'
  | 'customField'
  | 'none';

export type ContactFieldMapping = 'name' | 'email' | 'phone' | 'none';

export interface FieldOption {
  label: string;
  value: string;
}

export interface WebsiteFormFieldItem {
  _id: string;
  formId: string;
  clientId: string;
  fieldKey: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options: FieldOption[];
  defaultValue?: string;
  order: number;
  leadMapping: LeadFieldMapping;
  contactMapping: ContactFieldMapping;
  customFieldKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebsiteFormItem {
  _id: string;
  clientId: string;
  name: string;
  description?: string;
  publicKey: string;
  status: FormStatus;
  submitButtonLabel: string;
  successMessage: string;
  redirectUrl?: string;
  allowedDomains: string[];
  notificationSettings: {
    emailRecipients: string[];
    notifyOnSubmission: boolean;
  };
  captchaSettings: {
    enabled: boolean;
    provider: 'mock' | 'recaptcha_v3' | 'hcaptcha';
    siteKey?: string;
  };
  honeypotField: string;
  submissionsCount: number;
  fieldsCount?: number;
  createdBy?: { _id: string; name: string; email: string };
  fields?: WebsiteFormFieldItem[];
  stats?: {
    totalSubmissions: number;
    processedCount: number;
    rejectedCount: number;
    failedCount: number;
    lastSubmissionAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmissionItem {
  _id: string;
  formId: { _id: string; name: string; publicKey: string } | string;
  clientId: string;
  submissionId: string;
  payload: Record<string, any>;
  normalizedPayload: Record<string, any>;
  leadId?: { _id: string; fullName: string; stage: string; leadScore: number; source: string };
  contactId?: { _id: string; name: string; email?: string; phone?: string };
  conversationId?: { _id: string; subject: string; channel: string };
  processingStatus: 'received' | 'processing' | 'processed' | 'rejected' | 'failed';
  spamStatus: 'clean' | 'spam' | 'suspicious';
  sourceUrl?: string;
  referrer?: string;
  ipAddress?: string;
  userAgent?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
  events?: FormSubmissionEventItem[];
}

export interface FormSubmissionEventItem {
  _id: string;
  submissionId: string;
  formId: string;
  clientId: string;
  eventType: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface EmbedConfig {
  publicKey: string;
  formName: string;
  status: string;
  standaloneUrl: string;
  scriptSnippet: string;
  iframeSnippet: string;
  allowedDomains: string[];
}

// -------------------------------------------------------------
// Authenticated Form APIs
// -------------------------------------------------------------

export const getFormsApi = async (filters: {
  status?: FormStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  if (filters.page) query.set('page', filters.page.toString());
  if (filters.limit) query.set('limit', filters.limit.toString());

  const response = await apiClient.get<
    ApiResponse<{
      forms: WebsiteFormItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      counts: { total: number; published: number; draft: number; paused: number; archived: number };
    }>
  >(`/forms?${query.toString()}`);
  return response.data;
};

export const getFormByIdApi = async (formId: string) => {
  const response = await apiClient.get<ApiResponse<WebsiteFormItem>>(`/forms/${formId}`);
  return response.data;
};

export type FormPayload = Omit<Partial<WebsiteFormItem>, 'fields'> & {
  fields?: Partial<WebsiteFormFieldItem>[];
};

export const createFormApi = async (data: FormPayload) => {
  const response = await apiClient.post<ApiResponse<WebsiteFormItem>>('/forms', data);
  return response.data;
};

export const updateFormApi = async (formId: string, data: FormPayload) => {
  const response = await apiClient.put<ApiResponse<WebsiteFormItem>>(`/forms/${formId}`, data);
  return response.data;
};

export const duplicateFormApi = async (formId: string) => {
  const response = await apiClient.post<ApiResponse<WebsiteFormItem>>(`/forms/${formId}/duplicate`);
  return response.data;
};

export const updateFormStatusApi = async (formId: string, status: FormStatus) => {
  const response = await apiClient.patch<ApiResponse<WebsiteFormItem>>(`/forms/${formId}/status`, { status });
  return response.data;
};

export const archiveFormApi = async (formId: string) => {
  const response = await apiClient.delete<ApiResponse<WebsiteFormItem>>(`/forms/${formId}`);
  return response.data;
};

export const getEmbedConfigApi = async (formId: string) => {
  const response = await apiClient.get<ApiResponse<EmbedConfig>>(`/forms/${formId}/embed`);
  return response.data;
};

export const getSubmissionsApi = async (filters: {
  formId?: string;
  status?: string;
  spamStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}) => {
  const query = new URLSearchParams();
  if (filters.formId) query.set('formId', filters.formId);
  if (filters.status && filters.status !== 'all') query.set('status', filters.status);
  if (filters.spamStatus && filters.spamStatus !== 'all') query.set('spamStatus', filters.spamStatus);
  if (filters.search) query.set('search', filters.search);
  if (filters.page) query.set('page', filters.page.toString());
  if (filters.limit) query.set('limit', filters.limit.toString());

  const response = await apiClient.get<
    ApiResponse<{
      submissions: FormSubmissionItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/forms/submissions?${query.toString()}`);
  return response.data;
};

export const getSubmissionByIdApi = async (submissionId: string) => {
  const response = await apiClient.get<ApiResponse<FormSubmissionItem>>(`/forms/submissions/${submissionId}`);
  return response.data;
};

export const reprocessSubmissionApi = async (submissionId: string) => {
  const response = await apiClient.post<ApiResponse<FormSubmissionItem>>(`/forms/submissions/${submissionId}/reprocess`);
  return response.data;
};

// -------------------------------------------------------------
// Public Form Endpoints
// -------------------------------------------------------------

export const getPublicFormApi = async (publicKey: string) => {
  const response = await apiClient.get<ApiResponse<any>>(`/public/forms/${publicKey}`);
  return response.data;
};

export const submitPublicFormApi = async (publicKey: string, payload: Record<string, any>) => {
  const response = await apiClient.post<ApiResponse<{ success: boolean; message: string; redirectUrl?: string; submissionId: string }>>(
    `/public/forms/${publicKey}/submit`,
    payload
  );
  return response.data;
};
