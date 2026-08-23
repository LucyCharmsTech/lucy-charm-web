'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  activeNarrowingFilters,
  listingsHref,
  type ListingFilters,
} from '@/lib/listingFilters';
import { GATED_STATUSES } from '@/components/listings/constants';

type NoResultsAssistanceProps = {
  filters: ListingFilters;
};

/**
 * What to say when the search returns nothing.
 *
 * Two different situations used to share one sentence ("Try adjusting your
 * filters"), and only one of them was the shopper's fault. Picking a status the
 * licence does not permit returns zero rows no matter what else is set — no
 * amount of filter-adjusting will help, and implying otherwise reads as a
 * broken site rather than a rule.
 */
export default function NoResultsAssistance({ filters }: NoResultsAssistanceProps) {
  const gated = (GATED_STATUSES as readonly string[]).includes(
    filters.status.toLowerCase(),
  );

  if (gated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {filters.status} listings are not available here
        </p>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          Our listing feed licence covers properties currently on the market. Completed
          sales and listings that are no longer being marketed are not published.
        </p>
        <Button asChild className="mt-5">
          <Link href={listingsHref({ ...filters, status: 'Active', page: 1 })}>
            Show active listings
          </Link>
        </Button>
      </div>
    );
  }

  // Most-specific filter first: the narrowest one is the one most worth
  // offering to drop, and offering all of them at once is just the reset button
  // spelled out longhand.
  const suggestions = activeNarrowingFilters(filters).slice(0, 3);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        No listings match this search
      </p>

      {suggestions.length === 0 ? (
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          There is nothing on the market matching these criteria right now. Check back
          later, or ask Lucy to watch for new listings.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Widening one of these usually helps:
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {suggestions.map((suggestion) => (
              <Button key={String(suggestion.key)} asChild variant="outline" size="sm">
                <Link
                  href={listingsHref({ ...filters, ...suggestion.cleared, page: 1 })}
                >
                  Remove {suggestion.label}
                </Link>
              </Button>
            ))}
          </div>
          <Button asChild variant="ghost" size="sm" className="mt-3">
            <Link href="/listings">Clear all filters</Link>
          </Button>
        </>
      )}
    </div>
  );
}
