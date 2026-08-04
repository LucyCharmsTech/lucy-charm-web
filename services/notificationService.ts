/**
 * Notification-centre API calls (all authenticated).
 * GET /notifications/, GET /notifications/unread-count,
 * POST /notifications/:id/read, POST /notifications/read-all,
 * DELETE /notifications/:id
 */

import api from '@/lib/axios';
import type {
  ApiPaginated,
  AppNotification,
  NotificationMarkAllReadResponse,
  NotificationUnreadCount,
} from '@/types/api';

/**
 * Inbox for the current user, newest first.
 *
 * The trailing slash is required: `/notifications` answers 307, and some proxies
 * drop the Authorization header across a redirect. The other four routes take none.
 */
export async function fetchMyNotifications(
  page = 1,
  size = 20,
  unreadOnly = false,
): Promise<ApiPaginated<AppNotification>> {
  const res = await api.get<ApiPaginated<AppNotification>>('/notifications/', {
    params: { page, size, unread_only: unreadOnly },
  });
  return res.data;
}

/** Badge count — a single indexed COUNT, cheap enough to poll. */
export async function fetchUnreadNotificationCount(): Promise<NotificationUnreadCount> {
  const res = await api.get<NotificationUnreadCount>('/notifications/unread-count');
  return res.data;
}

/** Idempotent; returns the updated row so it can be patched into local state. */
export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await api.post<AppNotification>(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<NotificationMarkAllReadResponse> {
  const res = await api.post<NotificationMarkAllReadResponse>('/notifications/read-all');
  return res.data;
}

/** Soft delete. Returns the dismissed row; a second call 404s. */
export async function dismissNotification(id: string): Promise<AppNotification> {
  const res = await api.delete<AppNotification>(`/notifications/${id}`);
  return res.data;
}
