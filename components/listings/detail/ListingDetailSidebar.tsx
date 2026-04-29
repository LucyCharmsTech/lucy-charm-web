import React from 'react';

import { CalendarIcon } from 'lucide-react';

import type { ListingDetail } from '@/components/listings/listingDetailData';
import { Button } from '@/components/ui/button';

type ListingDetailSidebarProps = {
  listing: ListingDetail;
};

export default function ListingDetailSidebar({
  listing,
}: ListingDetailSidebarProps) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div className="rounded-2xl border border-primarycolor/20 bg-[#fde7f3]/80 p-5 shadow-md backdrop-blur-sm dark:border-primarycolor/25 dark:bg-primarycolor/10">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-100">
          Financials — {listing.currency}
        </h2>
        <dl className="mt-4 space-y-3 divide-y divide-primarycolor/15 text-sm dark:divide-primarycolor/20">
          <div className="flex justify-between gap-4 pb-3 pt-0">
            <dt className="text-zinc-600 dark:text-zinc-300">Asking Price</dt>
            <dd className="font-bold text-zinc-900 dark:text-zinc-50">
              {listing.priceText}
            </dd>
          </div>
          <div className="flex justify-between gap-4 pb-3 pt-3">
            <dt className="text-zinc-600 dark:text-zinc-300">
              Property Taxes / yr
            </dt>
            <dd className="font-bold text-zinc-900 dark:text-zinc-50">
              {listing.taxesYearly}
            </dd>
          </div>
          <div className="flex justify-between gap-4 pb-0 pt-3">
            <dt className="text-zinc-600 dark:text-zinc-300">
              HOA / Condo Fee / mo
            </dt>
            <dd className="font-bold text-zinc-900 dark:text-zinc-50">
              {listing.hoaMonthly}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-zinc-300/80 bg-white px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400">
        Agent information unavailable.
      </div>

      <Button
        type="button"
        variant="outline"
        disabled
        className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border-primarycolor/50 bg-primarycolor/5 text-primarycolor opacity-90 dark:bg-primarycolor/10"
        aria-disabled="true"
      >
        <CalendarIcon className="size-4" aria-hidden="true" />
        Book a Tour — Coming Soon
      </Button>
    </aside>
  );
}
