import { apiClient, ApiResponse } from './api';

export interface OnboardingItem {
  _id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'not_applicable';
  completedBy?: { _id: string; name: string; email: string };
  completedAt?: string;
  notes?: string;
  dueDate?: string;
}

export interface ClientItem {
  _id: string;
  name: string;
  slug: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone: string;
  currency: string;
  logoUrl?: string;
  brandColor?: string;
  status: 'active' | 'onboarding' | 'paused' | 'inactive' | 'archived' | 'suspended';
  health: 'healthy' | 'needs_attention' | 'at_risk' | 'inactive';
  primaryAccountManagerId?: string | { _id: string; name: string; email: string; avatarUrl?: string };
  backupAccountManagerId?: string | { _id: string; name: string; email: string; avatarUrl?: string };
  onboardingStatus: 'pending' | 'in_progress' | 'completed';
  onboardingProgress: number;
  onboardingChecklist: OnboardingItem[];
  settings: {
    leadResponseThresholdMinutes: number;
    notificationEmails: string[];
    brandPrimaryColor?: string;
    allowClientUserInvites?: boolean;
  };
  notes?: string;
  isArchived: boolean;
  archivedAt?: string;
  activeMemberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientActivityItem {
  _id: string;
  clientId: string;
  userId?: { _id: string; name: string; email: string };
  userName?: string;
  userEmail?: string;
  action: string;
  title: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export interface ClientMemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  userStatus: string;
  membershipStatus: 'active' | 'invited' | 'suspended';
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions: string[];
  joinedAt: string;
}

export interface ClientInvitationItem {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

export interface AuditLogItem {
  _id: string;
  userId?: { _id: string; name: string; email: string };
  userEmail?: string;
  clientId?: { _id: string; name: string; slug: string };
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

// -------------------------------------------------------------
// Admin Client APIs
// -------------------------------------------------------------

export const getClientsApi = async (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  health?: string;
  managerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
}) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.search) query.set('search', params.search);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.health && params.health !== 'all') query.set('health', params.health);
  if (params.managerId && params.managerId !== 'all') query.set('managerId', params.managerId);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.includeArchived) query.set('includeArchived', 'true');

  const res = await apiClient.get<ApiResponse<{ clients: ClientItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>(
    `/admin/clients?${query.toString()}`
  );
  return res.data.data!;
};

export const createClientApi = async (data: Partial<ClientItem> | Record<string, any>) => {
  const res = await apiClient.post<ApiResponse<ClientItem>>('/admin/clients', data);
  return res.data.data!;
};

export const getClientApi = async (clientId: string) => {
  const res = await apiClient.get<ApiResponse<ClientItem>>(`/admin/clients/${clientId}`);
  return res.data.data!;
};

export const updateClientApi = async (clientId: string, data: Partial<ClientItem> | Record<string, any>) => {
  const res = await apiClient.put<ApiResponse<ClientItem>>(`/admin/clients/${clientId}`, data);
  return res.data.data!;
};

export const updateClientStatusApi = async (clientId: string, status: string, reason?: string) => {
  const res = await apiClient.patch<ApiResponse<ClientItem>>(`/admin/clients/${clientId}/status`, { status, reason });
  return res.data.data!;
};

export const updateClientHealthApi = async (clientId: string, health: string, notes?: string) => {
  const res = await apiClient.patch<ApiResponse<ClientItem>>(`/admin/clients/${clientId}/health`, { health, notes });
  return res.data.data!;
};

export const updateClientManagersApi = async (
  clientId: string,
  managers: { primaryAccountManagerId?: string | null; backupAccountManagerId?: string | null }
) => {
  const res = await apiClient.patch<ApiResponse<ClientItem>>(`/admin/clients/${clientId}/managers`, managers);
  return res.data.data!;
};

export const archiveClientApi = async (clientId: string) => {
  const res = await apiClient.delete<ApiResponse<ClientItem>>(`/admin/clients/${clientId}`);
  return res.data.data!;
};

export const getOnboardingApi = async (clientId: string) => {
  const res = await apiClient.get<ApiResponse<{ onboardingStatus: string; onboardingProgress: number; checklist: OnboardingItem[] }>>(
    `/admin/clients/${clientId}/onboarding`
  );
  return res.data.data!;
};

export const updateOnboardingItemApi = async (
  clientId: string,
  itemId: string,
  data: { status: string; notes?: string; dueDate?: string | null }
) => {
  const res = await apiClient.patch<ApiResponse<{ onboardingStatus: string; onboardingProgress: number; checklist: OnboardingItem[] }>>(
    `/admin/clients/${clientId}/onboarding/${itemId}`,
    data
  );
  return res.data.data!;
};

export const getClientActivityApi = async (clientId: string, page = 1, limit = 20) => {
  const res = await apiClient.get<ApiResponse<{ activities: ClientActivityItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>(
    `/admin/clients/${clientId}/activity?page=${page}&limit=${limit}`
  );
  return res.data.data!;
};

// -------------------------------------------------------------
// Team & User Management APIs
// -------------------------------------------------------------

export const getClientUsersApi = async (clientId: string) => {
  const res = await apiClient.get<ApiResponse<{ members: ClientMemberItem[]; invitations: ClientInvitationItem[] }>>(
    `/admin/clients/${clientId}/users`
  );
  return res.data.data!;
};

export const inviteClientUserApi = async (clientId: string, data: { email: string; roleId: string; name?: string }) => {
  const res = await apiClient.post<ApiResponse<any>>(`/admin/clients/${clientId}/users/invite`, data);
  return res.data.data!;
};

export const updateUserRoleApi = async (clientId: string, userId: string, roleId: string) => {
  const res = await apiClient.patch<ApiResponse<any>>(`/admin/clients/${clientId}/users/${userId}/role`, { roleId });
  return res.data.data!;
};

export const updateUserStatusApi = async (clientId: string, userId: string, status: 'active' | 'suspended') => {
  const res = await apiClient.patch<ApiResponse<any>>(`/admin/clients/${clientId}/users/${userId}/status`, { status });
  return res.data.data!;
};

export const removeClientUserApi = async (clientId: string, userId: string) => {
  const res = await apiClient.delete<ApiResponse<any>>(`/admin/clients/${clientId}/users/${userId}`);
  return res.data.data!;
};

export const acceptInvitationApi = async (data: { token: string; password: string; name?: string }) => {
  const res = await apiClient.post<ApiResponse<any>>('/auth/invitations/accept', data);
  return res.data.data!;
};

// -------------------------------------------------------------
// Client Workspace & Settings APIs
// -------------------------------------------------------------

export const getCurrentWorkspaceApi = async (clientId?: string) => {
  const headers = clientId ? { 'X-Client-Id': clientId } : {};
  const res = await apiClient.get<ApiResponse<ClientItem>>('/client/workspace/current', { headers });
  return res.data.data!;
};

export const updateWorkspaceSettingsApi = async (data: Partial<ClientItem['settings'] & { legalName?: string; phone?: string; website?: string; timezone?: string; currency?: string }>, clientId?: string) => {
  const headers = clientId ? { 'X-Client-Id': clientId } : {};
  const res = await apiClient.put<ApiResponse<ClientItem>>('/client/workspace/settings', data, { headers });
  return res.data.data!;
};

export const getWorkspaceTeamApi = async (clientId?: string) => {
  const headers = clientId ? { 'X-Client-Id': clientId } : {};
  const res = await apiClient.get<ApiResponse<{ members: ClientMemberItem[]; invitations: ClientInvitationItem[] }>>(
    '/client/workspace/team',
    { headers }
  );
  return res.data.data!;
};

export const switchWorkspaceApi = async (targetClientId: string) => {
  const res = await apiClient.post<ApiResponse<{ token: string; client: { id: string; name: string; slug: string; roleName: string; permissions: string[] } }>>(
    '/client/workspace/switch',
    { targetClientId }
  );
  return res.data.data!;
};

// -------------------------------------------------------------
// Audit Logs API
// -------------------------------------------------------------

export const getAuditLogsApi = async (params: {
  page?: number;
  limit?: number;
  action?: string;
  clientId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.action && params.action !== 'all') query.set('action', params.action);
  if (params.clientId && params.clientId !== 'all') query.set('clientId', params.clientId);
  if (params.userId && params.userId !== 'all') query.set('userId', params.userId);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);

  const res = await apiClient.get<ApiResponse<{ logs: AuditLogItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>>(
    `/admin/audit-logs?${query.toString()}`
  );
  return res.data.data!;
};
