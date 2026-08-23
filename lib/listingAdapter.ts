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
    // The subtype vocabulary is partly camel-cased ("MobileTrailer"), which
    // renders as one word unless the boundary is opened up.
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Lease rates the feed quotes a price *per*, lower-cased for lookup.
 *
 * Deliberately a whitelist. ListPriceUnit also carries values that describe the
 * deal rather than the denominator -- "For Sale", "Net Lease" -- and suffixing
 * those produces "$899,000 /For Sale". Anything unrecognised gets no suffix,
 * which is the pre-existing behaviour and never states a unit that is wrong.
 */
const PRICE_RATE_SUFFIX: Record<string, string> = {
  month: '/month',
  'per sq ft': '/sq ft',
  // A net rate has the extras billed on top, so the word carries real money.
  // Dropping it quotes a gross rent the tenant will not actually pay.
  'sq ft net': '/sq ft net',
  'per acre': '/acre',
};

/**
 * Format a price into "$1,234,000", carrying the feed's rate unit when it
 * quotes one.
 *
 * Commercial leases arrive priced per square foot -- ListPrice 18.0 with
 * ListPriceUnit "Sq Ft Net" -- and rendering that bare showed "$18" beside
 * sale prices in the millions.
 */
function formatPrice(listing: ApiListing): string {
  const base = `$${listing.price.toLocaleString('en-CA')}`;
  const suffix = PRICE_RATE_SUFFIX[listing.price_unit?.trim().toLowerCase() ?? ''];
  return suffix ? `${base}${suffix}` : base;
}

/**
 * "For Sale" / "For Lease", as the feed states it.
 *
 * Nothing else on a card separates a lease rate from a purchase price, and the
 * two sit in the same grid.
 */
function transactionLabelOf(listing: ApiListing): string | null {
  const raw = listing.transaction_type?.trim();
  if (!raw) return null;
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
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
    // The subtype is the specific one ("Detached", "Condo Apartment",
    // "Locker") and the feed populates it on every record; property_type is the
    // board's top-level bucket, which labels a locker and a two-bedroom condo
    // alike as "Residential Condo & Other".
    typeLabel: humaniseType(listing.property_subtype || listing.property_type),
    // Empty rather than a stand-in: the card renders a panel that says so.
    imageSrc: listing.primary_image_url || '',
    imageAlt: listing.title,
    priceText: formatPrice(listing),
    transactionLabel: transactionLabelOf(listing),
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
    // When the listing data itself last changed. Falls back to the feed's own
    // modification stamp for rows written before last_updated_at was populated.
    updatedAt: listing.last_updated_at ?? listing.source_modified_at ?? null,
    // The board's own listing number. Shoppers arrive quoting it and it was
    // fetched on every request without ever being rendered.
    mlsNumber: listing.mls_number ?? null,
    // Only ever an unbranded-then-branded tour URL from the mapper.
    virtualTourUrl: listing.virtual_tour_url ?? null,
    // The broad bucket, kept alongside the subtype now shown on the chip.
    propertyTypeLabel: listing.property_type ? humaniseType(listing.property_type) : null,
    propertySubtypeLabel: listing.property_subtype
      ? humaniseType(listing.property_subtype)
      : null,
    // "New", "Price Change", "Extension" -- the movement a shopper cares about,
    // which the internal status collapses away to plain "active".
    mlsStatus: listing.mls_status ?? null,
    // The feed sends no DaysOnMarket, so this timestamp is the only listing-age
    // signal available. Raw ISO: the page formats it, as with updatedAt.
    listedAt: listing.original_entry_at ?? null,
  };
}
