'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';

type Portal = {
  transaction: {
    id: string;
    stage: string;
    status: string;
    representation_status: string;
  };
  current_stage: string;
  stages: string[];
  client_visible_documents: {
    id: string;
    category: string;
    description: string | null;
    original_filename: string | null;
    status: string;
  }[];
  public_listing_url: string | null;
  public_listing_status: string | null;
};

const labels: Record<string, string> = {
  preparation: 'Preparation',
  documents: 'Documents',
  marketing_listing_ready: 'Marketing / Listing Ready',
  active_listing: 'Active Listing',
  showings_open_houses: 'Showings / Open Houses',
  offers: 'Offers',
  conditional_sold: 'Conditional / Sold',
  closing: 'Closing',
};

export default function SellerPortalPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const [portal, setPortal] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    params.then(({ transactionId }) =>
      api
        .get<Portal>(`/seller-transactions/${transactionId}/portal`)
        .then((r) => setPortal(r.data))
        .catch(() =>
          setError('This seller portal is unavailable to your account.'),
        ),
    );
  }, [params]);
  if (error)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p role="alert">{error}</p>
      </main>
    );
  if (!portal)
    return (
      <main className="mx-auto max-w-3xl p-6">Loading seller portal…</main>
    );
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-semibold text-primarycolor">
          Lucy Charms Seller Portal
        </p>
        <h1 className="text-2xl font-bold">Your sale plan</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Current stage: {labels[portal.current_stage] ?? portal.current_stage}.
          Listing publication remains managed by your brokerage.
        </p>
      </header>
      <nav aria-label="Sale stages" className="flex flex-wrap gap-2">
        {portal.stages.map((stage) => (
          <span
            key={stage}
            className={`rounded-full px-3 py-1 text-sm ${stage === portal.current_stage ? 'bg-primarycolor text-white' : 'bg-zinc-100 text-zinc-700'}`}
          >
            {labels[stage] ?? stage}
          </span>
        ))}
      </nav>
      <section>
        <h2 className="text-lg font-bold">Documents</h2>
        {portal.client_visible_documents.length ? (
          <ul className="mt-2 space-y-2">
            {portal.client_visible_documents.map((document) => (
              <li key={document.id} className="rounded-lg border p-3">
                <strong>
                  {document.original_filename ?? document.category}
                </strong>
                <span className="ml-2 text-sm text-zinc-600">
                  {document.status}
                </span>
                {document.description && (
                  <p className="text-sm">{document.description}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">
            No client-visible documents are available yet.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-lg font-bold">Listing and activity</h2>
        {portal.public_listing_url ? (
          <Link
            className="mt-2 inline-block text-primarycolor underline"
            href={portal.public_listing_url}
          >
            View approved public listing
          </Link>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">
            Your brokerage will share approved listing details here when ready.
          </p>
        )}
        <p className="mt-2 text-sm text-zinc-600">
          Offers, feedback, conditions, and closing items appear only after your
          agent approves them for this portal.
        </p>
      </section>
    </main>
  );
}
