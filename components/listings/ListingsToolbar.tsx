import { LayoutGridIcon, ListIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SORT_OPTIONS } from '@/components/listings/constants';

type ListingsToolbarProps = {
  count: number;
  sortBy: string;
  setSortBy: (v: string) => void;
  view: 'grid' | 'list';
  setView: (v: 'grid' | 'list') => void;
};

export default function ListingsToolbar({
  count,
  sortBy,
  setSortBy,
  view,
  setView,
}: ListingsToolbarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        <span className="font-extrabold text-zinc-900 dark:text-zinc-50">
          {count}
        </span>{' '}
        listings
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-500">Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-primarycolor focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            aria-label="Sort listings"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setView('grid')}
            aria-pressed={view === 'grid'}
            aria-label="Grid view"
            className={`rounded-l-lg rounded-r-none ${view === 'grid' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
          >
            <LayoutGridIcon className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            aria-label="List view"
            className={`rounded-l-none rounded-r-lg ${view === 'list' ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
          >
            <ListIcon className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
