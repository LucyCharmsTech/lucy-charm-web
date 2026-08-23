import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BathIcon,
  BedDoubleIcon,
  CalendarIcon,
  CarIcon,
  LayoutGridIcon,
  MapPinIcon,
  RulerIcon,
} from 'lucide-react';

import ListingDetailLocationSection from '@/components/listings/detail/ListingDetailLocationSection';
import ListingDetailInteractiveShell from '@/components/listings/detail/ListingDetailInteractiveShell';
import ListingDetailLiveUpdates from '@/components/listings/detail/ListingDetailLiveUpdates';
import ListingDetailSidebar from '@/components/listings/detail/ListingDetailSidebar';
import { ListingDisclaimer } from '@/components/listings/ListingDisclaimer';
import {
  getListingDetailMetrics,
  getListingMapUrls,
} from '@/components/listings/detail/ListingDetailFormat';
import ListingDetailSpecPill from '@/components/listings/detail/ListingDetailSpecPill';
import ListingDetailFactCell from '@/components/listings/detail/ListingDetailFactCell';
import ListingMediaCarousel from '@/components/listings/detail/ListingMediaCarousel';

// Data sources
import { getListingDetail } from '@/components/listings/listingDetailData';
import { apiListingToDetail } from '@/lib/listingAdapter';
import { serverFetchResult, isUuid } from '@/lib/serverFetch';
import ListingUnavailable from '@/components/listings/ListingUnavailable';
import ShareSearchButton from '@/components/listings/ShareSearchButton';
import type { ApiListing, ApiListingMedia } from '@/types/api';
import type { ListingDetail } from '@/components/listings/listingDetailData';

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * What a shared link previews as.
 *
 * The route had no metadata at all, so every listing shared into a message or
 * posted anywhere previewed with the site-wide default — same title, same
 * image, for every property. The brokerage credit goes in the description
 * because attribution obligations do not stop at the page boundary.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return {};

  const result = await serverFetchResult<ApiListing>(`/listings/${id}`, {
    revalidate: 60,
  });
  if (!result.ok) return {};

  const listing = result.data;
  const price = listing.price
    ? `$${listing.price.toLocaleString('en-CA')} ${listing.currency}`
    : null;
  const where = listing.display_address || `${listing.city}, ${listing.state}`;
  const title = [price, where].filter(Boolean).join(' — ') || listing.title;
  const brokerage = listing.idx_office?.office_name || listing.idx_office_name;

  const description = [
    [
      listing.beds != null ? `${listing.beds} bed` : null,
      listing.baths != null ? `${listing.baths} bath` : null,
      listing.property_type,
    ]
      .filter(Boolean)
      .join(' · '),
    brokerage ? `Listed by ${brokerage}.` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return {
    title,
    description: description || undefined,
    openGraph: {
      title,
      description: description || undefined,
      type: 'website',
      images: listing.primary_image_url ? [listing.primary_image_url] : undefined,
    },
    twitter: {
      card: listing.primary_image_url ? 'summary_large_image' : 'summary',
      title,
      description: description || undefined,
    },
  };
}

/**
 * The date the listing was first entered on the board.
 *
 * The feed sends no DaysOnMarket, so this is the only listing-age signal there
 * is. Rendered as a plain date rather than a derived "N days on market": a
 * relist carries a fresh entry timestamp, so the elapsed figure would be
 * confidently wrong on exactly the listings where it matters most.
 *
 * Locale and time zone are pinned because this runs on the server and the
 * result is serialised into the HTML -- an unpinned format would render
 * differently depending on where the server happens to be.
 */
function formatListedOn(iso: string | null): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  let listing: ListingDetail | null = null;
  let listingMedia: ApiListingMedia[] = [];

  if (isUuid(id)) {
    // Fetch listing + media independently so search stays lightweight.
    // Uncached (`revalidate: 0`): ListingDetailLiveUpdates uses router.refresh()
    // on change events and must not be served a stale pre-change value.
    const [apiListing, media] = await Promise.all([
      serverFetchResult<ApiListing>(`/listings/${id}`, { revalidate: 0 }),
      serverFetchResult<ApiListingMedia[]>(`/listings/${id}/media`, { revalidate: 0 }),
    ]);

    // A listing that is genuinely gone is a 404. A listing we could not reach
    // is not — rendering "not found" for an API restart tells the visitor, and
    // any crawler, that a live property was removed.
    if (!apiListing.ok) {
      if (apiListing.kind === 'not_found') {
        notFound();
      }
      return <ListingUnavailable />;
    }

    listing = apiListingToDetail(apiListing.data);
    // Media is secondary: a gallery that failed to load should not take the
    // page down with it, and the carousel already handles an empty list.
    listingMedia = media.ok ? media.data : [];
  } else {
    // Legacy mock ID (e.g. '1', '2') — use local mock data
    listing = getListingDetail(id);
  }

  if (!listing) {
    notFound();
  }

  // Parsed beds/baths/area + formatted property type for reuse across sections.
  const metrics = getListingDetailMetrics(listing);
  const mapUrls = getListingMapUrls(listing);

  return (
    <div className="min-h-screen bg-[#fef6f9] dark:bg-zinc-950">
      <ListingDetailInteractiveShell
        listingId={listing.id}
        listingTitle={listing.title ?? listing.address}
      >
      {/* Live updates only exist for real (UUID) listings — mocks have no channel. */}
      {isUuid(id) && <ListingDetailLiveUpdates listingId={id} />}
      {/* Page shell — light marketing background; inner wrapper centers content and caps width. */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Back navigation — returns shoppers to the searchable grid. */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/listings"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">&lt;</span> All listings
          </Link>
          <ShareSearchButton label="Share listing" />
        </div>

        {/* Two-column layout: narrative + map on the left; financials & CTA on the right (sticky on large screens via sidebar component). */}
        <div className="grid gap-8 lg:grid-cols-[1fr_min(360px,100%)] lg:items-start">
          {/* Primary column — scrolls with the page. */}
          <div className="min-w-0 space-y-6">
            {/* Hero — primary photo plus all IDX image media in a carousel. */}
            <ListingMediaCarousel
              primaryImage={listing.imageSrc}
              imageAlt={listing.imageAlt}
              media={listingMedia}
            />
            {/* Summary — status/type chips, title, price, and high-level address metadata. */}
            <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-6">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-600/90 px-3 py-1 text-[11px] font-semibold text-white">
                  {listing.statusLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-violet-600/90 px-3 py-1 text-[11px] font-semibold text-white">
                  {metrics.typeDisplay}
                </span>
                {/* Sale and lease prices are not on the same scale; the page
                    has to say which one the number above it is. */}
                {listing.transactionLabel ? (
                  <span className="inline-flex items-center rounded-full bg-zinc-900/85 px-3 py-1 text-[11px] font-semibold text-white dark:bg-zinc-100/90 dark:text-zinc-900">
                    {listing.transactionLabel}
                  </span>
                ) : null}
                {/* The board's own wording. "Price Change" is the kind of
                    movement the collapsed internal status throws away. */}
                {listing.mlsStatus ? (
                  <span className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-200">
                    {listing.mlsStatus}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
                {listing.title}
              </h1>
              <p className="mt-2 text-2xl font-extrabold text-primarycolor sm:text-3xl">
                {listing.priceText}{' '}
                <span className="text-base font-semibold text-zinc-400">
                  {listing.currency}
                </span>
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                <MapPinIcon
                  className="size-4 shrink-0 text-primarycolor"
                  aria-hidden="true"
                />
                <span>Province: {listing.province}</span>
                <span className="hidden sm:inline">·</span>
                <span>Postal Code: {listing.postalCode}</span>
                <span className="hidden sm:inline">·</span>
                <span>Country: {listing.country}</span>
                {listing.mlsNumber ? (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span>MLS&reg;#: {listing.mlsNumber}</span>
                  </>
                ) : null}
              </p>
              {/* The feed carries a tour on a minority of listings, and it was
                  being fetched and discarded on all of them. */}
              {listing.virtualTourUrl ? (
                <a
                  href={listing.virtualTourUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-full border border-primarycolor/35 px-4 text-sm font-semibold text-primarycolor transition hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
                >
                  View virtual tour
                </a>
              ) : null}
            </section>
            {/* Property specs — quick-scan pills (beds, baths, area, lot, year, parking). */}
            <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-6">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                Property specs
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <ListingDetailSpecPill
                  icon={
                    <BedDoubleIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  }
                  label="Beds"
                  value={`${metrics.bedsVal} Beds`}
                />
                <ListingDetailSpecPill
                  icon={
                    <BathIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  }
                  label="Baths"
                  value={`${metrics.bathsVal} Baths`}
                />
                <ListingDetailSpecPill
                  icon={
                    <RulerIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  }
                  label="Area"
                  value={metrics.areaText}
                />
                <ListingDetailSpecPill
                  icon={
                    <LayoutGridIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  }
                  label="Lot"
                  value={listing.lotSize}
                />
                <ListingDetailSpecPill
                  icon={
                    <CalendarIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  }
                  label="Year"
                  value={`${listing.yearBuilt} Year Built`}
                />
                <ListingDetailSpecPill
                  icon={
                    <CarIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  }
                  label="Parking"
                  value={`${listing.parking} Parking`}
                />
              </div>
            </section>

            {/* Long-form description — seller/agent narrative copy. */}
            <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-6">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                About this home
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {listing.about}
              </p>
            </section>

            {/* Structured facts grid — same data as specs but in label/value cells for scraping & clarity. */}
            <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-6">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                Details
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ListingDetailFactCell
                  label="Bedrooms"
                  value={metrics.bedsVal}
                />
                <ListingDetailFactCell
                  label="Bathrooms"
                  value={metrics.bathsVal}
                />
                <ListingDetailFactCell
                  label="Area"
                  value={metrics.areaText}
                />
                <ListingDetailFactCell
                  label="Year built"
                  value={listing.yearBuilt}
                />
                {/* This feed never populates YearBuilt, so the band is the only
                    age signal there is. */}
                <ListingDetailFactCell label="Age" value={listing.approximateAge} />
                <ListingDetailFactCell
                  label="Parking"
                  value={`${listing.parking} space`}
                />
                {/* The chip above already shows the subtype, so this cell
                    carries the broad board bucket rather than repeating it. */}
                <ListingDetailFactCell
                  label="Property type"
                  value={listing.propertyTypeLabel ?? metrics.typeDisplay}
                />
                <ListingDetailFactCell
                  label="Style"
                  value={listing.propertySubtypeLabel}
                />
                <ListingDetailFactCell label="MLS®#" value={listing.mlsNumber} />
                <ListingDetailFactCell
                  label="Listed"
                  value={formatListedOn(listing.listedAt)}
                />
                <ListingDetailFactCell label="Market" value={listing.market} />
                <ListingDetailFactCell
                  label="Country"
                  value={listing.country}
                />
                <ListingDetailFactCell label="Neighbourhood" value={listing.neighbourhood} />
                <ListingDetailFactCell label="Cross street" value={listing.crossStreet} />
                <ListingDetailFactCell label="Heating" value={listing.heatingType} />
                <ListingDetailFactCell label="Cooling" value={listing.cooling} />
                <ListingDetailFactCell label="Garage" value={listing.garageType} />
                <ListingDetailFactCell label="Basement" value={listing.basement} />
                <ListingDetailFactCell label="Kitchens" value={listing.kitchens} />
                <ListingDetailFactCell label="Lot" value={listing.lotDimensions} />
                <ListingDetailFactCell label="Sewer" value={listing.sewer} />
                <ListingDetailFactCell label="Tax year" value={listing.taxYear} />
              </div>
              {listing.propertyFeatures ? (
                <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100">Nearby: </span>
                  {listing.propertyFeatures}
                </p>
              ) : null}
              {listing.directions ? (
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-100">Directions: </span>
                  {listing.directions}
                </p>
              ) : null}
            </section>

            {/* Location — embedded map + coordinates + external maps link. */}
            <ListingDetailLocationSection
              listing={listing}
              mapEmbedUrl={mapUrls?.mapEmbedUrl ?? null}
              mapsLink={mapUrls?.mapsLink ?? null}
            />
          </div>

          {/* Sidebar — financials, agent placeholder, primary conversion CTA. */}
          <ListingDetailSidebar listing={listing} />
        </div>

        {/* Attribution and feed terms have to travel with the data itself. */}
        <ListingDisclaimer
          disclaimer={listing.sourceDisclaimer}
          brokerage={listing.attribution}
          updatedAt={listing.updatedAt}
        />
      </div>
      </ListingDetailInteractiveShell>
    </div>
  );
}
