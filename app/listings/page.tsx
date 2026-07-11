'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import ListingCard from '@/components/ListingCard';
import { MOCK_LISTINGS, type ListingItem } from '@/components/listings/data';
import FilterPanel from '@/components/listings/FilterPanel';
import ListingsToolbar from '@/components/listings/ListingsToolbar';
import { COUNTRY_OPTIONS } from '@/components/listings/constants';
import { matchListingsToPreferences } from '@/lib/listingMatching';
import { apiListingToItem } from '@/lib/listingAdapter';
import { isProptxLive } from '@/lib/proptxMode';
import { fetchStoredUserPreferences } from '@/services/userPreferencesService';
import {
  buildSearchParams,
  searchListings,
} from '@/services/listingsService';
import type { ApiListing } from '@/types/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Offline mock fallback — static cards are all Canadian (Ottawa, ON). */
function applyMockLocationFilters(
  items: ListingItem[],
  country: string,
  city: string,
): ListingItem[] {
  let filtered = items;

  if (country === 'us') {
    filtered = [];
  }

  const cityQuery = city.trim().toLowerCase();
  if (cityQuery) {
    filtered = filtered.filter(
      (item) =>
        item.locationText.toLowerCase().includes(cityQuery) ||
        item.address.toLowerCase().includes(cityQuery) ||
        item.title.toLowerCase().includes(cityQuery),
    );
  }

  return filtered;
}

function countryLabel(code: string): string {
  return (
    COUNTRY_OPTIONS.find((option) => option.value === code)?.label ?? code.toUpperCase()
  );
}

function ListingsPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading listings…</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ListingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const country = searchParams.get('country')?.trim().toLowerCase() ?? '';
  const city = searchParams.get('city')?.trim() ?? '';

  const updateSearchParam = useCallback(
    (key: 'country' | 'city', value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const cleaned = value.trim();
      if (key === 'country') {
        const normalised = cleaned.toLowerCase();
        if (normalised) params.set('country', normalised);
        else params.delete('country');
      } else if (cleaned) {
        params.set('city', cleaned);
      } else {
        params.delete('city');
      }

      const qs = params.toString();
      router.replace(qs ? `/listings?${qs}` : '/listings', { scroll: false });
    },
    [router, searchParams],
  );

  // Filter state (local UI — country/city live in the URL)
  const [status, setStatus] = useState<string>('Active');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sortBy, setSortBy] = useState<string>('Newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Data state — start empty; never show stale mock data while filters apply
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch from API whenever filters change
  // ---------------------------------------------------------------------------
  const fetchListings = useCallback(async () => {
    setLoading(true);
    setApiError(false);

    try {
      if (!isProptxLive()) {
        const preferences = await fetchStoredUserPreferences().catch(() => null);
        const effectiveCountry =
          country || (preferences?.preferredCountry.toLowerCase() === 'canada' ? 'ca' : '');
        const effectiveCity = city || preferences?.preferredCity || '';

        const mockItems = applyMockLocationFilters(
          applyClientFilters(MOCK_LISTINGS, propertyTypes),
          effectiveCountry,
          effectiveCity,
        );
        setListings(matchListingsToPreferences(mockItems, preferences));
        return;
      }

      const params = buildSearchParams(
        status,
        propertyTypes,
        beds,
        baths,
        sortBy,
        country,
        city,
      );
      const data = await searchListings(params);

      const items: ListingItem[] = data.items.map((l: ApiListing) =>
        apiListingToItem(l),
      );
      setListings(applyClientFilters(items, propertyTypes));
    } catch {
      setApiError(true);
      setListings(
        applyMockLocationFilters(
          applyClientFilters(MOCK_LISTINGS, propertyTypes),
          country,
          city,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [status, country, city, propertyTypes, beds, baths, sortBy]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const activeCountryLabel = country ? countryLabel(country) : null;

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
          setCountry={(value) => updateSearchParam('country', value)}
          city={city}
          setCity={(value) => updateSearchParam('city', value)}
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

        {!isProptxLive() && (
          <p className="mb-4 rounded-xl border border-primarycolor/20 bg-primarycolor/10 px-4 py-2 text-xs text-primarycolor dark:border-primarycolor/30 dark:bg-primarycolor/15">
            PROPTX preview mode is enabled. Listing cards and matching currently use mock data.
          </p>
        )}

        {/* Active location filters */}
        {(activeCountryLabel || city) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Location
            </span>
            {activeCountryLabel && (
              <button
                type="button"
                onClick={() => updateSearchParam('country', '')}
                className="inline-flex items-center rounded-full border border-primarycolor/30 bg-primarycolor/10 px-3 py-1 text-xs font-semibold text-primarycolor transition hover:bg-primarycolor/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                {activeCountryLabel} ×
              </button>
            )}
            {city && (
              <button
                type="button"
                onClick={() => updateSearchParam('city', '')}
                className="inline-flex items-center rounded-full border border-primarycolor/30 bg-primarycolor/10 px-3 py-1 text-xs font-semibold text-primarycolor transition hover:bg-primarycolor/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                {city} ×
              </button>
            )}
          </div>
        )}

        {/* API error banner */}
        {apiError && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400">
            Could not reach the listings API — showing offline sample data with your
            location filters applied.
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
              {country === 'us'
                ? 'There are no US listings yet. Try Canada or clear the country filter.'
                : 'Try adjusting your filters or check back later.'}
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

export default function ListingsPage() {
  return (
    <Suspense fallback={<ListingsPageFallback />}>
      <ListingsPageContent />
    </Suspense>
  );
}
