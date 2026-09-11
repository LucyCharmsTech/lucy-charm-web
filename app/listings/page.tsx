'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import ListingCard from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import { MOCK_LISTINGS, type ListingItem } from '@/components/listings/data';
import FilterPanel from '@/components/listings/FilterPanel';
import ListingsToolbar from '@/components/listings/ListingsToolbar';
import NoResultsAssistance from '@/components/listings/NoResultsAssistance';
import { ListingDisclaimer } from '@/components/listings/ListingDisclaimer';
import { COUNTRY_OPTIONS } from '@/components/listings/constants';
import { matchListingsToPreferences } from '@/lib/listingMatching';
import { apiListingToItem } from '@/lib/listingAdapter';
import { isProptxLive } from '@/lib/proptxMode';
import { track } from '@/lib/analytics';
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  paramsFromFilters,
  toSearchParams,
  toUnmappableCountParams,
  type ListingFilters,
} from '@/lib/listingFilters';
import { realtimeChannel } from '@/lib/realtime/channels';
import { useChannels, useRealtimeEvent, useRefetchOnReconnect } from '@/lib/realtime/hooks';
import { fetchStoredUserPreferences } from '@/services/userPreferencesService';
import {
  fetchListingPropertyTypes,
  fetchListingTitles,
  searchListings,
} from '@/services/listingsService';
import type { ApiListing, ListingDeletedPayload, ListingUpdatedPayload } from '@/types/api';
import type { MappableListing } from '@/components/listings/ListingsMap';

// Leaflet touches `window` at import time, so it can only load in the browser.
const ListingsMap = dynamic(() => import('@/components/listings/ListingsMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] min-h-[420px] w-full animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
  ),
});

// ---------------------------------------------------------------------------
// PROPTX preview helpers — mock data only, never a fallback for a failed fetch
// ---------------------------------------------------------------------------

function applyClientFilters(items: ListingItem[], propertyTypes: string[]): ListingItem[] {
  if (propertyTypes.length <= 1) return items;
  const lower = propertyTypes.map((t) => t.toLowerCase());
  return items.filter((item) => lower.includes((item.typeLabel ?? '').toLowerCase()));
}

function applyTitleFilters(items: ListingItem[], titles: string[]): ListingItem[] {
  if (titles.length === 0) return items;
  const lower = titles.map((title) => title.trim().toLowerCase());
  return items.filter((item) => lower.includes(item.title.trim().toLowerCase()));
}

function applyMockLocationFilters(
  items: ListingItem[],
  country: string,
  city: string,
): ListingItem[] {
  let filtered = items;
  if (country === 'us') filtered = [];

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
  return COUNTRY_OPTIONS.find((option) => option.value === code)?.label ?? code.toUpperCase();
}

const PAGE_SIZE = 12;
// The map wants everything in view at once; paging pins would be nonsense.
const MAP_PAGE_SIZE = 100;

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

  // The URL is the single source of truth for the search. Everything below
  // reads from it and writes back to it, which is what makes a result set
  // shareable, bookmarkable and reachable by the back button — and what makes
  // a saved search reproduce the search that was saved.
  const filters = useMemo(
    () => filtersFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<ListingFilters>, options?: { keepPage?: boolean }) => {
      const next: ListingFilters = {
        ...filters,
        ...patch,
        // Any change to what is being searched resets paging: staying on page 4
        // of a different result set shows an arbitrary slice of it.
        page: options?.keepPage ? (patch.page ?? filters.page) : (patch.page ?? 1),
      };
      const qs = paramsFromFilters(next).toString();
      router.replace(qs ? `/listings?${qs}` : '/listings', { scroll: false });
    },
    [filters, router],
  );

  const [listings, setListings] = useState<ListingItem[]>([]);
  const [mapPoints, setMapPoints] = useState<MappableListing[]>([]);
  const [unmappable, setUnmappable] = useState(0);
  const [totalListings, setTotalListings] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [propertyTypeOptions, setPropertyTypeOptions] = useState<string[]>([]);
  const [propertyTypesLoading, setPropertyTypesLoading] = useState(true);
  const [listingTitleOptions, setListingTitleOptions] = useState<string[]>([]);
  const [listingTitlesLoading, setListingTitlesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPropertyTypesLoading(true);
    setListingTitlesLoading(true);

    if (!isProptxLive()) {
      setPropertyTypeOptions(
        Array.from(new Set(MOCK_LISTINGS.map((i) => i.typeLabel).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b),
        ),
      );
      setListingTitleOptions(
        Array.from(new Set(MOCK_LISTINGS.map((i) => i.title.trim()).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b),
        ),
      );
      setPropertyTypesLoading(false);
      setListingTitlesLoading(false);
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      fetchListingPropertyTypes(filters.status),
      fetchListingTitles(filters.status),
    ])
      .then(([typeOptions, titleOptions]) => {
        if (cancelled) return;
        setPropertyTypeOptions(typeOptions);
        setListingTitleOptions(titleOptions);
      })
      .catch(() => {
        if (cancelled) return;
        setPropertyTypeOptions([]);
        setListingTitleOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setPropertyTypesLoading(false);
        setListingTitlesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.status]);

  const fetchListings = useCallback(
    async (options?: { silent?: boolean }) => {
      // Realtime-triggered refreshes are silent — flashing the skeleton over a
      // grid the user is reading would make every background change disruptive.
      if (!options?.silent) setLoading(true);
      setApiError(false);

      try {
        if (!isProptxLive()) {
          const preferences = await fetchStoredUserPreferences().catch(() => null);
          const effectiveCountry =
            filters.country ||
            (preferences?.preferredCountry.toLowerCase() === 'canada' ? 'ca' : '');
          const effectiveCity = filters.city || preferences?.preferredCity || '';

          const mockItems = matchListingsToPreferences(
            applyMockLocationFilters(
              applyTitleFilters(
                applyClientFilters(MOCK_LISTINGS, filters.propertyTypes),
                filters.titles,
              ),
              effectiveCountry,
              effectiveCity,
            ),
            preferences,
          );
          setTotalListings(mockItems.length);
          setTotalPages(Math.max(1, Math.ceil(mockItems.length / PAGE_SIZE)));
          const start = (filters.page - 1) * PAGE_SIZE;
          setListings(mockItems.slice(start, start + PAGE_SIZE));
          setMapPoints([]);
          setUnmappable(0);
          return;
        }

        const isMap = filters.view === 'map';
        const data = await searchListings(
          toSearchParams(filters, isMap ? MAP_PAGE_SIZE : PAGE_SIZE),
        );

        setTotalListings(data.total);
        setTotalPages(Math.max(1, Math.ceil(data.total / (data.page_size || PAGE_SIZE))));
        setListings(data.items.map((l: ApiListing) => apiListingToItem(l)));

        if (isMap) {
          setMapPoints(
            data.items
              .filter((l) => l.latitude != null && l.longitude != null)
              .map((l) => ({
                ...apiListingToItem(l),
                lat: l.latitude,
                lng: l.longitude,
              })),
          );

          // Listings whose address the board suppressed have no coordinates on
          // purpose — a precise pin is the address by another route. They can
          // never appear on the map, so they are counted and reported rather
          // than dropped silently out of the result total. Asked as its own
          // query because the viewport filter excludes them server-side, so
          // counting what came back would always answer zero.
          try {
            const unplaceable = await searchListings(toUnmappableCountParams(filters));
            setUnmappable(unplaceable.total);
          } catch {
            // A count we could not get is not worth failing the map over.
            setUnmappable(0);
          }
        } else {
          setMapPoints([]);
          setUnmappable(0);
        }
      } catch {
        // Never substitute invented inventory for real inventory. Mock listings
        // carry no brokerage and no terms notice, and rendering them in the
        // ordinary grid presents fabricated properties as if the board had sent
        // them. An error the visitor can retry is the only honest answer.
        setApiError(true);
        setListings([]);
        setMapPoints([]);
        setUnmappable(0);
        setTotalListings(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void fetchListings();
  }, [fetchListings]);

  // ---------------------------------------------------------------------------
  // Realtime — keep the grid live while it is on screen
  // ---------------------------------------------------------------------------
  useChannels(isProptxLive() ? [realtimeChannel.listingsFeed] : []);

  useRealtimeEvent<ListingUpdatedPayload>('listing.updated', ({ payload }) => {
    if (!isProptxLive()) return;
    // Replace the row wholesale from the event's full read model. Rows outside
    // the current filters are simply not present — ignoring those misses is
    // correct; never re-run the server's filters client-side.
    setListings((prev) =>
      prev.map((item) =>
        item.id === payload.listing_id ? apiListingToItem(payload.listing) : item,
      ),
    );
  });

  useRealtimeEvent<ListingDeletedPayload>('listing.deleted', ({ payload }) => {
    if (!isProptxLive()) return;
    setListings((prev) => prev.filter((item) => item.id !== payload.listing_id));
    setMapPoints((prev) => prev.filter((item) => item.id !== payload.listing_id));
  });

  useRealtimeEvent('listing.created', () => {
    // A new listing may not match the current filters, and the event cannot
    // know what those are — let the server decide by refetching.
    if (isProptxLive()) void fetchListings({ silent: true });
  });

  useRefetchOnReconnect(() => {
    if (isProptxLive()) void fetchListings({ silent: true });
  });

  const activeCountryLabel = filters.country ? countryLabel(filters.country) : null;
  const hasResults = listings.length > 0;

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-screen bg-background m-auto md:px-[100px]">
      {/*
        The design has no visible page heading — the filter panel and the
        results grid are the whole page. A document still needs one `h1`:
        without it a screen-reader user lands on a page that never says what it
        is, and the results list is the largest public page on the site. It
        matches the route's own metadata title rather than inventing a second
        name for the page.
      */}
      <h1 className="sr-only">Homes for sale</h1>
      <aside className="w-full md:w-72 shrink-0 border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-950/30 md:sticky md:top-6 self-start">
        <FilterPanel
          status={filters.status}
          setStatus={(value) => setFilters({ status: value })}
          country={filters.country}
          setCountry={(value) => {
            if (value.trim()) track('search_performed', { country: value.trim() });
            setFilters({ country: value.trim().toLowerCase() });
          }}
          city={filters.city}
          setCity={(value) => {
            if (value.trim()) track('search_performed', { city: value.trim() });
            setFilters({ city: value.trim() });
          }}
          propertyTypes={filters.propertyTypes}
          propertyTypeOptions={propertyTypeOptions}
          propertyTypesLoading={propertyTypesLoading}
          listingTitles={filters.titles}
          listingTitleOptions={listingTitleOptions}
          listingTitlesLoading={listingTitlesLoading}
          setPropertyTypes={(value) => setFilters({ propertyTypes: value })}
          setListingTitles={(value) => setFilters({ titles: value })}
          beds={filters.beds}
          setBeds={(value) => setFilters({ beds: value })}
          baths={filters.baths}
          setBaths={(value) => setFilters({ baths: value })}
          priceMin={filters.priceMin}
          priceMax={filters.priceMax}
          setPriceRange={(min, max) => setFilters({ priceMin: min, priceMax: max })}
          sqftMin={filters.sqftMin}
          sqftMax={filters.sqftMax}
          setSqftRange={(min, max) => setFilters({ sqftMin: min, sqftMax: max })}
        />
      </aside>

      <div className="flex flex-1 flex-col px-6 py-6 sm:px-8">
        <ListingsToolbar
          count={totalListings}
          sortBy={filters.sort}
          setSortBy={(value) => setFilters({ sort: value })}
          view={filters.view}
          setView={(value) => setFilters({ view: value }, { keepPage: true })}
        />

        {!isProptxLive() && (
          <p className="mb-4 rounded-xl border border-primarycolor/20 bg-primarycolor/10 px-4 py-2 text-xs text-primarycolor-text dark:border-primarycolor/30 dark:bg-primarycolor/15">
            PROPTX preview mode is enabled. Listing cards and matching currently use mock data.
          </p>
        )}

        {(activeCountryLabel || filters.city) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Location
            </span>
            {activeCountryLabel && (
              <button
                type="button"
                onClick={() => setFilters({ country: '' })}
                className="inline-flex items-center rounded-full border border-primarycolor/30 bg-primarycolor/10 px-3 py-1 text-xs font-semibold text-primarycolor-text transition hover:bg-primarycolor/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                {activeCountryLabel} ×
              </button>
            )}
            {filters.city && (
              <button
                type="button"
                onClick={() => setFilters({ city: '' })}
                className="inline-flex items-center rounded-full border border-primarycolor/30 bg-primarycolor/10 px-3 py-1 text-xs font-semibold text-primarycolor-text transition hover:bg-primarycolor/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                {filters.city} ×
              </button>
            )}
          </div>
        )}

        {apiError && (
          <div
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300"
            role="alert"
          >
            <p className="m-0">
              We could not reach the property service. No listings are shown rather than
              stale or sample ones — please try again.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void fetchListings()}
            >
              Try again
            </Button>
          </div>
        )}

        {loading && (
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3 max-w-6xl">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        )}

        {!loading && !apiError && !hasResults && filters.view !== 'map' && (
          <NoResultsAssistance filters={filters} />
        )}

        {!loading && filters.view === 'map' && (
          <div className="space-y-3">
            <ListingsMap
              listings={mapPoints}
              initialBbox={filters.bbox}
              onBoundsChange={(bbox) => setFilters({ bbox }, { keepPage: true })}
            />
            {unmappable > 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {unmappable} matching {unmappable === 1 ? 'listing has' : 'listings have'} no
                map location, because the brokerage has asked that the address not be
                published.{' '}
                <button
                  type="button"
                  className="font-semibold text-primarycolor-text underline"
                  onClick={() => setFilters({ view: 'list' }, { keepPage: true })}
                >
                  See them in the list
                </button>
                .
              </p>
            )}
            {mapPoints.length === 0 && !apiError && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No listings with a map location in this area. Try zooming out.
              </p>
            )}
          </div>
        )}

        {!loading && hasResults && filters.view === 'grid' && (
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

        {!loading && hasResults && filters.view === 'list' && (
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

        {!loading && totalPages > 1 && filters.view !== 'map' && (
          <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Listings pagination">
            <button
              type="button"
              onClick={() => setFilters({ page: Math.max(1, filters.page - 1) }, { keepPage: true })}
              disabled={filters.page === 1}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Page {filters.page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setFilters({ page: Math.min(totalPages, filters.page + 1) }, { keepPage: true })
              }
              disabled={filters.page === totalPages}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </nav>
        )}

        {/*
          The terms notice has to travel with the data wherever it is shown, and
          a results grid is a display of feed data as much as a detail page is.
          Rendered once for the page rather than once per card.
        */}
        {!loading && hasResults && isProptxLive() && (
          <ListingDisclaimer disclaimer={null} variant="results" />
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

// Referenced so the default filter shape stays in one place even if the page
// stops using every field directly.
void DEFAULT_FILTERS;
