'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchMySellerPortals, type SellerPortalAccess } from '@/services/sellerService';

export default function SellerPortalIndexPage() {
  const [portals, setPortals] = useState<SellerPortalAccess[] | null>(null);

  useEffect(() => {
    fetchMySellerPortals().then(setPortals).catch(() => setPortals([]));
  }, []);

  if (portals === null) {
    return <main className="mx-auto max-w-3xl p-6">Loading your seller portal…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <p className="text-sm font-semibold text-primarycolor">Lucy Charms Seller Portal</p>
        <h1 className="text-2xl font-bold">Your sale plans</h1>
      </header>
      {portals.length ? (
        <div className="space-y-3">
          {portals.map((portal) => (
            <Link
              key={portal.transaction_id}
              href={`/seller-portal/${portal.transaction_id}`}
              className="block rounded-xl border border-zinc-200 p-4 transition hover:border-primarycolor/50 hover:bg-primarycolor/5 dark:border-zinc-700"
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                {portal.property_address}{portal.property_unit ? `, Unit ${portal.property_unit}` : ''}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                {portal.property_city}, {portal.property_region} · Current stage: {portal.current_stage.replaceAll('_', ' ')}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Your approved seller portal will appear here once your representation process is complete.
        </p>
      )}
    </main>
  );
}
