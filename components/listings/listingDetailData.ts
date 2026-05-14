import { MOCK_LISTINGS, type ListingItem } from '@/components/listings/data';

/** Mirrors ApiListingAgentSummary — assigned agent on a listing detail view. */
export type ListingAgentSummary = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type ListingDetail = ListingItem & {
  postalCode: string;
  province: string;
  country: string;
  currency: string;
  taxesYearly: string;
  hoaMonthly: string;
  lotSize: string;
  yearBuilt: string;
  parking: string;
  market: string;
  about: string;
  aiSummary: string;
  lat: number;
  lng: number;
  agent: ListingAgentSummary | null;
};

const DEFAULT_DETAIL_FIELDS: Omit<ListingDetail, keyof ListingItem> = {
  postalCode: '—',
  province: 'ON',
  country: 'Canada',
  currency: 'CAD',
  taxesYearly: '$3,700',
  hoaMonthly: '$520',
  lotSize: '— Lot Size',
  yearBuilt: '1928',
  parking: '1',
  market: 'CA',
  about:
    'Stylish urban home with character. Bright living spaces, updated finishes, and a walkable neighbourhood close to shops, transit, and parks. Schedule a tour to see it in person.',
  aiSummary:
    'Compact loft-style condo with strong walkability in the ByWard Market. Best for buyers who want low maintenance and proximity to downtown amenities.',
  lat: 45.42111,
  lng: -75.6903,
  agent: null,
};

/** Richer mock copy for listing `1` to match marketing screenshots */
const OVERRIDES: Partial<Record<string, Partial<ListingDetail>>> = {
  '1': {
    agent: {
      id: 'aaaaaaaa-bbbb-bbbb-bbbb-cccccccccccc',
      name: 'Alex Mercer',
      phone: '+1 613-555-0100',
      email: 'alex.mercer@example.com', 
    },
    postalCode: 'K1N 5P5',
    province: 'ON',
    country: 'Canada',
    currency: 'CAD',
    taxesYearly: '$3,780',
    hoaMonthly: '$120',
    lotSize: '— Lot Size',
    yearBuilt: '1928',
    parking: '1',
    market: 'CA',
    about:
      'Stylish 2-bedroom, 1-bathroom loft conversion in the heart of the ByWard Market. Soaring ceilings, oversized windows, and an open kitchen with quartz counters make this home ideal for urban professionals. Steps to cafés, the Rideau Centre, and the Ottawa River pathways.',
    aiSummary:
      'Walkable downtown loft with authentic character and strong rental demand. Suited for first-time buyers or investors focused on location over square footage.',
  },
};

export function getListingDetail(id: string): ListingDetail | null {
  const base = MOCK_LISTINGS.find((l) => l.id === id);
  if (!base) return null;
  return {
    ...base,
    ...DEFAULT_DETAIL_FIELDS,
    ...(OVERRIDES[id] ?? {}),
  };
}

export function formatTypeLabel(typeLabel: string): string {
  return typeLabel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
