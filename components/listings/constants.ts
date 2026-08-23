/**
 * The statuses a shopper may filter by.
 *
 * Sold and Expired used to be offered here and could never return a row: the
 * IDX licence covers property currently being marketed, and the API withholds
 * everything else. Offering a filter that is guaranteed to return nothing is
 * worse than not offering it — it looks like the search is broken.
 */
export const STATUSES = ['Active', 'Pending'] as const;

/**
 * Statuses the API will not serve, kept so an old bookmark or saved search
 * pointing at one can be explained rather than silently returning nothing.
 * Mirrors NEVER_PUBLIC_STATUSES + VOW_ONLY_STATUSES in app/api/idx/compliance.py.
 */
export const GATED_STATUSES = [
  'sold',
  'leased',
  'expired',
  'withdrawn',
  'off_market',
] as const satisfies readonly string[];
export const COUNTRY_OPTIONS = [
  { label: 'All countries', value: '' },
  { label: 'Canada', value: 'ca' },
  { label: 'United States', value: 'us' },
] as const;
export const BEDROOMS = ['1+', '2+', '3+', '4+', '5+'] as const;
export const BATHROOMS = ['1+', '1.5+', '2+', '3+', '4+'] as const;
export const SORT_OPTIONS = ['Newest', 'Oldest', 'Price ↑', 'Price ↓', 'Beds'] as const;
