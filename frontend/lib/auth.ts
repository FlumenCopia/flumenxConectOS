import { api, ApiResponse } from './api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  status: string;
  lastLoginAt?: string;
  mustChangePassword?: boolean;
}

export interface ClientMembershipItem {
  id: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions: string[];
}

export interface AuthResponseData {
  token?: string;
  user: UserProfile;
  memberships: ClientMembershipItem[];
  permissions: string[];
}

export const loginApi = async (credentials: { email: string; password: string }): Promise<AuthResponseData> => {
  const response = await api.post<ApiResponse<AuthResponseData>>('/auth/login', credentials);
  return response.data.data!;
};

export const logoutApi = async (): Promise<void> => {
  await api.post('/auth/logout');
};

export const getMeApi = async (): Promise<AuthResponseData> => {
  const response = await api.get<ApiResponse<AuthResponseData>>('/auth/me');
  return response.data.data!;
};

export const forgotPasswordApi = async (email: string): Promise<string> => {
  const response = await api.post<ApiResponse<null>>('/auth/forgot-password', { email });
  return response.data.message || 'Recovery email dispatched';
};

export const resetPasswordApi = async (token: string, password: string): Promise<string> => {
  const response = await api.post<ApiResponse<null>>('/auth/reset-password', { token, password });
  return response.data.message || 'Password updated successfully';
};

export const changePasswordApi = async (currentPassword: string, newPassword: string): Promise<string> => {
  const response = await api.put<ApiResponse<null>>('/auth/change-password', { currentPassword, newPassword });
  return response.data.message || 'Password changed successfully';
};
