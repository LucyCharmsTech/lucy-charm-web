'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { BellIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

/**
 * Loaded on first open, not with the page. `NavBar` lives in the root layout, so a
 * static import would put the panel, the rows and their ConfirmDialog into the chunk
 * every route downloads — including for signed-out visitors, who never see the bell.
 */
const NotificationPanel = dynamic(() => import('@/components/notifications/NotificationPanel'));

/**
 * How often the badge re-checks. There is no websocket or SSE — the API is built
 * for polling and the count is a single indexed COUNT. Per-user authenticated
 * query, so not aggressive.
 */
const UNREAD_POLL_MS = 60_000;

export default function NotificationBell() {
  const authed = useAuthStore((s) => Boolean(s.accessToken));
  const { unread, setUnreadOnly, loadUnreadCount } = useNotificationStore(
    useShallow((s) => ({
      unread: s.unread,
      setUnreadOnly: s.setUnreadOnly,
      loadUnreadCount: s.loadUnreadCount,
    })),
  );

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authed) return;

    void loadUnreadCount();
    const interval = setInterval(() => void loadUnreadCount(), UNREAD_POLL_MS);

    // A backgrounded tab misses ticks, so refresh the moment it is looked at
    // again rather than showing a badge that is up to a minute stale.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void loadUnreadCount();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authed, loadUnreadCount]);

  useEffect(() => {
    if (!open) return;

    // A ConfirmDialog opened from a row is portalled to <body>, so it sits outside
    // this container. Without these guards, interacting with it would close the panel
    // and unmount the dialog mid-decision.
    function isInsideModal(node: Node | null): boolean {
      return node instanceof Element && Boolean(node.closest('[data-modal-root]'));
    }

    function handleClickOutside(e: MouseEvent) {
      if (isInsideModal(e.target as Node)) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      // Let the dialog consume Escape first; it closes itself, not the panel.
      if (e.key === 'Escape' && !document.querySelector('[data-modal-root]')) setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (!authed) return null;

  function handleToggle() {
    const next = !open;
    setOpen(next);
    // Loads page 1. Also clears any "Unread only" left set from /notifications — the
    // store outlives that page, and the dropdown has no filter control to undo it with.
    if (next) void setUnreadOnly(false);
  }

  const badgeLabel = unread > 99 ? '99+' : String(unread);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, none unread'}
        className="relative cursor-pointer rounded-full border border-zinc-200/80 bg-white p-2 text-zinc-600 shadow-sm transition hover:border-primarycolor/40 hover:bg-primarycolor/5 hover:text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <BellIcon className="size-4" aria-hidden="true" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primarycolor px-1 text-[10px] font-bold leading-4 text-white"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}
