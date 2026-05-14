'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutGridIcon, UsersIcon } from 'lucide-react';
import ListingCard from '@/components/ListingCard';
import { apiListingToItem } from '@/lib/listingAdapter';
import { fetchMyAgentProfile, fetchListingsByAgentId } from '@/services/portalService';
import type { AgentProfile, ApiListing, ApiPaginated } from '@/types/api';

export default function AgentDashboardPage() {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [listings, setListings] = useState<ApiPaginated<ApiListing> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyAgentProfile()
      .then(async (a) => {
        if (cancelled) return;
        setError(null);
        setAgent(a);
        const page = await fetchListingsByAgentId(a.id, 1, 100);
        if (!cancelled) setListings(page);
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load your workspace.';
        if (!cancelled) setError(String(msg));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
        {error}
      </div>
    );
  }

  if (!agent || !listings) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading your dashboard…</p>;
  }

  const count = listings.total;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Hello, {agent.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage the listings assigned to you and see how buyers are engaging.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primarycolor/10 text-primarycolor">
              <LayoutGridIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Active listings
              </p>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">{count}</p>
            </div>
          </div>
          <Link
            href="/agent/listings"
            className="mt-4 inline-flex text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            View all →
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primarycolor/10 text-primarycolor">
              <UsersIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                License
              </p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{agent.license_number}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{agent.phone}</p>
        </div>
      </div>

      {listings.items.length > 0 && (
        <section aria-labelledby="agent-preview-heading">
          <h2 id="agent-preview-heading" className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Recent listings
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.items.slice(0, 3).map((l) => {
              const item = apiListingToItem(l);
              return <ListingCard key={l.id} {...item} />;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
