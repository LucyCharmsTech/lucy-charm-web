/**
 * Feed data the API had been returning and the web layer dropped on the floor.
 *
 * Eight fields were absent from the ApiListing type altogether and so were
 * unreachable; several more were typed but read by nothing. The values used
 * here are taken from the real payloads in
 * lucy-charm-api/tests/fixtures/idx/payloads.
 */
import type { ApiListing } from '@/types/api';

import { apiListingToDetail, apiListingToItem } from '@/lib/listingAdapter';

function listing(overrides: Partial<ApiListing> = {}): ApiListing {
  return {
    id: 'a1',
    title: 'Sunlit semi',
    status: 'active',
    property_type: 'Residential Freehold',
    property_subtype: 'Detached',
    transaction_type: 'For Sale',
    price_unit: null,
    mls_status: 'New',
    price: 899000,
    city: 'Toronto',
    state: 'ON',
    ...overrides,
  } as unknown as ApiListing;
}

describe('price unit', () => {
  it('states the rate a commercial lease is quoted per', () => {
    // This is the whole reason the field matters: ListPrice 18.0 rendered as a
    // bare "$18" beside sale prices in the millions.
    const item = apiListingToItem(
      listing({ price: 18, price_unit: 'Sq Ft Net', transaction_type: 'For Lease' }),
    );

    expect(item.priceText).toBe('$18/sq ft net');
  });

  it('carries a monthly rent as monthly', () => {
    expect(
      apiListingToItem(listing({ price: 3500, price_unit: 'Month' })).priceText,
    ).toBe('$3,500/month');
  });

  it('handles the per-acre and per-sq-ft rates the feed also sends', () => {
    expect(apiListingToItem(listing({ price: 42, price_unit: 'Per Acre' })).priceText).toBe(
      '$42/acre',
    );
    expect(apiListingToItem(listing({ price: 30, price_unit: 'Per Sq Ft' })).priceText).toBe(
      '$30/sq ft',
    );
  });

  it('never suffixes a value that is not a rate', () => {
    // ListPriceUnit is "For Sale" on 8 of 41 fixtures and "Net Lease" on 2 --
    // both describe the deal, not the denominator. "$899,000 /For Sale" would
    // be worse than saying nothing.
    expect(apiListingToItem(listing({ price_unit: 'For Sale' })).priceText).toBe('$899,000');
    expect(apiListingToItem(listing({ price_unit: 'Net Lease' })).priceText).toBe('$899,000');
    expect(apiListingToItem(listing({ price_unit: 'Furlongs' })).priceText).toBe('$899,000');
  });

  it('formats a plain sale price exactly as it did before', () => {
    expect(apiListingToItem(listing({ price_unit: null })).priceText).toBe('$899,000');
  });
});

describe('transaction type', () => {
  it('reaches the card, which is where sale and lease sit side by side', () => {
    expect(apiListingToItem(listing({ transaction_type: 'For Lease' })).transactionLabel).toBe(
      'For Lease',
    );
  });

  it('reports nothing rather than assuming a sale', () => {
    // Two fixtures carry no TransactionType at all. Defaulting to "For Sale"
    // would label a lease as a purchase.
    expect(apiListingToItem(listing({ transaction_type: null })).transactionLabel).toBeNull();
  });
});

describe('property subtype', () => {
  it('labels the listing with the specific type, not the board bucket', () => {
    // "Residential Condo & Other" is what a locker and a two-bedroom condo
    // apartment have in common, which makes it useless as a chip.
    const item = apiListingToItem(
      listing({ property_type: 'Residential Condo & Other', property_subtype: 'Locker' }),
    );

    expect(item.typeLabel).toBe('Locker');
  });

  it('opens up the camel-cased values the feed sends', () => {
    expect(apiListingToItem(listing({ property_subtype: 'MobileTrailer' })).typeLabel).toBe(
      'Mobile Trailer',
    );
  });

  it('falls back to the broad type when no subtype was sent', () => {
    expect(
      apiListingToItem(listing({ property_subtype: null, property_type: 'Commercial' }))
        .typeLabel,
    ).toBe('Commercial');
  });

  it('keeps both levels on the detail page', () => {
    const detail = apiListingToDetail(
      listing({ property_type: 'Commercial', property_subtype: 'Office' }),
    );

    expect(detail.propertyTypeLabel).toBe('Commercial');
    expect(detail.propertySubtypeLabel).toBe('Office');
  });
});

describe('detail fields that were fetched and discarded', () => {
  it('surfaces the MLS number shoppers arrive quoting', () => {
    expect(apiListingToDetail(listing({ mls_number: 'C12070241' })).mlsNumber).toBe(
      'C12070241',
    );
  });

  it('surfaces a virtual tour when the feed carries one', () => {
    expect(
      apiListingToDetail(
        listing({ virtual_tour_url: 'https://player.vimeo.com/video/1111090999' }),
      ).virtualTourUrl,
    ).toBe('https://player.vimeo.com/video/1111090999');
  });

  it('carries the board status wording, which the internal status collapses', () => {
    const detail = apiListingToDetail(listing({ status: 'active', mls_status: 'Price Change' }));

    expect(detail.statusLabel).toBe('Active');
    expect(detail.mlsStatus).toBe('Price Change');
  });

  it('carries the entry timestamp raw, for the page to format', () => {
    expect(
      apiListingToDetail(listing({ original_entry_at: '2025-04-08T20:16:22Z' })).listedAt,
    ).toBe('2025-04-08T20:16:22Z');
  });

  it('reports absent extras as null rather than as text', () => {
    const detail = apiListingToDetail(
      listing({ mls_number: null, virtual_tour_url: null, original_entry_at: null }),
    );

    expect(detail.mlsNumber).toBeNull();
    expect(detail.virtualTourUrl).toBeNull();
    expect(detail.listedAt).toBeNull();
  });
});
