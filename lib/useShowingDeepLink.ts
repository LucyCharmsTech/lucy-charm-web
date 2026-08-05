'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Notification deep links land on a list page carrying the showing they are about:
 * `/profile?showing=<uuid>` for clients, `/agent/showings?showing=<uuid>` for agents.
 *
 * There is no per-showing detail route on either side, so the param is how a
 * notification points at one row. The API stores these paths on the notification
 * itself, so the param name is part of the contract — changing it here also needs
 * a change in lucy-charm-api `app/api/notifications/deep_links.py`, and old rows
 * keep their existing paths regardless.
 */
const SHOWING_DEEP_LINK_PARAM = 'showing';

/** Rows opt into being a deep-link target by carrying this id. */
export function showingAnchorId(showingRequestId: string): string {
  return `showing-${showingRequestId}`;
}

/**
 * Scroll delay. The row has to exist before it can be scrolled to, and `ready`
 * only tells us the data arrived — React still has to paint it.
 */
const SCROLL_DELAY_MS = 200;

/**
 * Resolve `?showing=<uuid>` and scroll that row into view once `ready` is true.
 * Returns the id so the caller can highlight the matching row.
 *
 * Pass `ready` as "the list has loaded" — without it the effect fires against an
 * empty list and silently does nothing.
 */
export function useShowingDeepLink(ready: boolean): string | null {
  const searchParams = useSearchParams();
  const showingId = searchParams.get(SHOWING_DEEP_LINK_PARAM);

  useEffect(() => {
    if (!ready || !showingId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(showingAnchorId(showingId))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, SCROLL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ready, showingId]);

  return showingId;
}
