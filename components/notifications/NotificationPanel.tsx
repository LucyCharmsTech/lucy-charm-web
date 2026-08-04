'use client';

import Link from 'next/link';
import { LoaderIcon, BellOffIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import NotificationItem from '@/components/notifications/NotificationItem';
import { useNotificationStore } from '@/stores/notificationStore';

/** Dropdown body for `NotificationBell`. The bell owns open/close and loading triggers. */
export default function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { items, unread, loaded, error, markRead, markAllRead, dismiss } = useNotificationStore(
    useShallow((s) => ({
      items: s.items,
      unread: s.unread,
      loaded: s.loaded,
      error: s.error,
      markRead: s.markRead,
      markAllRead: s.markAllRead,
      dismiss: s.dismiss,
    })),
  );

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      // The bell renders at every breakpoint, so cap the width on narrow phones —
      // a fixed 22rem overflows the left edge of a 320px viewport.
      className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-lg dark:border-zinc-700/80 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notifications</p>
        {unread > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="rounded-md text-xs font-semibold text-primarycolor transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            Mark all as read
          </button>
        )}
      </div>

      {!loaded && !error && (
        <p className="flex items-center gap-2 px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          Loading notifications…
        </p>
      )}

      {error && (
        <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {loaded && !error && items.length === 0 && (
        <div className="px-4 py-8 text-center">
          <BellOffIcon
            className="mx-auto size-6 text-zinc-300 dark:text-zinc-600"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            You are all caught up
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Showing confirmations and ID reviews will appear here.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationItem
                notification={item}
                onRead={(id) => void markRead(id)}
                onDismiss={(id) => void dismiss(id)}
                onNavigate={onClose}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <Link
          href="/notifications"
          onClick={onClose}
          className="rounded-md text-xs font-semibold text-primarycolor transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
