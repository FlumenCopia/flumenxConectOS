import axios from 'axios';
import { ApiResponse } from '@/lib/api';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

// Dedicated Axios instance for customer portal with credentials and CSRF support
export const portalApi = axios.create({
  baseURL: `${baseURL}/portal`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach CSRF token if present in localStorage or cookies
portalApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const csrfToken = localStorage.getItem('flumenx_portal_csrf');
    if (csrfToken && config.headers) {
      config.headers['x-portal-csrf'] = csrfToken;
    }
  }
  return config;
});

export interface PortalUserProfile {
  id: string;
  clientId: string;
  clientName?: string;
  contactId: string;
  leadId?: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  status: 'active' | 'suspended';
  communicationPreferences: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    marketing: boolean;
  };
  consentGiven: boolean;
  consentGivenAt?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface CustomerRequestItem {
  _id: string;
  requestNumber: string;
  subject: string;
  description: string;
  category: string;
  status: 'submitted' | 'under_review' | 'in_progress' | 'completed' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
  }>;
  messages: Array<{
    id: string;
    authorType: 'customer' | 'staff';
    authorName: string;
    body: string;
    isCustomerVisible: boolean;
    attachments: any[];
    createdAt: string;
  }>;
  statusHistory: Array<{
    status: string;
    changedByType: string;
    comment?: string;
    changedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PortalConversationItem {
  _id: string;
  subject: string;
  channel: string;
  status: string;
  priority: string;
  lastMessageAt?: string;
  lastMessageSnippet?: string;
  unreadCount: number;
  createdAt: string;
}

export interface PortalConversationMessage {
  _id: string;
  conversationId: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  senderType: string;
  senderName?: string;
  body: string;
  attachments?: any[];
  createdAt: string;
}

export interface PortalTaskItem {
  _id: string;
  title: string;
  description?: string;
  taskType: string;
  status: string;
  priority: string;
  dueAt: string;
  customerActionRequired: boolean;
  customerActionDescription?: string;
  customerCompletedAt?: string;
  createdAt: string;
}

export interface PortalNotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  readAt?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 1. Authentication
// ---------------------------------------------------------------------------
export const portalLoginApi = async (credentials: { email: string; password: string }) => {
  const res = await portalApi.post<ApiResponse<{ token?: string; csrfToken?: string; user: PortalUserProfile }>>(
    '/auth/login',
    credentials
  );
  if (typeof window !== 'undefined' && res.data.data?.csrfToken) {
    localStorage.setItem('flumenx_portal_csrf', res.data.data.csrfToken);
  }
  return res.data.data!;
};

export const portalAcceptInvitationApi = async (data: {
  token: string;
  password: string;
  name?: string;
  phone?: string;
}) => {
  const res = await portalApi.post<ApiResponse<{ token?: string; csrfToken?: string; user: PortalUserProfile }>>(
    '/auth/accept-invitation',
    data
  );
  if (typeof window !== 'undefined' && res.data.data?.csrfToken) {
    localStorage.setItem('flumenx_portal_csrf', res.data.data.csrfToken);
  }
  return res.data.data!;
};

export const portalForgotPasswordApi = async (email: string, clientId?: string) => {
  const res = await portalApi.post<ApiResponse<null>>('/auth/forgot-password', { email, clientId });
  return res.data.message || 'If registered, reset instructions have been sent.';
};

export const portalResetPasswordApi = async (token: string, newPassword: string) => {
  const res = await portalApi.post<ApiResponse<null>>('/auth/reset-password', { token, newPassword });
  return res.data.message || 'Password reset successfully.';
};

export const portalGetMeApi = async () => {
  const res = await portalApi.get<ApiResponse<{ user: PortalUserProfile }>>('/auth/me');
  return res.data.data!.user;
};

export const portalLogoutApi = async () => {
  try {
    await portalApi.post('/auth/logout');
  } finally {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('flumenx_portal_csrf');
    }
  }
};

// ---------------------------------------------------------------------------
// 2. Profile & Consent
// ---------------------------------------------------------------------------
export const portalGetProfileApi = async (): Promise<PortalUserProfile> => {
  const res = await portalApi.get<ApiResponse<PortalUserProfile>>('/profile');
  return res.data.data!;
};

export const portalUpdateProfileApi = async (data: {
  name?: string;
  phone?: string;
  communicationPreferences?: {
    email?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
    marketing?: boolean;
  };
  consentGiven?: boolean;
}): Promise<PortalUserProfile> => {
  const res = await portalApi.patch<ApiResponse<PortalUserProfile>>('/profile', data);
  return res.data.data!;
};

export const portalRequestProfileChangeApi = async (data: {
  fieldName: string;
  requestedValue: string;
  reason?: string;
}) => {
  const res = await portalApi.post<ApiResponse<CustomerRequestItem>>('/profile/change-request', data);
  return res.data.data!;
};

// ---------------------------------------------------------------------------
// 3. Customer Requests
// ---------------------------------------------------------------------------
export const portalListRequestsApi = async (params?: {
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
}) => {
  const res = await portalApi.get<ApiResponse<CustomerRequestItem[]>>('/requests', { params });
  return {
    requests: res.data.data || [],
    pagination: res.data.pagination,
  };
};

export const portalGetRequestApi = async (id: string): Promise<CustomerRequestItem> => {
  const res = await portalApi.get<ApiResponse<CustomerRequestItem>>(`/requests/${id}`);
  return res.data.data!;
};

export const portalCreateRequestApi = async (data: {
  subject: string;
  description: string;
  category: string;
  priority?: string;
  idempotencyKey: string;
  attachments?: any[];
}): Promise<CustomerRequestItem> => {
  const res = await portalApi.post<ApiResponse<CustomerRequestItem>>('/requests', data);
  return res.data.data!;
};

export const portalAddRequestMessageApi = async (
  id: string,
  data: { body: string; attachments?: any[]; idempotencyKey?: string }
): Promise<CustomerRequestItem> => {
  const res = await portalApi.post<ApiResponse<CustomerRequestItem>>(`/requests/${id}/messages`, data);
  return res.data.data!;
};

// ---------------------------------------------------------------------------
// 4. Conversations
// ---------------------------------------------------------------------------
export const portalListConversationsApi = async (): Promise<PortalConversationItem[]> => {
  const res = await portalApi.get<ApiResponse<PortalConversationItem[]>>('/conversations');
  return res.data.data || [];
};

export const portalGetConversationMessagesApi = async (id: string, page = 1, limit = 50) => {
  const res = await portalApi.get<
    ApiResponse<{ conversation: any; messages: PortalConversationMessage[]; total: number }>
  >(`/conversations/${id}/messages`, { params: { page, limit } });
  return res.data.data!;
};

export const portalSendConversationMessageApi = async (
  id: string,
  data: { body: string; attachments?: any[]; idempotencyKey?: string }
): Promise<PortalConversationMessage> => {
  const res = await portalApi.post<ApiResponse<PortalConversationMessage>>(
    `/conversations/${id}/messages`,
    data
  );
  return res.data.data!;
};

// ---------------------------------------------------------------------------
// 5. Tasks & Action Items
// ---------------------------------------------------------------------------
export const portalListTasksApi = async (): Promise<PortalTaskItem[]> => {
  const res = await portalApi.get<ApiResponse<PortalTaskItem[]>>('/tasks');
  return res.data.data || [];
};

export const portalGetTaskApi = async (id: string): Promise<PortalTaskItem> => {
  const res = await portalApi.get<ApiResponse<PortalTaskItem>>(`/tasks/${id}`);
  return res.data.data!;
};

export const portalCompleteTaskApi = async (id: string, notes?: string): Promise<PortalTaskItem> => {
  const res = await portalApi.post<ApiResponse<PortalTaskItem>>(`/tasks/${id}/complete`, { notes });
  return res.data.data!;
};

export const portalAddTaskCommentApi = async (id: string, comment: string) => {
  const res = await portalApi.post<ApiResponse<any>>(`/tasks/${id}/comments`, { comment });
  return res.data.data!;
};

// ---------------------------------------------------------------------------
// 6. Notifications
// ---------------------------------------------------------------------------
export const portalListNotificationsApi = async (params?: { unreadOnly?: boolean; page?: number; limit?: number }) => {
  const res = await portalApi.get<ApiResponse<PortalNotificationItem[]>>('/notifications', { params });
  return {
    notifications: res.data.data || [],
    pagination: res.data.pagination,
  };
};

export const portalGetUnreadCountApi = async (): Promise<number> => {
  const res = await portalApi.get<ApiResponse<{ unreadCount: number }>>('/notifications/unread-count');
  return res.data.data?.unreadCount || 0;
};

export const portalMarkNotificationReadApi = async (id: string) => {
  const res = await portalApi.patch<ApiResponse<any>>(`/notifications/${id}/read`);
  return res.data.data;
};

export const portalMarkAllNotificationsReadApi = async () => {
  const res = await portalApi.post<ApiResponse<any>>('/notifications/read-all');
  return res.data.data;
};
