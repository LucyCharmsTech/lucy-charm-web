/**
 * The search's URL contract.
 *
 * Filter state used to live in component state, with only country and city in
 * the URL. Three consequences, all of them bugs: a saved search wrote
 * `propertyType`, `price_min` and `price_max` into a link the page then ignored;
 * a result set could not be shared or bookmarked; and the back button stepped
 * through nothing.
 *
 * Putting the whole state here makes the URL the single source of truth, which
 * is what the saved-search, share and map features all need underneath them.
 */
import type { ListingSearchParams } from '@/types/api';

export type ListingView = 'grid' | 'list' | 'map';

export type ListingFilters = {
  status: string;
  country: string;
  city: string;
  propertyTypes: string[];
  titles: string[];
  beds: string;
  baths: string;
  priceMin: string;
  priceMax: string;
  sqftMin: string;
  sqftMax: string;
  sort: string;
  page: number;
  view: ListingView;
  /** Map viewport, west/south/east/north. Present only in map view. */
  bbox: [number, number, number, number] | null;
};

export const DEFAULT_FILTERS: ListingFilters = {
  status: 'Active',
  country: '',
  city: '',
  propertyTypes: [],
  titles: [],
  beds: '',
  baths: '',
  priceMin: '',
  priceMax: '',
  sqftMin: '',
  sqftMax: '',
  sort: 'Newest',
  page: 1,
  view: 'grid',
  bbox: null,
};

const VIEWS: ListingView[] = ['grid', 'list', 'map'];

function num(value: string | null): string {
  if (!value) return '';
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : '';
}

function parseBbox(value: string | null): ListingFilters['bbox'] {
  if (!value) return null;
  const parts = value.split(',').map((part) => Number.parseFloat(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [west, south, east, north] = parts;
  if (south > north || west > east) return null;
  return [west, south, east, north];
}

/** Read the full filter state out of a URL. Unknown or malformed values fall back. */
export function filtersFromParams(params: URLSearchParams): ListingFilters {
  const view = params.get('view') as ListingView | null;
  return {
    status: params.get('status')?.trim() || DEFAULT_FILTERS.status,
    country: params.get('country')?.trim().toLowerCase() ?? '',
    city: params.get('city')?.trim() ?? '',
    // `propertyType` is what ClientSavedSearchesSection has always written.
    // Reading both means every saved search made before this change works.
    propertyTypes: [
      ...params.getAll('type'),
      ...params.getAll('propertyType'),
    ]
      .map((value) => value.trim())
      .filter(Boolean),
    titles: params.getAll('title').map((value) => value.trim()).filter(Boolean),
    beds: params.get('beds')?.trim() ?? '',
    baths: params.get('baths')?.trim() ?? '',
    priceMin: num(params.get('price_min')),
    priceMax: num(params.get('price_max')),
    sqftMin: num(params.get('sqft_min')),
    sqftMax: num(params.get('sqft_max')),
    sort: params.get('sort')?.trim() || DEFAULT_FILTERS.sort,
    page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
    view: view && VIEWS.includes(view) ? view : 'grid',
    bbox: parseBbox(params.get('bbox')),
  };
}

/**
 * Write the filter state back to a query string, omitting anything at its
 * default so a plain search stays a clean `/listings` URL.
 */
export function paramsFromFilters(filters: ListingFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string, fallback = '') => {
    if (value && value !== fallback) params.set(key, value);
  };

  put('status', filters.status, DEFAULT_FILTERS.status);
  put('country', filters.country);
  put('city', filters.city);
  for (const type of filters.propertyTypes) params.append('type', type);
  for (const title of filters.titles) params.append('title', title);
  put('beds', filters.beds);
  put('baths', filters.baths);
  put('price_min', filters.priceMin);
  put('price_max', filters.priceMax);
  put('sqft_min', filters.sqftMin);
  put('sqft_max', filters.sqftMax);
  put('sort', filters.sort, DEFAULT_FILTERS.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.view !== 'grid') params.set('view', filters.view);
  if (filters.bbox && filters.view === 'map') {
    params.set('bbox', filters.bbox.map((n) => n.toFixed(5)).join(','));
  }
  return params;
}

export function listingsHref(filters: ListingFilters): string {
  const qs = paramsFromFilters(filters).toString();
  return qs ? `/listings?${qs}` : '/listings';
}

/** Maps a sort label from the toolbar to the API's sort_by / sort_order pair. */
function sortToParams(label: string): { sort_by: string; sort_order: string } {
  switch (label) {
    case 'Oldest':
      return { sort_by: 'original_entry_at', sort_order: 'asc' };
    case 'Price ↑':
      return { sort_by: 'price', sort_order: 'asc' };
    case 'Price ↓':
      return { sort_by: 'price', sort_order: 'desc' };
    case 'Beds':
      return { sort_by: 'beds', sort_order: 'desc' };
    default:
      return { sort_by: 'original_entry_at', sort_order: 'desc' };
  }
}

const numeric = (value: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Translate the URL state into the query the listings API expects. */
export function toSearchParams(
  filters: ListingFilters,
  pageSize: number,
): ListingSearchParams {
  const { sort_by, sort_order } = sortToParams(filters.sort);
  const params: ListingSearchParams = {
    status: filters.status.toLowerCase(),
    property_types: filters.propertyTypes.length
      ? filters.propertyTypes.map((type) => type.toLowerCase())
      : undefined,
    titles: filters.titles.length
      ? filters.titles.map((title) => title.trim().toLowerCase())
      : undefined,
    beds_min: numeric(filters.beds),
    baths_min: numeric(filters.baths),
    price_min: numeric(filters.priceMin),
    price_max: numeric(filters.priceMax),
    sqft_min: numeric(filters.sqftMin),
    sqft_max: numeric(filters.sqftMax),
    sort_by,
    sort_order,
    page: filters.page,
    size: pageSize,
  };
  if (filters.country) params.country = filters.country;
  if (filters.city) params.city = filters.city;
  if (filters.bbox && filters.view === 'map') {
    const [west, south, east, north] = filters.bbox;
    params.lng_min = west;
    params.lat_min = south;
    params.lng_max = east;
    params.lat_max = north;
  }
  return params;
}

/**
 * The same search, asking only how many results have no map location.
 *
 * Deliberately drops the viewport: a listing with no coordinates cannot be
 * inside or outside a rectangle, and applying one would answer zero every time.
 * That was the first version of this — the count was derived from the loaded
 * page, so it read zero the moment the user panned and the bbox was applied.
 */
export function toUnmappableCountParams(
  filters: ListingFilters,
): ListingSearchParams {
  const params = toSearchParams({ ...filters, bbox: null }, 1);
  params.has_coordinates = false;
  params.page = 1;
  return params;
}

/**
 * Which filters are actually narrowing the search, most-specific first.
 *
 * Drives the no-results suggestions: the narrowest filter is the one most
 * worth offering to drop.
 */
export function activeNarrowingFilters(
  filters: ListingFilters,
): { key: keyof ListingFilters; label: string; cleared: Partial<ListingFilters> }[] {
  const active: {
    key: keyof ListingFilters;
    label: string;
    cleared: Partial<ListingFilters>;
  }[] = [];

  if (filters.priceMin || filters.priceMax) {
    active.push({ key: 'priceMin', label: 'the price range', cleared: { priceMin: '', priceMax: '' } });
  }
  if (filters.sqftMin || filters.sqftMax) {
    active.push({ key: 'sqftMin', label: 'the floor-area range', cleared: { sqftMin: '', sqftMax: '' } });
  }
  if (filters.titles.length) {
    active.push({ key: 'titles', label: 'the listing-name filter', cleared: { titles: [] } });
  }
  if (filters.propertyTypes.length) {
    active.push({ key: 'propertyTypes', label: 'the property type', cleared: { propertyTypes: [] } });
  }
  if (filters.baths) {
    active.push({ key: 'baths', label: 'the minimum bathrooms', cleared: { baths: '' } });
  }
  if (filters.beds) {
    active.push({ key: 'beds', label: 'the minimum bedrooms', cleared: { beds: '' } });
  }
  if (filters.city) {
    active.push({ key: 'city', label: `the city filter (${filters.city})`, cleared: { city: '' } });
  }
  if (filters.country) {
    active.push({ key: 'country', label: 'the country filter', cleared: { country: '' } });
  }
  return active;
}
