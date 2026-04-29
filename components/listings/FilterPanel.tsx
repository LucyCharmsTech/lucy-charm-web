import { useState } from 'react';

import { SlidersHorizontalIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BATHROOMS,
  BEDROOMS,
  PROPERTY_TYPES,
  STATUSES,
} from '@/components/listings/constants';
import FilterChip from '@/components/listings/FilterChip';

type FilterPanelProps = {
  status: string;
  setStatus: (v: string) => void;
  propertyTypes: string[];
  setPropertyTypes: (v: string[]) => void;
  beds: string;
  setBeds: (v: string) => void;
  baths: string;
  setBaths: (v: string) => void;
};

function toggleItem<T>(value: T, arr: T[]): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function FilterPanel({
  status,
  setStatus,
  propertyTypes,
  setPropertyTypes,
  beds,
  setBeds,
  baths,
  setBaths,
}: FilterPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="m-4 rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-inset"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-primarycolor/15">
            <SlidersHorizontalIcon
              className="size-4 text-primarycolor"
              aria-hidden="true"
            />
          </span>
          <div className="text-left">
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Filters
            </div>
            <div className="text-[11px] text-primarycolor">
              Refine results instantly
            </div>
          </div>
        </div>
        <span
          className={`text-zinc-400 transition-transform duration-200 ${
            open ? 'rotate-0' : 'rotate-180'
          }`}
        >
          &#x2303;
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Status
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <FilterChip
                  key={s}
                  active={status === s}
                  onClick={() => setStatus(s)}
                >
                  {s}
                </FilterChip>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Property Type
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PROPERTY_TYPES.map((t) => (
                <FilterChip
                  key={t}
                  active={propertyTypes.includes(t)}
                  onClick={() => setPropertyTypes(toggleItem(t, propertyTypes))}
                >
                  {t}
                </FilterChip>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Price Range
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Min price"
                type="number"
                className="h-9 rounded-full text-xs"
              />
              <Input
                placeholder="Max price"
                type="number"
                className="h-9 rounded-full text-xs"
              />
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Min Bedrooms
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {BEDROOMS.map((b) => (
                <FilterChip
                  key={b}
                  active={beds === b}
                  onClick={() => setBeds(beds === b ? '' : b)}
                >
                  {b}
                </FilterChip>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Min Bathrooms
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {BATHROOMS.map((b) => (
                <FilterChip
                  key={b}
                  active={baths === b}
                  onClick={() => setBaths(baths === b ? '' : b)}
                >
                  {b}
                </FilterChip>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Square Footage
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Min sqft"
                type="number"
                className="h-9 rounded-full text-xs"
              />
              <Input
                placeholder="Max sqft"
                type="number"
                className="h-9 rounded-full text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
