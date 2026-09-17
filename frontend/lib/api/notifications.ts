import { apiClient } from '../api';

export interface NotificationItem {
  _id: string;
  clientId: string;
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  readAt?: string | null;
  sourceType?: 'lead' | 'task' | 'conversation' | 'workflow_run' | 'form_submission' | 'system';
  sourceId?: string;
  createdAt: string;
}

export const listNotificationsApi = async (params: {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
  clientId?: string;
} = {}) => {
  const query = new URLSearchParams();
  if (params.unreadOnly) query.set('unreadOnly', 'true');
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const headers: Record<string, string> = {};
  if (params.clientId) headers['x-client-id'] = params.clientId;

  const res = await apiClient.get(`/notifications?${query.toString()}`, { headers });
  return res.data;
};

export const getUnreadCountApi = async (clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.get('/notifications/unread-count', { headers });
  return res.data.data?.unreadCount || 0;
};

export const markAsReadApi = async (id: string, clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.patch(`/notifications/${id}/read`, {}, { headers });
  return res.data.data;
};

export const markAllAsReadApi = async (clientId?: string) => {
  const headers: Record<string, string> = {};
  if (clientId) headers['x-client-id'] = clientId;

  const res = await apiClient.post('/notifications/mark-all-read', {}, { headers });
  return res.data.data;
};
