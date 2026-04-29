'use client';

import { useState } from 'react';

import ListingCard from '@/components/ListingCard';
import { MOCK_LISTINGS } from '@/components/listings/data';
import FilterPanel from '@/components/listings/FilterPanel';
import ListingsToolbar from '@/components/listings/ListingsToolbar';

export default function ListingsPage() {
  const [status, setStatus] = useState<string>('Active');
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sortBy, setSortBy] = useState<string>('Newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const listings = MOCK_LISTINGS;

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-screen bg-background m-auto pmd:px-[100px]">
      {/* ── Sidebar ── */}
      <aside className="w-full md:w-72 shrink-0 border-zinc-200/80 bg-white dark:border-zinc-800/80 dark:bg-zinc-950/30 md:sticky md:top-6 self-start">
        <FilterPanel
          status={status}
          setStatus={setStatus}
          propertyTypes={propertyTypes}
          setPropertyTypes={setPropertyTypes}
          beds={beds}
          setBeds={setBeds}
          baths={baths}
          setBaths={setBaths}
        />
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col px-6 py-6 sm:px-8">
        <ListingsToolbar
          count={listings.length}
          sortBy={sortBy}
          setSortBy={setSortBy}
          view={view}
          setView={setView}
        />

        {/* Cards */}
        {view === 'grid' ? (
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3 max-w-6xl">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                {...listing}
                detailsHref={`/listings/${listing.id}`}
                view="grid"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                {...listing}
                detailsHref={`/listings/${listing.id}`}
                view="list"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
