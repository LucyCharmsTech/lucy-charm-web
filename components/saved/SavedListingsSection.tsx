'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import ListingCard from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import type { ListingItem } from '@/components/listings/data';
import { apiListingToItem } from '@/lib/listingAdapter';
import { fetchListingById } from '@/services/listingsService';
import {
  listMySavedListings,
  unsaveListing,
} from '@/services/savedListingsService';
import type { ApiListing, SavedListingsRead } from '@/types/api';

type LoadedCard = {
  savedRowId: string;
  item: ListingItem;
};

/**
 * Saved homes grid (used on the profile page and anywhere else we need the list).
 */
export default function SavedListingsSection() {
  const [cards, setCards] = useState<LoadedCard[]>([]);
  const [orphanSaves, setOrphanSaves] = useState<SavedListingsRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const saved = await listMySavedListings();
      const results = await Promise.all(
        saved.map(async (row) => {
          try {
            const apiListing: ApiListing = await fetchListingById(row.listing_id);
            return { ok: true as const, row, item: apiListingToItem(apiListing) };
          } catch {
            return { ok: false as const, row };
          }
        }),
      );

      const nextCards: LoadedCard[] = [];
      const nextOrphans: SavedListingsRead[] = [];
      for (const r of results) {
        if (r.ok) {
          nextCards.push({ savedRowId: r.row.id, item: r.item });
        } else {
          nextOrphans.push(r.row);
        }
      }

      setCards(nextCards);
      setOrphanSaves(nextOrphans);
    } catch {
      setError('We could not load your saved homes. Check your connection and try again.');
      setCards([]);
      setOrphanSaves([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFavoriteChange = useCallback((listingId: string, saved: boolean) => {
    if (!saved) {
      setCards((prev) => prev.filter((c) => c.item.id !== listingId));
    }
  }, []);

  const removeOrphan = useCallback(async (savedRowId: string) => {
    setError(null);
    try {
      await unsaveListing(savedRowId);
      setOrphanSaves((prev) => prev.filter((r) => r.id !== savedRowId));
    } catch {
      setError('Could not remove that entry. Please try again.');
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Saved homes</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Listings you have saved. When you are not signed in, they stay on this device until you
          clear site data.
        </p>
      </div>

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && cards.length === 0 && orphanSaves.length === 0 && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white px-6 py-12 text-center shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No saved homes yet</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Browse listings and tap <span className="font-medium text-primarycolor">Save</span> on any
            card.
          </p>
          <Button asChild className="mt-5">
            <Link href="/listings">Browse listings</Link>
          </Button>
        </div>
      )}

      {orphanSaves.length > 0 && (
        <ul className="space-y-3" aria-label="Unavailable saved listings">
          {orphanSaves.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-900/50"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                A saved property is no longer on the market or was removed. You can clear it from
                your list.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void removeOrphan(row.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {!loading && cards.length > 0 && (
        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ item, savedRowId }) => (
            <ListingCard
              key={savedRowId}
              {...item}
              detailsHref={item.detailsHref}
              saveListingId={item.id}
              onSaveChange={(next) => handleFavoriteChange(next.listingId, next.saved)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
