'use client';

/**
 * Buyer-facing status view for "Request a Deeper Property Review" (spec C4 /
 * D2). Read-only: the buyer submits from the Property Checkup panel and is
 * notified on status changes (Clarifications Part 1 §5); this section is
 * just where they can check back.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchListingById } from '@/services/listingsService';
import { fetchMyReviewRequests } from '@/services/propertyCheckupService';
import type { PropertyReviewRequest, PropertyReviewRequestStatus } from '@/types/api';

const STATUS_LABEL: Record<PropertyReviewRequestStatus, string> = {
  requested: 'Requested',
  under_review: 'Under review',
  response_ready: 'Response ready',
};

const STATUS_TONE: Record<PropertyReviewRequestStatus, string> = {
  requested: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  response_ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export default function ClientPropertyReviewsSection() {
  const [items, setItems] = useState<PropertyReviewRequest[]>([]);
  const [listingTitlesById, setListingTitlesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchMyReviewRequests();
        if (!active) return;
        setItems(rows);

        const uniqueListingIds = Array.from(new Set(rows.map((row) => row.listing_id)));
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
        setError('Could not load your Property Review requests.');
      } finally {
        if (!active) return;
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!loading && !error && items.length === 0) return null;

  return (
    <section
      id="property-reviews"
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
    >
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Deeper Property Reviews</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Requests you&apos;ve sent from a listing&apos;s Property Checkup.
      </p>

      {loading && <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}
      {error && !loading && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="mt-4 grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/listings/${item.listing_id}`}
                  className="text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-100"
                >
                  {listingTitlesById[item.listing_id] ?? `Listing ${item.listing_id.slice(0, 8)}...`}
                </Link>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Requested {new Date(item.created_at).toLocaleDateString()}
              </p>
              {item.status === 'response_ready' && item.response_summary && (
                <p className="mt-2 rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {item.response_summary}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
