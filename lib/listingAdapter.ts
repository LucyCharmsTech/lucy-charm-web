/**
 * Adapts the backend ApiListing shape into the frontend ListingItem / ListingDetail
 * shapes expected by UI components.  All transformations live here so that
 * components never need to know about the API schema.
 */

import type { ListingItem } from '@/components/listings/data';
import type { ListingDetail } from '@/components/listings/listingDetailData';
import type { ApiListing } from '@/types/api';

// Default lat/lng when the listing has no coordinates (Ottawa downtown)
const DEFAULT_LAT = 45.4215;
const DEFAULT_LNG = -75.6919;

/** Capitalise the first letter of each word; normalise underscores to spaces */
function humaniseType(raw: string | null): string {
  if (!raw) return 'Property';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a numeric price into "$1,234,000" */
function formatPrice(price: number): string {
  return `$${price.toLocaleString('en-CA')}`;
}

/**
 * Returns a deterministic placeholder image for listings that have no
 * primary_image_url — uses the UUID as a stable seed so the same listing
 * always shows the same picsum image.
 */
function placeholderImage(id: string): string {
  // Use first 8 chars of UUID as seed (stable, short)
  return `https://picsum.photos/seed/${id.slice(0, 8)}/900/700`;
}

// ---------------------------------------------------------------------------
// Public adapters
// ---------------------------------------------------------------------------

/**
 * Converts an ApiListing into a ListingItem for use on the listing grid / cards.
 */
export function apiListingToItem(listing: ApiListing): ListingItem {
  const locationText = `${listing.city}, ${listing.state}`;
  const sqft = listing.sqft;

  return {
    id: listing.id,
    statusLabel:
      listing.status.charAt(0).toUpperCase() + listing.status.slice(1),
    typeLabel: humaniseType(listing.property_type),
    imageSrc: listing.primary_image_url || placeholderImage(listing.id),
    imageAlt: listing.title,
    priceText: formatPrice(listing.price),
    title: listing.title,
    address: listing.display_address || locationText,
    bedsText: listing.beds != null ? `${listing.beds} bd` : '—',
    bathsText: listing.baths != null ? `${listing.baths} ba` : '—',
    sqftText:
      sqft != null ? `${sqft.toLocaleString('en-CA')} ft²` : '—',
    locationText,
    detailsHref: `/listings/${listing.id}`,
  };
}

/**
 * Converts an ApiListing into a ListingDetail for the detail page.
 * Includes all additional fields (taxes, HOA, coordinates, etc.).
 */
export function apiListingToDetail(listing: ApiListing): ListingDetail {
  const base = apiListingToItem(listing);

  const countryLabel =
    listing.country === 'CA' || listing.country === 'Canada'
      ? 'Canada'
      : listing.country;

  return {
    ...base,
    postalCode: listing.zip || '—',
    province: listing.state,
    country: countryLabel,
    currency: listing.currency,
    taxesYearly:
      listing.taxes != null
        ? `$${listing.taxes.toLocaleString('en-CA')}`
        : '—',
    hoaMonthly:
      listing.hoa_fee != null
        ? `$${listing.hoa_fee.toLocaleString('en-CA')}`
        : '—',
    lotSize:
      listing.lot_size != null
        ? `${listing.lot_size.toLocaleString('en-CA')} Lot Size`
        : '— Lot Size',
    yearBuilt: listing.year_built?.toString() ?? '—',
    parking: listing.parking_spaces?.toString() ?? '—',
    market: listing.market,
    about:
      listing.description ||
      'No description has been provided for this property.',
    aiSummary: listing.ai_summary ?? '',
    lat: listing.latitude ?? DEFAULT_LAT,
    lng: listing.longitude ?? DEFAULT_LNG,
  };
}
