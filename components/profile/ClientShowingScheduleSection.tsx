'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import ShowingFeedbackDialog from '@/components/profile/ShowingFeedbackDialog';
import ShowingIdentityUploadButton, {
  canUploadShowingIdentity,
  isShowingIdentityAwaitingReview,
} from '@/components/profile/ShowingIdentityUploadButton';
import { useLiveShowingRequests } from '@/lib/useLiveShowingRequests';
import { showingAnchorId, useShowingDeepLink } from '@/lib/useShowingDeepLink';
import { cn } from '@/lib/utils';
import { fetchListingById } from '@/services/listingsService';
import { fetchMyShowingRequests } from '@/services/showingService';
import type { ShowingRequest } from '@/types/api';

function sortByPreferredDate(rows: ShowingRequest[]): ShowingRequest[] {
  return [...rows].sort(
    (a, b) => new Date(a.preferred_date).getTime() - new Date(b.preferred_date).getTime(),
  );
}

function statusTone(status: ShowingRequest['status']): string {
  if (status === 'confirmed' || status === 'rescheduled') {
    return 'text-emerald-700 dark:text-emerald-400';
  }
  if (status === 'cancelled') return 'text-red-700 dark:text-red-400';
  return 'text-zinc-700 dark:text-zinc-300';
}

function statusLabel(status: ShowingRequest['status']): string {
  if (status === 'rescheduled') return 'confirmed';
  return status;
}

function visitBadge(status: ShowingRequest['status']): string {
  if (status === 'cancelled') return 'Visit cancelled';
  return 'Visit booked';
}

export default function ClientShowingScheduleSection() {
  const [items, setItems] = useState<ShowingRequest[]>([]);
  const [listingTitlesById, setListingTitlesById] = useState<Record<string, string>>({});
  const [activeFeedbackRequest, setActiveFeedbackRequest] = useState<ShowingRequest | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const highlightedShowingId = useShowingDeepLink(!loading);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchMyShowingRequests();
        if (!active) return;
        const sorted = sortByPreferredDate(rows);
        setItems(sorted);

        const uniqueListingIds = Array.from(new Set(sorted.map((row) => row.listing_id)));
        const titlePairs = await Promise.all(
          uniqueListingIds.map(async (listingId) => {
            try {
              const listing = await fetchListingById(listingId);
              return [listingId, listing.title] as const;
            } catch {
              return [listingId, `Listing ${listingId.slice(0, 8)}...`] as const;
            }
          }),
        );
        if (!active) return;
        setListingTitlesById(Object.fromEntries(titlePairs));
      } catch {
        if (!active) return;
        setError('Could not load your showing schedule.');
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Rows arriving after the initial load (a realtime refetch) can reference
  // listings the title cache has not seen — fill just those gaps.
  useEffect(() => {
    const missing = Array.from(new Set(items.map((item) => item.listing_id))).filter(
      (listingId) => !(listingId in listingTitlesById),
    );
    if (missing.length === 0) return;
    let active = true;
    void (async () => {
      const titlePairs = await Promise.all(
        missing.map(async (listingId) => {
          try {
            const listing = await fetchListingById(listingId);
            return [listingId, listing.title] as const;
          } catch {
            return [listingId, `Listing ${listingId.slice(0, 8)}...`] as const;
          }
        }),
      );
      if (!active) return;
      setListingTitlesById((prev) => ({ ...prev, ...Object.fromEntries(titlePairs) }));
    })();
    return () => {
      active = false;
    };
  }, [items, listingTitlesById]);

  // Agent actions (confirm, reschedule, ID review, withdrawal) land here live.
  // Silent on purpose: no loading flip, and a failed refetch keeps current rows.
  const refreshRows = useCallback(async () => {
    try {
      const rows = await fetchMyShowingRequests();
      setItems(sortByPreferredDate(rows));
    } catch {
      /* the next event, poll, or reconnect refetch retries */
    }
  }, []);

  useLiveShowingRequests({
    patch: (id, patch) =>
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    remove: (id) => setItems((prev) => prev.filter((item) => item.id !== id)),
    refetch: () => void refreshRows(),
  });

  function canLeaveFeedback(item: ShowingRequest): boolean {
    if (item.feedback_submitted_at) return false;
    if (
      item.status !== 'confirmed' &&
      item.status !== 'completed' &&
      item.status !== 'rescheduled'
    ) {
      return false;
    }
    return new Date(item.scheduled_at ?? item.preferred_date).getTime() <= Date.now();
  }

  function handleFeedbackClick(item: ShowingRequest) {
    setActiveFeedbackRequest(item);
    setFeedbackDialogOpen(true);
  }

  function handleFeedbackSubmitted(updated: ShowingRequest) {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setActiveFeedbackRequest(updated);
  }

  return (
    <section
      id="showing-schedule"
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
    >
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Showing schedule</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Track your upcoming and past showings in one place.
      </p>

      {loading && <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading showings...</p>}
      {error && !loading && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {uploadMessage && !loading && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {uploadMessage}
        </p>
      )}

      {!loading && !error && (
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No showings scheduled yet.</p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                id={showingAnchorId(item.id)}
                className={cn(
                  'rounded-xl border border-zinc-200/80 p-3 transition dark:border-zinc-700/80',
                  item.id === highlightedShowingId &&
                    'border-primarycolor/40 ring-2 ring-primarycolor/40 dark:border-primarycolor/40',
                )}
              >
                <div className="mb-2 inline-flex items-center rounded-full bg-primarycolor/10 px-2.5 py-1 text-[11px] font-semibold text-primarycolor">
                  {visitBadge(item.status)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/listings/${item.listing_id}`}
                    className="text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-100"
                  >
                    {listingTitlesById[item.listing_id] ??
                      `Listing ${item.listing_id.slice(0, 8)}...`}
                  </Link>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${statusTone(item.status)}`}>
                    {statusLabel(item.status)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {new Date(item.scheduled_at ?? item.preferred_date).toLocaleString()} ·{' '}
                  {item.showing_type.replace('_', ' ')}
                </p>
                {item.rescheduled_at && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Originally requested: {new Date(item.preferred_date).toLocaleString()}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      item.id_verification_status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : item.id_verification_status === 'pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    ID{' '}
                    {item.id_verification_status === 'not_requested'
                      ? 'not requested'
                      : item.id_verification_status}
                  </span>
                  {item.feedback_submitted_at && (
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                      Feedback saved
                    </span>
                  )}
                </div>
                {item.message && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.message}</p>
                )}
                {(canUploadShowingIdentity(item) || isShowingIdentityAwaitingReview(item)) && (
                  <ShowingIdentityUploadButton
                    className="mt-3"
                    request={item}
                    onUploaded={() => {
                      setUploadMessage('ID uploaded. Your agent will review it shortly.');
                      void refreshRows();
                    }}
                    onError={(message) => setError(message)}
                  />
                )}
                {canLeaveFeedback(item) && (
                  <button
                    type="button"
                    onClick={() => handleFeedbackClick(item)}
                    className="mt-2 inline-flex h-8 items-center rounded-full bg-primarycolor px-3 text-xs font-semibold text-white transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                  >
                    Leave showing feedback
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      )}

      <ShowingFeedbackDialog
        request={activeFeedbackRequest}
        open={feedbackDialogOpen}
        onClose={() => setFeedbackDialogOpen(false)}
        onSubmitted={handleFeedbackSubmitted}
      />
    </section>
  );
}
