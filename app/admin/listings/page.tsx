'use client';

import { useEffect, useState } from 'react';
import ListingCard from '@/components/ListingCard';
import { apiListingToItem } from '@/lib/listingAdapter';
import { fetchAllListingsAdmin } from '@/services/portalService';
import type { ApiListing, ApiPaginated } from '@/types/api';

export default function AdminListingsPage() {
  const [listings, setListings] = useState<ApiPaginated<ApiListing> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllListingsAdmin(1, 100)
      .then((page) => {
        if (cancelled) return;
        setError(null);
        setListings(page);
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load listings.';
        if (!cancelled) setError(String(msg));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!listings) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading listings…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            All listings
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Full brokerage catalog. Open a listing to see client intents and summaries.
          </p>
        </div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{listings.total} total</p>
      </div>

      {listings.items.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No listings in the catalog.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.items.map((l) => {
            const item = apiListingToItem(l);
            return (
              <ListingCard
                key={l.id}
                {...item}
                insightsHref={`/admin/listings/${l.id}`}
                insightsLabel="Insights and details"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
