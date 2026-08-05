'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { BellOffIcon, LoaderIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import NotificationItem from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

export default function NotificationsPageView() {
  const authed = useAuthStore((s) => Boolean(s.accessToken));
  const {
    items,
    unread,
    total,
    unreadOnly,
    loaded,
    loadingMore,
    error,
    loadFirstPage,
    loadNextPage,
    setUnreadOnly,
    markRead,
    markAllRead,
    dismiss,
  } = useNotificationStore(
    useShallow((s) => ({
      items: s.items,
      unread: s.unread,
      total: s.total,
      unreadOnly: s.unreadOnly,
      loaded: s.loaded,
      loadingMore: s.loadingMore,
      error: s.error,
      loadFirstPage: s.loadFirstPage,
      loadNextPage: s.loadNextPage,
      setUnreadOnly: s.setUnreadOnly,
      markRead: s.markRead,
      markAllRead: s.markAllRead,
      dismiss: s.dismiss,
    })),
  );

  useEffect(() => {
    if (!authed) return;
    void loadFirstPage();
  }, [authed, loadFirstPage]);

  const hasMore = items.length < total;

  return (
    <div className="min-h-screen bg-[#fef6f9] dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <Link
            href="/profile"
            className="text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            ← Back to profile
          </Link>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Appointment and verification updates, newest first.
          </p>
        </div>

        {!authed && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Sign in to see your notifications
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Showing confirmations, reschedules, and ID reviews are tied to your account.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                className="rounded-xl bg-primarycolor font-semibold text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor"
              >
                <Link href="/login?redirect=%2Fnotifications">Sign in</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl border-primarycolor/25 font-semibold"
              >
                <Link href="/register">Create an account</Link>
              </Button>
            </div>
          </div>
        )}

        {authed && (
          <section
            className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
            aria-labelledby="notifications-heading"
          >
            <span id="notifications-heading" className="sr-only">
              All notifications
            </span>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-label="Filter notifications"
              >
                {[
                  { label: 'All', value: false },
                  {
                    label: `Unread${unread > 0 ? ` (${unread})` : ''}`,
                    value: true,
                  },
                ].map((filter) => (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={() => void setUnreadOnly(filter.value)}
                    aria-pressed={unreadOnly === filter.value}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor',
                      unreadOnly === filter.value
                        ? 'bg-primarycolor text-white'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

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
              <p className="flex items-center gap-2 px-4 py-8 text-sm text-zinc-500 dark:text-zinc-400">
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
              <div className="px-4 py-12 text-center">
                <BellOffIcon
                  className="mx-auto size-7 text-zinc-300 dark:text-zinc-600"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {unreadOnly ? 'Nothing unread' : 'No notifications yet'}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Showing confirmations, reschedules, and ID reviews will appear here.
                </p>
              </div>
            )}

            {items.length > 0 && (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((item) => (
                  <li key={item.id}>
                    <NotificationItem
                      notification={item}
                      onRead={(id) => void markRead(id)}
                      onDismiss={(id) => void dismiss(id)}
                    />
                  </li>
                ))}
              </ul>
            )}

            {hasMore && (
              <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={loadingMore}
                  onClick={() => void loadNextPage()}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
