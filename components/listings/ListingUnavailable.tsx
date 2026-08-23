import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * Shown when the listing could not be loaded — as distinct from not existing.
 *
 * The difference matters to the visitor and to search engines: a 404 says the
 * property is gone, and an outage is not that. This page keeps the URL valid
 * and asks the reader to try again, which is the only honest thing to say when
 * the API did not answer.
 */
export default function ListingUnavailable() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#fef6f9] px-6 py-20 text-center dark:bg-zinc-950">
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
        We could not load this listing
      </h1>
      <p className="mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        The property information service did not respond. The listing has not been
        removed — please try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/listings">Back to all listings</Link>
        </Button>
      </div>
    </div>
  );
}
