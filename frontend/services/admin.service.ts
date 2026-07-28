import { apiFetch } from '@/lib/api';
import type { Paginated } from '@saas-starter/shared';

export type UserStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';
export type AppRole = 'USER' | 'ADMIN';

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  roles: AppRole[];
  status: UserStatus;
  provider: string;
  keycloakSub?: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt?: string;
  permissions?: string[];
  memberships?: Array<{
    id: string;
    role: AppRole;
    organization: {
      id: string;
      name: string;
      slug: string;
      status: string;
    };
  }>;
};

export type ListUsersParams = {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: UserStatus;
  role?: AppRole;
};

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function listAdminUsers(
  token: string,
  params: ListUsersParams = {},
): Promise<Paginated<AdminUser>> {
  return apiFetch(`/admin/users${qs(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAdminUser(token: string, id: string): Promise<AdminUser> {
  return apiFetch(`/admin/users/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function disableUser(token: string, id: string): Promise<AdminUser> {
  return apiFetch(`/admin/users/${id}/disable`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function enableUser(token: string, id: string): Promise<AdminUser> {
  return apiFetch(`/admin/users/${id}/enable`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function setUserRoles(
  token: string,
  id: string,
  roles: AppRole[],
): Promise<AdminUser> {
  return apiFetch(`/admin/users/${id}/roles`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ roles }),
  });
}

export function updateUserProfile(
  token: string,
  id: string,
  body: {
    name?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  },
): Promise<AdminUser> {
  return apiFetch(`/users/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export function listAudit(token: string, limit = 30) {
  return apiFetch(`/admin/audit?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
