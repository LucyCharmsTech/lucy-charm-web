'use client';

import { useState } from 'react';
import Link from 'next/link';
import { XIcon } from 'lucide-react';

import ConfirmDialog from '@/components/common/ConfirmDialog';
import { notificationVisual } from '@/components/notifications/notificationMeta';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/relativeTime';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types/api';

type NotificationItemProps = {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  /** Called after a deep link is followed, so a dropdown can close itself. */
  onNavigate?: () => void;
};

export default function NotificationItem({
  notification,
  onRead,
  onDismiss,
  onNavigate,
}: NotificationItemProps) {
  const { Icon, tone } = notificationVisual(notification.event_type);
  const unread = !notification.is_read;
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);

  function handleActivate() {
    if (unread) onRead(notification.id);
    onNavigate?.();
  }

  const body = (
    <>
      <span
        className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-xl', tone)}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 text-sm text-zinc-900 dark:text-zinc-50',
              unread ? 'font-semibold' : 'font-medium',
            )}
          >
            {notification.title}
          </span>
          {unread && (
            <span className="mt-1.5 inline-flex shrink-0 items-center">
              <span className="size-2 rounded-full bg-primarycolor" aria-hidden="true" />
              <span className="sr-only">Unread</span>
            </span>
          )}
        </span>

        {notification.body && (
          <span className="mt-0.5 block text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {notification.body}
          </span>
        )}

        <time
          dateTime={notification.created_at}
          title={formatAbsoluteTime(notification.created_at)}
          className="mt-1 block text-[11px] font-medium text-zinc-400 dark:text-zinc-500"
        >
          {formatRelativeTime(notification.created_at)}
        </time>
      </span>
    </>
  );

  const activator = cn(
    'flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 text-left',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primarycolor',
  );

  return (
    <div
      className={cn(
        'flex items-start transition',
        unread
          ? 'bg-primarycolor/5 hover:bg-primarycolor/10'
          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
      )}
    >
      {notification.deep_link ? (
        <Link href={notification.deep_link} onClick={handleActivate} className={activator}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={handleActivate} className={activator}>
          {body}
        </button>
      )}

      <button
        type="button"
        onClick={() => setConfirmingDismiss(true)}
        aria-label={`Delete: ${notification.title}`}
        aria-haspopup="dialog"
        className="mr-2 mt-3 shrink-0 rounded-md p-1 text-zinc-400 transition hover:bg-zinc-200/70 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
      >
        <XIcon className="size-3.5" aria-hidden="true" />
      </button>

      <ConfirmDialog
        open={confirmingDismiss}
        tone="danger"
        title="Delete this notification?"
        description={
          <>
            <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
              “{notification.title}”
            </strong>{' '}
            will be removed from your notifications. This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={() => {
          setConfirmingDismiss(false);
          onDismiss(notification.id);
        }}
        onCancel={() => setConfirmingDismiss(false)}
      />
    </div>
  );
}
