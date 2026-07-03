export const STATUSES = ['Active', 'Pending', 'Sold', 'Expired'] as const;
export const COUNTRY_OPTIONS = [
  { label: 'All countries', value: '' },
  { label: 'Canada', value: 'ca' },
  { label: 'United States', value: 'us' },
] as const;
export const PROPERTY_TYPES = [
  'Detached',
  'Condo',
  'Townhouse',
  'Other',
] as const;
export const BEDROOMS = ['1+', '2+', '3+', '4+', '5+'] as const;
export const BATHROOMS = ['1+', '1.5+', '2+', '3+', '4+'] as const;
export const SORT_OPTIONS = ['Newest', 'Price ↑', 'Price ↓', 'Beds'] as const;
