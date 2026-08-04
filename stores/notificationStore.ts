/**
 * Notification centre store.
 *
 * Deliberately NOT persisted: unread state is server-owned, and a stale copy in
 * localStorage would show a wrong badge after another device marks things read.
 *
 * Mutations are optimistic. `markRead` and `dismiss` roll back only the affected row,
 * never the whole list, which would resurrect rows changed in the meantime.
 * `markAllRead` is the exception — it touched every row, so it restores the snapshot.
 *
 * Each mutation clears `error` as it starts, so a failure from an earlier one cannot
 * linger and suppress the empty state.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  dismissNotification,
  fetchMyNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationService';
import type { AppNotification } from '@/types/api';

const PAGE_SIZE = 20;

/**
 * The API returns 404 rather than 403 for another user's notification, so a 404
 * never means "impossible" — it means gone. Drop the row instead of erroring.
 */
function isGone(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404;
}

function patchItem(
  items: AppNotification[],
  id: string,
  patch: Partial<AppNotification>,
): AppNotification[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

interface NotificationState {
  items: AppNotification[];
  unread: number;
  total: number;
  page: number;
  unreadOnly: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;

  /** True once a first fetch has settled — lets the UI hold off on "no notifications". */
  loaded: boolean;

  /** Replace the list with page 1. Called when the panel opens. */
  loadFirstPage: () => Promise<void>;

  /** Append the next page. No-op while one is in flight or the list is complete. */
  loadNextPage: () => Promise<void>;

  /** Badge only — cheap enough to poll on an interval. */
  loadUnreadCount: () => Promise<void>;

  /** Switch between all and unread-only, reloading from page 1. */
  setUnreadOnly: (unreadOnly: boolean) => Promise<void>;

  /** Optimistic; rolls the row back if the request fails. */
  markRead: (id: string) => Promise<void>;

  markAllRead: () => Promise<void>;

  /** Soft delete. Optimistic; a 404 means it was already gone, so it stays removed. */
  dismiss: (id: string) => Promise<void>;

  /** Wipe on logout so one user's notifications never leak into the next session. */
  reset: () => void;
}

const INITIAL = {
  items: [] as AppNotification[],
  unread: 0,
  total: 0,
  page: 1,
  unreadOnly: false,
  loading: false,
  loadingMore: false,
  error: null as string | null,
  loaded: false,
};

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set, get) => ({
      ...INITIAL,

      loadFirstPage: async () => {
        set({ loading: true, error: null }, false, 'notifications/loadFirstPage');
        try {
          const data = await fetchMyNotifications(1, PAGE_SIZE, get().unreadOnly);
          set(
            {
              items: data.items,
              total: data.total,
              page: 1,
              loading: false,
              loaded: true,
            },
            false,
            'notifications/loadFirstPage:done',
          );
          // `unread` is owned by loadUnreadCount — counting page 1 would undercount
          // when unread rows sit further down the list.
          await get().loadUnreadCount();
        } catch (err: unknown) {
          set(
            {
              loading: false,
              loaded: true,
              error: getApiErrorMessage(err, 'Could not load notifications.'),
            },
            false,
            'notifications/loadFirstPage:error',
          );
        }
      },

      loadNextPage: async () => {
        const { loadingMore, items, total, page, unreadOnly } = get();
        if (loadingMore || items.length >= total) return;

        set({ loadingMore: true, error: null }, false, 'notifications/loadNextPage');
        try {
          const data = await fetchMyNotifications(page + 1, PAGE_SIZE, unreadOnly);
          set(
            {
              items: [...get().items, ...data.items],
              total: data.total,
              page: page + 1,
              loadingMore: false,
            },
            false,
            'notifications/loadNextPage:done',
          );
        } catch (err: unknown) {
          set(
            {
              loadingMore: false,
              error: getApiErrorMessage(err, 'Could not load more notifications.'),
            },
            false,
            'notifications/loadNextPage:error',
          );
        }
      },

      loadUnreadCount: async () => {
        try {
          const { unread } = await fetchUnreadNotificationCount();
          set({ unread }, false, 'notifications/loadUnreadCount');
        } catch {
          // A failed badge poll is not worth surfacing — the next tick retries.
        }
      },

      setUnreadOnly: async (unreadOnly) => {
        set({ unreadOnly }, false, 'notifications/setUnreadOnly');
        await get().loadFirstPage();
      },

      markRead: async (id) => {
        const target = get().items.find((item) => item.id === id);
        if (!target || target.is_read) return;

        set(
          {
            items: patchItem(get().items, id, {
              is_read: true,
              read_at: new Date().toISOString(),
            }),
            unread: Math.max(0, get().unread - 1),
            error: null,
          },
          false,
          'notifications/markRead',
        );

        try {
          // The row comes back with the server's own read_at, which is the value
          // the next list fetch will agree with.
          const updated = await markNotificationRead(id);
          set({ items: patchItem(get().items, id, updated) }, false, 'notifications/markRead:done');
        } catch (err: unknown) {
          if (isGone(err)) {
            set(
              {
                items: get().items.filter((item) => item.id !== id),
                total: Math.max(0, get().total - 1),
              },
              false,
              'notifications/markRead:gone',
            );
          } else {
            set(
              {
                items: patchItem(get().items, id, {
                  is_read: target.is_read,
                  read_at: target.read_at,
                }),
                error: getApiErrorMessage(err, 'Could not mark as read.'),
              },
              false,
              'notifications/markRead:rollback',
            );
          }
          await get().loadUnreadCount();
        }
      },

      markAllRead: async () => {
        const previous = get().items;
        const previousUnread = get().unread;
        if (previousUnread === 0) return;

        const readAt = new Date().toISOString();
        set(
          {
            items: previous.map((item) =>
              item.is_read ? item : { ...item, is_read: true, read_at: readAt },
            ),
            unread: 0,
            error: null,
          },
          false,
          'notifications/markAllRead',
        );

        try {
          await markAllNotificationsRead();
        } catch (err: unknown) {
          set(
            {
              items: previous,
              unread: previousUnread,
              error: getApiErrorMessage(err, 'Could not mark all as read.'),
            },
            false,
            'notifications/markAllRead:rollback',
          );
        }
      },

      dismiss: async (id) => {
        const index = get().items.findIndex((item) => item.id === id);
        if (index === -1) return;
        const target = get().items[index];

        set(
          {
            items: get().items.filter((item) => item.id !== id),
            total: Math.max(0, get().total - 1),
            unread: target.is_read ? get().unread : Math.max(0, get().unread - 1),
            error: null,
          },
          false,
          'notifications/dismiss',
        );

        try {
          await dismissNotification(id);
        } catch (err: unknown) {
          // Already dismissed elsewhere (or never ours) — leaving it removed is correct.
          if (isGone(err)) return;

          const restored = [...get().items];
          restored.splice(index, 0, target);
          set(
            {
              items: restored,
              total: get().total + 1,
              unread: target.is_read ? get().unread : get().unread + 1,
              error: getApiErrorMessage(err, 'Could not dismiss that notification.'),
            },
            false,
            'notifications/dismiss:rollback',
          );
        }
      },

      reset: () => set({ ...INITIAL }, false, 'notifications/reset'),
    }),
    { name: 'notificationStore' },
  ),
);
