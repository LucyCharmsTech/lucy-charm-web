'use client';

/**
 * Realtime wiring for a list of showing requests — shared by the agent queue
 * (`app/agent/showings`) and the client schedule (`ClientShowingScheduleSection`),
 * which hold the same `ShowingRequest[]` state and need the same event handling.
 *
 * Every showing event reaches the auto-granted `user:{me}` channel, so no
 * subscribe call is needed. Two wire facts shape the implementation:
 *
 *   * The API publishes one change to several channels with *distinct* event
 *     ids — an agent hears it on both `user:` and `agent:` — so patches must be
 *     idempotent merges and refetches are coalesced.
 *   * Events fire for this user's own actions too (their other tabs must not
 *     go stale). Merging by field makes the echo of an optimistic update a
 *     harmless no-op.
 */

import { useEffect, useRef } from 'react';
import { useRealtimeEvent, useRefetchOnReconnect, useRestFallback } from '@/lib/realtime/hooks';
import type {
  ShowingDocumentUploadedPayload,
  ShowingFeedbackSubmittedPayload,
  ShowingIdVerificationChangedPayload,
  ShowingRequest,
  ShowingStatusChangedPayload,
  ShowingWithdrawnPayload,
} from '@/types/api';

/** Wide enough to swallow the multi-channel duplicates of one change. */
const REFETCH_DEBOUNCE_MS = 300;
/** Cadence of the REST fallback while the socket is down. */
const FALLBACK_POLL_MS = 30_000;

type LiveShowingRequestHandlers = {
  /** Merge a partial change into the row, if the list holds it. */
  patch: (id: string, patch: Partial<ShowingRequest>) => void;
  /** Drop the row — the request was withdrawn. */
  remove: (id: string) => void;
  /** Reload the list from REST. Must be silent — no loading flicker. */
  refetch: () => void;
};

export function useLiveShowingRequests(handlers: LiveShowingRequestHandlers): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRefetch() {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      ref.current.refetch();
    }, REFETCH_DEBOUNCE_MS);
  }
  useEffect(
    () => () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    },
    [],
  );

  useRealtimeEvent<ShowingStatusChangedPayload>('showing.status_changed', (event) => {
    const { payload } = event;
    if (payload.previous_status === null) {
      // A brand-new request — the event cannot build the row (no buyer fields
      // on the wire), so let REST supply it.
      scheduleRefetch();
      return;
    }
    ref.current.patch(payload.showing_request_id, {
      status: payload.status,
      scheduled_at: payload.scheduled_at,
      ...(payload.id_verification_status
        ? { id_verification_status: payload.id_verification_status }
        : {}),
      // The server stamps rescheduled_at itself; the event time is close enough
      // for the "Originally requested" hint until the next full fetch.
      ...(payload.rescheduled ? { rescheduled_at: event.occurred_at } : {}),
    });
  });

  useRealtimeEvent<ShowingWithdrawnPayload>('showing.withdrawn', ({ payload }) => {
    ref.current.remove(payload.showing_request_id);
  });

  useRealtimeEvent<ShowingIdVerificationChangedPayload>(
    'showing.id_verification_changed',
    ({ payload }) => {
      ref.current.patch(payload.showing_request_id, {
        id_verification_status: payload.id_verification_status,
      });
    },
  );

  // Buyer → agent: an ID landed in the review queue without a reload.
  useRealtimeEvent<ShowingDocumentUploadedPayload>('showing.document_uploaded', ({ payload }) => {
    ref.current.patch(payload.showing_request_id, {
      id_verification_status: payload.id_verification_status,
      identity_document_uploaded: true,
    });
  });

  // Structured signal only — feedback_comment stays behind the REST read.
  useRealtimeEvent<ShowingFeedbackSubmittedPayload>('showing.feedback_submitted', ({ payload }) => {
    ref.current.patch(payload.showing_request_id, {
      feedback_submitted_at: payload.feedback_submitted_at,
      feedback_rating: payload.feedback_rating,
      feedback_interest_level: payload.feedback_interest_level,
      feedback_price_fit: payload.feedback_price_fit,
      feedback_would_offer: payload.feedback_would_offer,
    });
  });

  // Changes missed while disconnected may be older than the replay buffer.
  useRefetchOnReconnect(scheduleRefetch);

  // With the socket down, fall back to polling — plus a refresh whenever the
  // tab becomes visible again, since a backgrounded tab misses ticks.
  const polling = useRestFallback();
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => ref.current.refetch(), FALLBACK_POLL_MS);
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') ref.current.refetch();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [polling]);
}
