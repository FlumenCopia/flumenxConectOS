import { apiClient, ApiResponse } from '../api';

export interface StaffUserItem {
  id: string;
  _id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  role: string;
  roleTitle: string;
  assignedClients: string[];
  assignedClientIds?: string[];
  status: 'active' | 'suspended' | 'inactive';
  lastActiveAt: string;
  joinedAt: string;
}

export interface AccountManagerItem {
  id: string;
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
}

export const getStaffUsersApi = async (params?: {
  search?: string;
  role?: string;
  status?: string;
}): Promise<StaffUserItem[]> => {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.role && params.role !== 'all') query.set('role', params.role);
  if (params?.status && params.status !== 'all') query.set('status', params.status);

  const res = await apiClient.get<ApiResponse<{ users: StaffUserItem[]; total: number }>>(
    `/admin/users?${query.toString()}`
  );
  return res.data.data?.users || [];
};

export const getAccountManagersApi = async (): Promise<AccountManagerItem[]> => {
  const res = await apiClient.get<ApiResponse<{ managers: AccountManagerItem[] }>>('/admin/users/managers');
  return res.data.data?.managers || [];
};

export const inviteStaffUserApi = async (data: {
  name: string;
  email: string;
  role: string;
  roleTitle?: string;
  clientId?: string;
}): Promise<StaffUserItem> => {
  const res = await apiClient.post<ApiResponse<StaffUserItem>>('/admin/users/invite', data);
  return res.data.data!;
};

export const updateStaffStatusApi = async (
  userId: string,
  status: 'active' | 'suspended'
): Promise<void> => {
  await apiClient.patch<ApiResponse<any>>(`/admin/users/${userId}/status`, { status });
};
