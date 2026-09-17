import { apiClient, ApiResponse } from '@/lib/api';

export type RequestStatus = 'submitted' | 'under_review' | 'in_progress' | 'completed' | 'closed';
export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';
export type RequestCategory = 'support' | 'billing' | 'inquiry' | 'service_request' | 'profile_change' | 'other';
export type AttachmentScanStatus = 'pending' | 'clean' | 'malicious' | 'scan_failed';

export interface StaffRequestAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  scanStatus: AttachmentScanStatus;
  scannedAt?: string;
  scanVerdict?: string;
  sha256?: string;
}

export interface StaffRequestMessage {
  id: string;
  authorType: 'customer' | 'staff';
  authorId: string;
  authorName: string;
  body: string;
  isCustomerVisible: boolean;
  attachments: StaffRequestAttachment[];
  createdAt: string;
}

export interface StaffRequestStatusHistory {
  status: RequestStatus;
  changedBy: string;
  changedByType: 'customer' | 'staff';
  comment?: string;
  changedAt: string;
}

export interface StaffCustomerRequestItem {
  _id: string;
  clientId: string;
  portalUserId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    status: 'active' | 'suspended';
  } | string;
  contactId: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
  } | string;
  leadId?: string;
  requestNumber: string;
  subject: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  attachments: StaffRequestAttachment[];
  assignedStaffId?: {
    _id: string;
    name: string;
    email: string;
  } | string | null;
  messages: StaffRequestMessage[];
  statusHistory: StaffRequestStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface PortalUserItem {
  _id: string;
  clientId: string;
  contactId: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
  } | string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'suspended';
  consentGiven: boolean;
  consentGivenAt?: string;
  communicationPreferences: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    marketing: boolean;
  };
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortalInvitationItem {
  _id: string;
  clientId: string;
  contactId: {
    _id: string;
    name?: string;
    email?: string;
  } | string;
  email: string;
  name?: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  invitedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffCustomerRequestFilters {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ----------------------------------------------------------------------------
// 1. Staff Customer Requests API
// ----------------------------------------------------------------------------

export const listStaffCustomerRequestsApi = async (filters: StaffCustomerRequestFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.limit) params.set('limit', filters.limit.toString());

  const response = await apiClient.get<
    ApiResponse<{
      requests: StaffCustomerRequestItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/client/portal/requests?${params.toString()}`);
  return response.data;
};

export const updateStaffCustomerRequestApi = async (
  requestId: string,
  payload: {
    status?: RequestStatus;
    priority?: RequestPriority;
    assignedStaffId?: string | null;
    comment?: string;
  }
) => {
  const response = await apiClient.patch<ApiResponse<{ request: StaffCustomerRequestItem }>>(
    `/client/portal/requests/${requestId}`,
    payload
  );
  return response.data;
};

export const addStaffRequestMessageApi = async (
  requestId: string,
  payload: {
    body: string;
    isCustomerVisible: boolean;
    attachments?: Array<{
      id: string;
      name: string;
      url: string;
      size: number;
      mimeType: string;
    }>;
  }
) => {
  const response = await apiClient.post<ApiResponse<{ request: StaffCustomerRequestItem }>>(
    `/client/portal/requests/${requestId}/messages`,
    payload
  );
  return response.data;
};

export const downloadStaffAttachmentApi = async (requestId: string, attachmentId: string) => {
  const response = await apiClient.get<ApiResponse<any>>(
    `/client/portal/requests/${requestId}/attachments/${attachmentId}/download`
  );
  return response.data;
};

// ----------------------------------------------------------------------------
// 2. Customer Portal Users API
// ----------------------------------------------------------------------------

export const listPortalUsersApi = async (params: { status?: string; search?: string; page?: number; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  const response = await apiClient.get<
    ApiResponse<{
      users: PortalUserItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/client/portal/users?${query.toString()}`);
  return response.data;
};

export const updatePortalUserStatusApi = async (userId: string, status: 'active' | 'suspended') => {
  const response = await apiClient.patch<ApiResponse<{ user: PortalUserItem; message: string }>>(
    `/client/portal/users/${userId}/status`,
    { status }
  );
  return response.data;
};

// ----------------------------------------------------------------------------
// 3. Customer Portal Invitations API
// ----------------------------------------------------------------------------

export const listPortalInvitationsApi = async (params: { status?: string; page?: number; limit?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  const response = await apiClient.get<
    ApiResponse<{
      invitations: PortalInvitationItem[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>
  >(`/client/portal/invitations?${query.toString()}`);
  return response.data;
};

export const inviteCustomerContactApi = async (payload: {
  contactId: string;
  email?: string;
  name?: string;
}) => {
  const response = await apiClient.post<ApiResponse<any>>('/client/portal/invitations', payload);
  return response.data;
};

export const revokePortalInvitationApi = async (invitationId: string) => {
  const response = await apiClient.post<ApiResponse<{ invitation: PortalInvitationItem; message: string }>>(
    `/client/portal/invitations/${invitationId}/revoke`
  );
  return response.data;
};
