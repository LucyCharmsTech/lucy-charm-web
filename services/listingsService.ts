/**
 * Client-side service for the listings API.
 * Uses the shared Axios instance (with auth interceptors) so that authenticated
 * requests work when a user is logged in.
 */

import api from '@/lib/axios';
import type { ApiListing, ListingSearchParams, PaginatedItems } from '@/types/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps friendly sort labels from the UI to API sort_by / sort_order pairs */
function sortLabelToParams(label: string): {
  sort_by: string;
  sort_order: string;
} {
  switch (label) {
    case 'Price ↑':
      return { sort_by: 'price', sort_order: 'asc' };
    case 'Price ↓':
      return { sort_by: 'price', sort_order: 'desc' };
    case 'Beds':
      return { sort_by: 'beds', sort_order: 'desc' };
    default:
      return { sort_by: 'created_at', sort_order: 'desc' };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetches the first `size` featured (newest active) listings.  Used on the homepage. */
export async function fetchFeaturedListings(
  size = 4,
): Promise<PaginatedItems<ApiListing>> {
  const res = await api.get<PaginatedItems<ApiListing>>(
    '/listings/featured',
    { params: { size } },
  );
  return res.data;
}

/** Searches listings with optional filters.  Used by the /listings page. */
export async function searchListings(
  params: ListingSearchParams = {},
): Promise<PaginatedItems<ApiListing>> {
  const res = await api.get<PaginatedItems<ApiListing>>(
    '/listings/search',
    { params },
  );
  return res.data;
}

/** Fetches a single listing by UUID.  Used by the /listings/[id] page. */
export async function fetchListingById(id: string): Promise<ApiListing> {
  const res = await api.get<ApiListing>(`/listings/${id}`);
  return res.data;
}

export type ListingFacetOptions = {
  cities: string[];
  propertyTypes: string[];
};

/**
 * Fetches distinct city and property-type options from live listings.
 * Used by client-portal saved-search dropdown filters.
 */
export async function fetchListingFacetOptions(): Promise<ListingFacetOptions> {
  const citySet = new Set<string>();
  const typeSet = new Set<string>();

  const firstPage = await searchListings({ page: 1, size: 100 });
  for (const item of firstPage.items) {
    if (item.city?.trim()) citySet.add(item.city.trim());
    if (item.property_type?.trim()) typeSet.add(item.property_type.trim().toLowerCase());
  }

  const totalPages = Math.max(1, firstPage.pages);
  if (totalPages > 1) {
    const pageRequests: Promise<PaginatedItems<ApiListing>>[] = [];
    for (let page = 2; page <= totalPages; page += 1) {
      pageRequests.push(searchListings({ page, size: 100 }));
    }
    const remaining = await Promise.all(pageRequests);
    for (const page of remaining) {
      for (const item of page.items) {
        if (item.city?.trim()) citySet.add(item.city.trim());
        if (item.property_type?.trim()) typeSet.add(item.property_type.trim().toLowerCase());
      }
    }
  }

  return {
    cities: Array.from(citySet).sort((a, b) => a.localeCompare(b)),
    propertyTypes: Array.from(typeSet).sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Convenience function that maps the filter-panel state to the API search
 * params expected by `searchListings`.
 *
 * @param status - e.g. 'Active', 'Pending'
 * @param propertyTypes - e.g. ['Detached', 'Condo']
 * @param beds  - e.g. '2+', '3+'
 * @param baths - e.g. '1.5+'
 * @param sortBy - UI sort label e.g. 'Newest', 'Price ↑'
 */
export function buildSearchParams(
  status: string,
  propertyTypes: string[],
  beds: string,
  baths: string,
  sortBy: string,
  country = '',
  city = '',
): ListingSearchParams {
  const { sort_by, sort_order } = sortLabelToParams(sortBy);

  // Parse "2+" → 2.  API accepts a single property_type; when multiple are
  // selected we omit the filter and handle client-side filtering instead.
  const bedsMin = beds ? parseFloat(beds) || undefined : undefined;
  const bathsMin = baths ? parseFloat(baths) || undefined : undefined;
  const propertyType =
    propertyTypes.length === 1
      ? propertyTypes[0].toLowerCase()
      : undefined;
  const countryCode = country.trim().toLowerCase() || undefined;
  const cityQuery = city.trim() || undefined;

  const params: ListingSearchParams = {
    status: status.toLowerCase(),
    property_type: propertyType,
    beds_min: bedsMin,
    baths_min: bathsMin,
    sort_by,
    sort_order,
    size: 50, // fetch enough to cover multi-type client filtering
  };

  if (countryCode) params.country = countryCode;
  if (cityQuery) params.city = cityQuery;

  return params;
}
