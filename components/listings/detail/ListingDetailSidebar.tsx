'use client';

import React, { useState } from 'react';
import { CalendarIcon } from 'lucide-react';

import type { ListingDetail } from '@/components/listings/listingDetailData';
import { Button } from '@/components/ui/button';
import RequestShowingModal from '@/components/listings/detail/RequestShowingModal';
import ListingDetailAgentCard from '@/components/listings/detail/ListingDetailAgentCard';
import SaveListingButton from '@/components/listings/SaveListingButton';
import { isUuid } from '@/lib/serverFetch';

type ListingDetailSidebarProps = {
  listing: ListingDetail;
};

export default function ListingDetailSidebar({ listing }: ListingDetailSidebarProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {isUuid(listing.id) ? (
          <div className="rounded-xl border border-zinc-300/80 bg-white px-4 py-4 dark:border-zinc-600 dark:bg-zinc-900/30">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              Save this home
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Keep track of favourites — works before you create an account.
            </p>
            <div className="mt-3">
              <SaveListingButton listingId={listing.id} variant="inline" className="w-full" />
            </div>
          </div>
        ) : null}

        {/* Financials */}
        <div className="rounded-2xl border border-primarycolor/20 bg-[#fde7f3]/80 p-5 shadow-md backdrop-blur-sm dark:border-primarycolor/25 dark:bg-primarycolor/10">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-100">
            Financials — {listing.currency}
          </h2>
          <dl className="mt-4 space-y-3 divide-y divide-primarycolor/15 text-sm dark:divide-primarycolor/20">
            <div className="flex justify-between gap-4 pb-3 pt-0">
              <dt className="text-zinc-600 dark:text-zinc-300">Asking Price</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-50">{listing.priceText}</dd>
            </div>
            <div className="flex justify-between gap-4 pb-3 pt-3">
              <dt className="text-zinc-600 dark:text-zinc-300">Property Taxes / yr</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-50">{listing.taxesYearly}</dd>
            </div>
            <div className="flex justify-between gap-4 pb-0 pt-3">
              <dt className="text-zinc-600 dark:text-zinc-300">HOA / Condo Fee / mo</dt>
              <dd className="font-bold text-zinc-900 dark:text-zinc-50">{listing.hoaMonthly}</dd>
            </div>
          </dl>
        </div>

        <ListingDetailAgentCard agent={listing.agent} />

        {/* Book a showing CTA */}
        <Button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primarycolor text-sm font-semibold text-white shadow-md transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
          Request a Showing
        </Button>
      </aside>

      <RequestShowingModal
        open={showModal}
        listingId={listing.id}
        listingTitle={listing.title ?? listing.address}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
