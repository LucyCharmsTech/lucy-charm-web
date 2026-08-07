'use client';

/**
 * Routes realtime notification events into the notification store. Registered
 * once, from `NotificationBell` — the bell is mounted for every signed-in
 * session, and the store is what the panel and `/notifications` page render
 * from, so one wiring point keeps every surface live.
 *
 * Events arrive on the auto-granted `user:{me}` channel; no subscribe needed.
 */

import { useNotificationStore } from '@/stores/notificationStore';
import { useRealtimeEvent, useRefetchOnReconnect } from '@/lib/realtime/hooks';
import type { NotificationCreatedPayload, NotificationReadStatePayload } from '@/types/api';

export function useLiveNotifications(): void {
  useRealtimeEvent<NotificationCreatedPayload>('notification.created', ({ payload }) => {
    useNotificationStore
      .getState()
      .applyRealtimeCreated(payload.notification, payload.unread_count);
  });

  // Read-state events come from this user's *other* sessions — or are the echo
  // of this tab's own optimistic mutation. The appliers merge idempotently, so
  // both look the same.
  useRealtimeEvent<NotificationReadStatePayload>('notification.read', ({ payload }) => {
    if (!payload.notification_id) return;
    useNotificationStore
      .getState()
      .applyRealtimeRead(payload.notification_id, payload.unread_count);
  });

  useRealtimeEvent<NotificationReadStatePayload>('notification.read_all', ({ payload }) => {
    useNotificationStore.getState().applyRealtimeReadAll(payload.unread_count);
  });

  useRealtimeEvent<NotificationReadStatePayload>('notification.dismissed', ({ payload }) => {
    if (!payload.notification_id) return;
    useNotificationStore
      .getState()
      .applyRealtimeDismissed(payload.notification_id, payload.unread_count);
  });

  // Events missed during a drop may be older than the replay buffer — reconcile
  // the badge always, and the list only if something already loaded it.
  useRefetchOnReconnect(() => {
    const store = useNotificationStore.getState();
    void store.loadUnreadCount();
    if (store.loaded) void store.loadFirstPage();
  });
}
