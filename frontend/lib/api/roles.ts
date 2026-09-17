import { apiClient, ApiResponse } from '../api';

export interface RoleItem {
  id: string;
  _id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  permissionCodes: string[];
  permissions: string[];
  userCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export const getRolesApi = async (): Promise<RoleItem[]> => {
  const res = await apiClient.get<ApiResponse<{ roles: RoleItem[] }>>('/admin/roles');
  return res.data.data?.roles || [];
};

export const createRoleApi = async (data: {
  name: string;
  slug: string;
  description?: string;
  permissionCodes: string[];
}): Promise<RoleItem> => {
  const res = await apiClient.post<ApiResponse<RoleItem>>('/admin/roles', data);
  return res.data.data!;
};

export const updateRoleApi = async (
  roleId: string,
  data: {
    name?: string;
    description?: string;
    permissionCodes?: string[];
  }
): Promise<RoleItem> => {
  const res = await apiClient.put<ApiResponse<RoleItem>>(`/admin/roles/${roleId}`, data);
  return res.data.data!;
};

export const deleteRoleApi = async (roleId: string): Promise<void> => {
  await apiClient.delete<ApiResponse<{ deleted: boolean }>>(`/admin/roles/${roleId}`);
};
