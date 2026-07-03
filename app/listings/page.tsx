'use client';

import { useCallback, useEffect, useState } from 'react';

import ListingCard from '@/components/ListingCard';
import { MOCK_LISTINGS, type ListingItem } from '@/components/listings/data';
import FilterPanel from '@/components/listings/FilterPanel';
import ListingsToolbar from '@/components/listings/ListingsToolbar';
import { apiListingToItem } from '@/lib/listingAdapter';
import {
  buildSearchParams,
  searchListings,
} from '@/services/listingsService';
import type { ApiListing } from '@/types/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns MOCK_LISTINGS converted to the same ListingItem shape so the
 *  card grid works identically whether data comes from the API or mock. */
function getMockItems(): ListingItem[] {
  return MOCK_LISTINGS;
}

/** Applies multi-type client-side filtering when more than one property type
 *  is selected (the API only accepts a single property_type at a time). */
function applyClientFilters(
  items: ListingItem[],
  propertyTypes: string[],
): ListingItem[] {
  if (propertyTypes.length <= 1) return items;
  const lower = propertyTypes.map((t) => t.toLowerCase());
  return items.filter((item) =>
    lower.includes((item.typeLabel ?? '').toLowerCase()),
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ListingsPage() {
  // Filter state
  const [status, setStatus] = useState<string>('Active');
  const [country, setCountry] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sortBy, setSortBy] = useState<string>('Newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Data state
  const [listings, setListings] = useState<ListingItem[]>(getMockItems());
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  // Initialise country from ?country=ca|us in the URL (e.g. deep links).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCountry = params.get('country')?.trim().toLowerCase();
    if (urlCountry) setCountry(urlCountry);
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch from API whenever filters change
  // ---------------------------------------------------------------------------
  const fetchListings = useCallback(async () => {
    setLoading(true);
    setApiError(false);

    try {
      const params = buildSearchParams(
        status,
        propertyTypes,
        beds,
        baths,
        sortBy,
        country,
      );
      const data = await searchListings(params);

      if (data.items.length === 0) {
        // API returned no results — keep current list, show empty state below
        setListings([]);
      } else {
        const items: ListingItem[] = data.items.map((l: ApiListing) =>
          apiListingToItem(l),
        );
        // Client-side multi-type filter (API only supports one type at a time)
        setListings(applyClientFilters(items, propertyTypes));
      }
    } catch {
      // Network or API error — fall back to mock data so the page never breaks
      setApiError(true);
      setListings(applyClientFilters(getMockItems(), propertyTypes));
    } finally {
      setLoading(false);
    }
  }, [status, country, propertyTypes, beds, baths, sortBy]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-screen bg-background m-auto pmd:px-[100px]">
      {/* Sidebar — filter panel */}
      <aside className="w-full md:w-72 shrink-0 border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-950/30 md:sticky md:top-6 self-start">
        <FilterPanel
          status={status}
          setStatus={setStatus}
          country={country}
          setCountry={setCountry}
          propertyTypes={propertyTypes}
          setPropertyTypes={setPropertyTypes}
          beds={beds}
          setBeds={setBeds}
          baths={baths}
          setBaths={setBaths}
        />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col px-6 py-6 sm:px-8">
        <ListingsToolbar
          count={listings.length}
          sortBy={sortBy}
          setSortBy={setSortBy}
          view={view}
          setView={setView}
        />

        {/* API error banner */}
        {apiError && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400">
            Could not reach the listings API — showing cached data.
          </p>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3 max-w-6xl">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && listings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-500 dark:text-zinc-400">
            <p className="text-lg font-semibold">No listings found</p>
            <p className="mt-1 text-sm">
              Try adjusting your filters or check back later.
            </p>
          </div>
        )}

        {/* Cards — grid view */}
        {!loading && listings.length > 0 && view === 'grid' && (
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3 max-w-6xl">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                {...listing}
                detailsHref={listing.detailsHref}
                view="grid"
                saveListingId={listing.id}
              />
            ))}
          </div>
        )}

        {/* Cards — list view */}
        {!loading && listings.length > 0 && view === 'list' && (
          <div className="flex flex-col gap-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                {...listing}
                detailsHref={listing.detailsHref}
                view="list"
                saveListingId={listing.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
