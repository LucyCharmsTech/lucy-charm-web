/**
 * Attribution is a display obligation, not a nice-to-have.
 *
 * The brokerage was previously resolved only through the IDX office directory
 * and rendered only on the detail page, where a missing name became the literal
 * words "IDX office". These pin that the name survives a missing directory row
 * and reaches the listing cards.
 */
import type { ApiListing } from '@/types/api';

import { apiListingToDetail, apiListingToItem } from '@/lib/listingAdapter';

function listing(overrides: Partial<ApiListing> = {}): ApiListing {
  return {
    id: 'a1',
    title: 'Sunlit semi',
    status: 'active',
    property_type: 'residential',
    price: 899000,
    city: 'Toronto',
    state: 'ON',
    beds: 3,
    baths: 2,
    primary_image_url: null,
    display_address: '12 Elm St',
    idx_office: {
      office_key: '522702',
      office_name: 'ROYAL LEPAGE FRANK REAL ESTATE',
    },
    idx_office_name: 'ROYAL LEPAGE FRANK REAL ESTATE',
    source_disclaimer: 'Data is supplied through the AMPRE IDX feed.',
    ...overrides,
  } as unknown as ApiListing;
}

describe('listing attribution', () => {
  it('reaches the card, not just the detail page', () => {
    expect(apiListingToItem(listing()).attribution).toBe(
      'ROYAL LEPAGE FRANK REAL ESTATE',
    );
  });

  it('survives the office directory not having synced', () => {
    const item = apiListingToItem(listing({ idx_office: null }));

    expect(item.attribution).toBe('ROYAL LEPAGE FRANK REAL ESTATE');
  });

  it('prefers the directory row, which is the fuller record', () => {
    const item = apiListingToItem(
      listing({
        idx_office: {
          office_key: '522702',
          office_name: 'DIRECTORY NAME',
        } as ApiListing['idx_office'],
        idx_office_name: 'STALE NAME',
      }),
    );

    expect(item.attribution).toBe('DIRECTORY NAME');
  });

  it('reports nothing rather than inventing a placeholder', () => {
    const item = apiListingToItem(
      listing({ idx_office: null, idx_office_name: null }),
    );

    expect(item.attribution).toBeNull();
  });

  it('carries the feed disclaimer onto the detail page', () => {
    const detail = apiListingToDetail(listing());

    expect(detail.sourceDisclaimer).toBe(
      'Data is supplied through the AMPRE IDX feed.',
    );
    expect(detail.attribution).toBe('ROYAL LEPAGE FRANK REAL ESTATE');
  });
});

describe('detail facts', () => {
  it('formats lot dimensions with the unit the feed reported', () => {
    const detail = apiListingToDetail(
      listing({ lot_width: 22, lot_depth: 126, lot_size_units: 'Feet' } as Partial<ApiListing>),
    );

    expect(detail.lotDimensions).toBe('22 × 126 ft');
  });

  it('reports a single known dimension rather than nothing', () => {
    expect(
      apiListingToDetail(listing({ lot_width: 22, lot_depth: null } as Partial<ApiListing>))
        .lotDimensions,
    ).toBe('22 ft frontage');
  });

  it('reports no lot at all when the feed gave neither', () => {
    expect(
      apiListingToDetail(listing({ lot_width: null, lot_depth: null } as Partial<ApiListing>))
        .lotDimensions,
    ).toBeNull();
  });

  it('falls back to the basement flag when there is no description', () => {
    expect(
      apiListingToDetail(listing({ basement: null, has_basement: true } as Partial<ApiListing>))
        .basement,
    ).toBe('Yes');
    expect(
      apiListingToDetail(listing({ basement: 'Finished', has_basement: true } as Partial<ApiListing>))
        .basement,
    ).toBe('Finished');
  });

  it('carries the banded age, because this feed never sends a year built', () => {
    expect(
      apiListingToDetail(listing({ approximate_age: '6-15' } as Partial<ApiListing>))
        .approximateAge,
    ).toBe('6-15');
  });
});
