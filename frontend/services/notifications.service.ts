import { apiFetch } from '@/lib/api';
import type { AppNotificationEvent } from '@saas-starter/shared';

export type NotificationRow = {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPreference = {
  eventType: AppNotificationEvent | string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export function listNotifications(token: string, limit = 50) {
  return apiFetch<NotificationRow[]>(`/notifications?limit=${limit}`, {
    headers: authHeaders(token),
  });
}

export function getUnreadCount(token: string) {
  return apiFetch<{ count: number }>('/notifications/unread-count', {
    headers: authHeaders(token),
    showLoading: false,
  });
}

export function markNotificationRead(token: string, id: string) {
  return apiFetch<NotificationRow>(`/notifications/${id}/read`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
}

export function markAllNotificationsRead(token: string) {
  return apiFetch<{ ok: boolean }>('/notifications/read-all', {
    method: 'PATCH',
    headers: authHeaders(token),
  });
}

export function getNotificationPreferences(token: string) {
  return apiFetch<NotificationPreference[]>('/notifications/preferences', {
    headers: authHeaders(token),
  });
}

export function updateNotificationPreference(
  token: string,
  body: {
    eventType: string;
    emailEnabled?: boolean;
    inAppEnabled?: boolean;
    smsEnabled?: boolean;
    pushEnabled?: boolean;
  },
) {
  return apiFetch<NotificationPreference>('/notifications/preferences', {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
