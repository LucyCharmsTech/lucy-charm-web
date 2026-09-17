'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LoaderIcon } from 'lucide-react';
import { HomeValueReport } from '@/components/homeValue/HomeValueReport';
import { serverMessage } from '@/lib/formStates';
import { fetchMyHomeValueRequests } from '@/services/homeValueService';
import type { HomeValueRequestRead } from '@/types/homeValue';

/**
 * Where a Home Value report is delivered — plan item 4.2.
 *
 * Hamed: *"the report appears in the portal and the email links securely."*
 * The notification deep-links to `?home_value=<id>#home-value`, which is this
 * section. The email carries **no figure** — a valuation in an email body is
 * readable by anyone who reaches the mailbox, forwards without its limitations,
 * and cannot be corrected once sent.
 *
 * Read-only, like the Property Reviews section beside it. The person submits
 * from `/home-value` and is notified when the report is ready; this is where
 * they come back to read it.
 *
 * The section renders **nothing at all** when there are no requests, rather
 * than an empty card. Someone who has never asked for a valuation should not
 * have a permanent reminder that they have not.
 */
export default function ClientHomeValueSection() {
  const [items, setItems] = useState<HomeValueRequestRead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchMyHomeValueRequests()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(serverMessage(err, 'Could not load your Home Value requests.'));
        setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (items === null) {
    return (
      <section id="home-value" aria-labelledby="home-value-heading">
        <h2
          id="home-value-heading"
          className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
        >
          Home Value
        </h2>
        <div
          role="status"
          aria-label="Loading your Home Value requests"
          className="mt-3 flex items-center gap-2 text-sm text-zinc-500"
        >
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      </section>
    );
  }

  // Nothing to show, and nothing worth saying. A person who has never asked
  // for a valuation does not need a card telling them so on every visit.
  if (items.length === 0 && !error) return null;

  return (
    <section id="home-value" aria-labelledby="home-value-heading">
      <h2
        id="home-value-heading"
        className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
      >
        Home Value
      </h2>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-4">
            {items.map((request) => (
              <HomeValueReport key={request.id} request={request} />
            ))}
          </div>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Want a valuation on another property?{' '}
            <Link href="/home-value" className="underline hover:no-underline">
              Ask for one
            </Link>
            .
          </p>
        </>
      )}
    </section>
  );
}
