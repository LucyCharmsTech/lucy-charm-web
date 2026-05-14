'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutGridIcon, ShieldCheckIcon } from 'lucide-react';
import ListingCard from '@/components/ListingCard';
import { apiListingToItem } from '@/lib/listingAdapter';
import { fetchAllListingsAdmin } from '@/services/portalService';
import type { ApiListing, ApiPaginated } from '@/types/api';

export default function AdminDashboardPage() {
  const [listings, setListings] = useState<ApiPaginated<ApiListing> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllListingsAdmin(1, 100)
      .then((page) => {
        if (cancelled) return;
        setError(null);
        setListings(page);
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load the brokerage catalog.';
        if (!cancelled) setError(String(msg));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!listings) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading admin overview…</p>;
  }

  const count = listings.total;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Brokerage overview
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Browse every active listing and open client-intent insights for any property.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            href="/admin/listings"
            className="mt-4 inline-flex text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            View catalog →
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primarycolor/10 text-primarycolor">
              <ShieldCheckIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Access
              </p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Full catalog and listing-level client activity
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Operations
          </p>
          <ul className="mt-3 space-y-2 text-sm font-semibold">
            <li>
              <Link
                href="/admin/insights"
                className="text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                Insights dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/admin/inquiries"
                className="text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                All inquiries (leads)
              </Link>
            </li>
            <li>
              <Link
                href="/admin/chat-logs"
                className="text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                AI chat logs
              </Link>
            </li>
            <li>
              <Link
                href="/admin/showings"
                className="text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                Showings
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {listings.items.length > 0 && (
        <section aria-labelledby="admin-preview-heading">
          <h2 id="admin-preview-heading" className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
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
