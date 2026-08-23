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
import { serverFetch, isUuid } from '@/lib/serverFetch';
import type { ApiListing, ApiListingMedia } from '@/types/api';
import type { ListingDetail } from '@/components/listings/listingDetailData';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  let listing: ListingDetail | null = null;
  let listingMedia: ApiListingMedia[] = [];

  if (isUuid(id)) {
    // Fetch listing + media independently so search stays lightweight.
    // Uncached (`revalidate: 0`): ListingDetailLiveUpdates uses router.refresh()
    // on change events and must not be served a stale pre-change value.
    const [apiListing, media] = await Promise.all([
      serverFetch<ApiListing>(`/listings/${id}`, { revalidate: 0 }),
      serverFetch<ApiListingMedia[]>(`/listings/${id}/media`, { revalidate: 0 }),
    ]);
    if (apiListing) {
      listing = apiListingToDetail(apiListing);
      listingMedia = media ?? [];
    }
    // If API returned nothing for a valid UUID, 404 below
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
              </p>
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
                <ListingDetailFactCell
                  label="Property type"
                  value={metrics.typeDisplay}
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
        />
      </div>
      </ListingDetailInteractiveShell>
    </div>
  );
}
