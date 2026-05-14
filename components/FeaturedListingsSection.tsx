import Link from 'next/link';
import React from 'react';

import { ArrowRight } from 'lucide-react';

import ListingCard from '@/components/ListingCard';

export type FeaturedListing = {
  id: string;
  statusLabel?: string;
  imageSrc: string;
  imageAlt: string;
  address: string;
  bedsText: string;
  bathsText: string;
  priceText: string;
  detailsHref: string;
};

type FeaturedListingsSectionProps = {
  listings: FeaturedListing[];
};

export default function FeaturedListingsSection({
  listings,
}: FeaturedListingsSectionProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 sm:px-10 pb-16 sm:pb-24">
      <div className="mt-10 grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        {listings.slice(0, 4).map((listing) => (
          <ListingCard key={listing.id} {...listing} saveListingId={listing.id} />
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          href="/listings"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primarycolor px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
        >
          Browse All Listings{' '}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
