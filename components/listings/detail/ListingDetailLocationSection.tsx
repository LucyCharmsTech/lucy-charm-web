import React from 'react';

import type { ListingDetail } from '@/components/listings/listingDetailData';

type ListingDetailLocationSectionProps = {
  listing: ListingDetail;
  mapEmbedUrl: string;
  mapsLink: string;
};

export default function ListingDetailLocationSection({
  listing,
  mapEmbedUrl,
  mapsLink,
}: ListingDetailLocationSectionProps) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-6">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
        Location
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <iframe
          title={`Map for ${listing.title}`}
          src={mapEmbedUrl}
          className="aspect-video w-full border-0 sm:aspect-21/9"
          loading="lazy"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {listing.lat.toFixed(5)}, {listing.lng.toFixed(4)}
        </span>
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
        >
          Open in Google Maps
        </a>
      </div>
    </section>
  );
}
