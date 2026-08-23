import { LayoutGridIcon, ListIcon, MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SORT_OPTIONS } from '@/components/listings/constants';
import type { ListingView } from '@/lib/listingFilters';
import ShareSearchButton from '@/components/listings/ShareSearchButton';

type ListingsToolbarProps = {
  count: number;
  sortBy: string;
  setSortBy: (v: string) => void;
  view: ListingView;
  setView: (v: ListingView) => void;
};

const VIEW_BUTTONS: { value: ListingView; label: string; Icon: typeof ListIcon }[] = [
  { value: 'grid', label: 'Grid view', Icon: LayoutGridIcon },
  { value: 'list', label: 'List view', Icon: ListIcon },
  { value: 'map', label: 'Map view', Icon: MapIcon },
];

export default function ListingsToolbar({
  count,
  sortBy,
  setSortBy,
  view,
  setView,
}: ListingsToolbarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400" aria-live="polite">
        <span className="font-extrabold text-zinc-900 dark:text-zinc-50">
          {count.toLocaleString('en-CA')}
        </span>{' '}
        {count === 1 ? 'listing' : 'listings'}
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

        <ShareSearchButton />

        <div className="flex items-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          {VIEW_BUTTONS.map(({ value, label, Icon }, index) => (
            <Button
              key={value}
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setView(value)}
              aria-pressed={view === value}
              aria-label={label}
              className={[
                index === 0 ? 'rounded-l-lg' : 'rounded-l-none',
                index === VIEW_BUTTONS.length - 1 ? 'rounded-r-lg' : 'rounded-r-none',
                view === value ? 'bg-zinc-100 dark:bg-zinc-800' : '',
              ].join(' ')}
            >
              <Icon className="size-4" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
