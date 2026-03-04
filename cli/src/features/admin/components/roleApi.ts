import { BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export interface PermissionCatalogItem {
  perm_key: string;
  module_key: string;
  desc_zh: string;
  desc_en: string;
}

export interface RolePermissionView {
  role_id: number;
  role_key: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  default_storage_quota: number;
  permission_keys: string[];
}

interface RolesResponse {
  roles: RolePermissionView[];
  permissions: PermissionCatalogItem[];
}

export interface UserPermissionOverrideItem {
  perm_key: string;
  effect: number;
}

export interface UserPermissionPayload {
  catalog: PermissionCatalogItem[];
  overrides: UserPermissionOverrideItem[];
  effective_permissions: string[];
}

const getAuthHeader = (): HeadersInit => {
  const token = useAuthStore.getState().currentUserData?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchRolesAndPermissions = async (): Promise<RolesResponse> => {
  const response = await fetch(`${BASE_URL}/api/v1/users/admin/roles`, {
    headers: getAuthHeader(),
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: RolesResponse; msg?: string } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.msg || "Failed to load roles");
  }
  return payload.data;
};

export const updateRolePermissions = async (
  roleId: number,
  payload: { permission_keys: string[]; default_storage_quota?: number | null },
): Promise<void> => {
  const response = await fetch(`${BASE_URL}/api/v1/users/admin/roles/${roleId}/permissions`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null) as { success?: boolean; msg?: string } | null;
  if (!response.ok || !data?.success) {
    throw new Error(data?.msg || "Failed to update role permissions");
  }
};

export const fetchUserPermissions = async (userId: string): Promise<UserPermissionPayload> => {
  const response = await fetch(`${BASE_URL}/api/v1/users/admin/users/${userId}/permissions`, {
    headers: getAuthHeader(),
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: UserPermissionPayload; msg?: string } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.msg || "Failed to load user permissions");
  }
  return payload.data;
};

export const updateUserPermissions = async (userId: string, overrides: UserPermissionOverrideItem[]): Promise<void> => {
  const response = await fetch(`${BASE_URL}/api/v1/users/admin/users/${userId}/permissions`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ overrides }),
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; msg?: string } | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.msg || "Failed to update user permissions");
  }
};
