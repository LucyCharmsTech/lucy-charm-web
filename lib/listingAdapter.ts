/**
 * Adapts the backend ApiListing shape into the frontend ListingItem / ListingDetail
 * shapes expected by UI components.  All transformations live here so that
 * components never need to know about the API schema.
 */

import type { ListingItem } from '@/components/listings/data';
import type { ListingDetail } from '@/components/listings/listingDetailData';
import type { ApiListing } from '@/types/api';

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
 * Formats the lot size. The backend normalises lot_size to acres and leaves it
 * null when the feed's unit could not be resolved, so a number here is always
 * acres. lot_size_range is the board's own acreage band and covers many more
 * listings than the numeric field does.
 */
function formatLotSize(listing: ApiListing): string | null {
  if (listing.lot_size != null && listing.lot_size > 0) {
    return `${listing.lot_size.toLocaleString('en-CA', {
      maximumFractionDigits: 4,
    })} acres`;
  }
  if (listing.lot_size_range) {
    return `${listing.lot_size_range} acres`;
  }
  return null;
}

/**
 * Prefer building area, then fall back to lot size. Both are unit-checked on
 * the backend; anything unresolved arrives as null and shows an em dash rather
 * than a number in the wrong unit.
 */
function formatArea(listing: ApiListing): string {
  if (listing.sqft != null && listing.sqft > 0) {
    return `${listing.sqft.toLocaleString('en-CA')} ft²`;
  }
  return formatLotSize(listing) ?? '—';
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
/**
 * The brokerage to credit the listing to.
 *
 * The directory row is preferred because it is the fuller record, but the name
 * carried on the listing itself stands in when that has not synced. Attribution
 * has to be displayed wherever the listing is, so it must not depend on a
 * second resource having landed.
 */
function brokerageOf(listing: ApiListing): string | null {
  return listing.idx_office?.office_name || listing.idx_office_name || null;
}

/** "22 x 126 ft" when both dimensions are known, one of them when only one is. */
function formatLotDimensions(listing: ApiListing): string | null {
  const unit = listing.lot_size_units?.toLowerCase().startsWith('m') ? 'm' : 'ft';
  const { lot_width: width, lot_depth: depth } = listing;
  if (width && depth) return `${width} \u00d7 ${depth} ${unit}`;
  if (width) return `${width} ${unit} frontage`;
  if (depth) return `${depth} ${unit} depth`;
  return null;
}

export function apiListingToItem(listing: ApiListing): ListingItem {
  const locationText = `${listing.city}, ${listing.state}`;

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
    areaText: formatArea(listing),
    locationText,
    detailsHref: `/listings/${listing.id}`,
    attribution: brokerageOf(listing),
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
    lotSize: `${formatLotSize(listing) ?? '—'} Lot Size`,
    yearBuilt: listing.year_built?.toString() ?? '—',
    parking: listing.parking_spaces?.toString() ?? '—',
    market: listing.market,
    about:
      listing.description ||
      'No description has been provided for this property.',
    aiSummary: listing.ai_summary ?? '',
    lat: listing.latitude,
    lng: listing.longitude,
    agent: listing.agent ?? null,
    idxAgent: listing.idx_agent ?? null,
    idxOffice: listing.idx_office ?? null,
    attribution: brokerageOf(listing),
    sourceDisclaimer: listing.source_disclaimer ?? null,
    neighbourhood: listing.neighbourhood ?? null,
    crossStreet: listing.cross_street ?? null,
    directions: listing.directions ?? null,
    cooling: listing.cooling ?? null,
    heatingType: listing.heating_type ?? null,
    garageType: listing.garage_type ?? null,
    sewer: listing.sewer ?? null,
    basement:
      listing.basement ??
      (listing.has_basement === true ? 'Yes' : listing.has_basement === false ? 'No' : null),
    propertyFeatures: listing.property_features ?? null,
    lotDimensions: formatLotDimensions(listing),
    taxYear: listing.tax_year ? String(listing.tax_year) : null,
    kitchens: listing.kitchens != null ? String(listing.kitchens) : null,
    approximateAge: listing.approximate_age ?? null,
  };
}
