import { apiClient, ApiResponse } from './api';

export type BroadcastChannel = 'whatsapp' | 'sms' | 'email';
export type BroadcastStatus = 'draft' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type RecipientStatus = 'pending' | 'sent' | 'failed';

export interface BroadcastAttachment {
  name: string;
  url: string;
  fileType?: string;
  fileSize?: number;
  size?: number;
  mimeType?: string;
}

export interface BroadcastRecipient {
  name?: string;
  phone?: string;
  email?: string;
  customFields?: Record<string, any>;
  status?: RecipientStatus;
  error?: string;
  messageId?: string;
  sentAt?: string;
}

export interface BroadcastCampaignItem {
  _id: string;
  clientId: string;
  name: string;
  channel: BroadcastChannel;
  messageBody: string;
  attachment?: BroadcastAttachment;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: BroadcastStatus;
  startedAt?: string;
  completedAt?: string;
  recipients?: BroadcastRecipient[];
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastListResponse {
  campaigns: BroadcastCampaignItem[];
  broadcasts?: BroadcastCampaignItem[];
  total: number;
  page: number;
  totalPages: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateBroadcastPayload {
  name: string;
  channel: BroadcastChannel;
  messageBody: string;
  attachment?: BroadcastAttachment;
  recipients: Array<{
    name?: string;
    phone?: string;
    email?: string;
    customFields?: Record<string, any>;
  }>;
}

export interface UploadAttachmentPayload {
  filename: string;
  base64Data: string;
  mimeType: string;
}

export const getBroadcastsApi = async (page = 1, limit = 20): Promise<BroadcastListResponse> => {
  const res = await apiClient.get<ApiResponse<any>>(`/broadcasts?page=${page}&limit=${limit}`);
  const data = res.data.data;
  const list = data?.broadcasts || data?.campaigns || [];
  return {
    campaigns: list,
    broadcasts: list,
    total: data?.pagination?.total ?? data?.total ?? list.length,
    page: data?.pagination?.page ?? data?.page ?? page,
    totalPages: data?.pagination?.totalPages ?? data?.totalPages ?? 1,
  };
};

export const getBroadcastByIdApi = async (broadcastId: string): Promise<BroadcastCampaignItem> => {
  const res = await apiClient.get<ApiResponse<BroadcastCampaignItem>>(`/broadcasts/${broadcastId}`);
  return res.data.data!;
};

export const createBroadcastApi = async (payload: CreateBroadcastPayload): Promise<BroadcastCampaignItem> => {
  const res = await apiClient.post<ApiResponse<BroadcastCampaignItem>>('/broadcasts', payload);
  return res.data.data!;
};

export const uploadBroadcastAttachmentApi = async (payload: UploadAttachmentPayload): Promise<BroadcastAttachment> => {
  const res = await apiClient.post<ApiResponse<BroadcastAttachment>>('/broadcasts/upload', payload);
  return res.data.data!;
};
