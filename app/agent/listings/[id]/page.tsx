'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLinkIcon, MapPinIcon } from 'lucide-react';
import ListingInsightsSection from '@/components/portals/ListingInsightsSection';
import { fetchListingById } from '@/services/listingsService';
import type { ApiListing } from '@/types/api';

type Props = { params: Promise<{ id: string }> };

export default function AgentListingDetailPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null);
  const [listing, setListing] = useState<ApiListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      if (!cancelled) setId(p.id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchListingById(id)
      .then((l) => {
        if (cancelled) return;
        setError(null);
        setListing(l);
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Listing not found.';
        if (!cancelled) setError(String(msg));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {error}
        </div>
        <Link href="/agent/listings" className="text-sm font-semibold text-primarycolor hover:underline">
          ← Back to my listings
        </Link>
      </div>
    );
  }

  if (!listing) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading listing…</p>;
  }

  const img = listing.primary_image_url || 'https://picsum.photos/seed/agent-detail/900/600';
  const addr = listing.display_address || `${listing.address}, ${listing.city}`;

  return (
    <div className="space-y-8">
      <Link href="/agent/listings" className="text-sm font-semibold text-primarycolor hover:underline">
        ← My listings
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            <Image src={img} alt="" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {listing.title}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
              {addr}
            </p>
            <p className="mt-2 text-xl font-bold text-primarycolor">
              ${listing.price.toLocaleString('en-CA')} {listing.currency}
            </p>
          </div>
          <Link
            href={`/listings/${listing.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            View public listing page
            <ExternalLinkIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60" aria-labelledby="insights-heading">
          <h2 id="insights-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Client activity
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Buyers who chatted about this property while signed in, with detected intent and summaries.
          </p>
          <div className="mt-4">
            <ListingInsightsSection key={listing.id} listingId={listing.id} />
          </div>
        </section>
      </div>
    </div>
  );
}
