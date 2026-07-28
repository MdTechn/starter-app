import { apiFetch } from '@/lib/api';

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    status: string;
  };
};

export type OrganizationDetail = OrganizationSummary & {
  members: OrganizationMember[];
  memberLimit: number | null;
  pendingInviteCount: number;
};

export type UserInvitation = {
  id: string;
  email: string;
  token?: string;
  role: string;
  status: string;
  organizationId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  organization?: { id: string; name: string; slug: string } | null;
  invitedBy?: { id: string; email: string; name: string | null } | null;
};

export type InvitationPreview = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organizationId: string | null;
  organization: { id: string; name: string; slug: string } | null;
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function listOrganizations(token: string) {
  return apiFetch<OrganizationSummary[]>('/organizations', {
    headers: authHeaders(token),
  });
}

export function getOrganization(token: string, id: string) {
  return apiFetch<OrganizationDetail>(`/organizations/${id}`, {
    headers: authHeaders(token),
  });
}

export function addOrganizationMember(
  token: string,
  orgId: string,
  body: { userId: string; role?: string },
) {
  return apiFetch<OrganizationMember>(`/organizations/${orgId}/members`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export function removeOrganizationMember(
  token: string,
  orgId: string,
  userId: string,
) {
  return apiFetch<{ ok: boolean }>(
    `/organizations/${orgId}/members/${userId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  );
}

export function updateOrganizationMemberRole(
  token: string,
  orgId: string,
  userId: string,
  role: string,
) {
  return apiFetch(`/organizations/${orgId}/members/${userId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ role }),
  });
}

export function listInvitations(
  token: string,
  query?: { status?: string; page?: number; pageSize?: number },
) {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.page) params.set('page', String(query.page));
  if (query?.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return apiFetch<{
    items: UserInvitation[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/invitations${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token),
  });
}

export function createInvitation(
  token: string,
  body: {
    email: string;
    role?: string;
    organizationId?: string;
    expiresInDays?: number;
  },
) {
  return apiFetch<UserInvitation>('/admin/invitations', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export function revokeInvitation(token: string, id: string) {
  return apiFetch<UserInvitation>(`/admin/invitations/${id}/revoke`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
}

export function previewInvitation(token: string, inviteToken: string) {
  return apiFetch<InvitationPreview>(
    `/organizations/invitations/preview?token=${encodeURIComponent(inviteToken)}`,
    { headers: authHeaders(token) },
  );
}

export function acceptInvitation(token: string, inviteToken: string) {
  return apiFetch<UserInvitation>('/organizations/invitations/accept', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ token: inviteToken }),
  });
}
