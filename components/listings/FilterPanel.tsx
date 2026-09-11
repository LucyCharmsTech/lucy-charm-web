import { useEffect, useState } from 'react';

import { SlidersHorizontalIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BATHROOMS,
  BEDROOMS,
  COUNTRY_OPTIONS,
  STATUSES,
} from '@/components/listings/constants';
import FilterChip from '@/components/listings/FilterChip';

type FilterPanelProps = {
  status: string;
  setStatus: (v: string) => void;
  country: string;
  setCountry: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  propertyTypes: string[];
  propertyTypeOptions: string[];
  propertyTypesLoading: boolean;
  listingTitles: string[];
  listingTitleOptions: string[];
  listingTitlesLoading: boolean;
  setPropertyTypes: (v: string[]) => void;
  setListingTitles: (v: string[]) => void;
  beds: string;
  setBeds: (v: string) => void;
  baths: string;
  setBaths: (v: string) => void;
  priceMin: string;
  priceMax: string;
  setPriceRange: (min: string, max: string) => void;
  sqftMin: string;
  sqftMax: string;
  setSqftRange: (min: string, max: string) => void;
};

function toggleItem<T>(value: T, arr: T[]): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function formatPropertyType(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function FilterPanel({
  status,
  setStatus,
  country,
  setCountry,
  city,
  setCity,
  propertyTypes = [],
  propertyTypeOptions = [],
  propertyTypesLoading = false,
  listingTitles = [],
  listingTitleOptions = [],
  listingTitlesLoading = false,
  setPropertyTypes,
  setListingTitles,
  beds,
  setBeds,
  baths,
  setBaths,
  priceMin,
  priceMax,
  setPriceRange,
  sqftMin,
  sqftMax,
  setSqftRange,
}: FilterPanelProps) {
  const [open, setOpen] = useState(true);
  const [cityDraft, setCityDraft] = useState(city);

  useEffect(() => {
    setCityDraft(city);
  }, [city]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (cityDraft !== city) setCity(cityDraft);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [cityDraft, city, setCity]);

  // Ranges are typed, so they debounce like the city field rather than
  // re-querying on every digit.
  const [priceDraft, setPriceDraft] = useState({ min: priceMin, max: priceMax });
  const [sqftDraft, setSqftDraft] = useState({ min: sqftMin, max: sqftMax });

  useEffect(() => {
    setPriceDraft({ min: priceMin, max: priceMax });
  }, [priceMin, priceMax]);

  useEffect(() => {
    setSqftDraft({ min: sqftMin, max: sqftMax });
  }, [sqftMin, sqftMax]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (priceDraft.min !== priceMin || priceDraft.max !== priceMax) {
        setPriceRange(priceDraft.min, priceDraft.max);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [priceDraft, priceMin, priceMax, setPriceRange]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sqftDraft.min !== sqftMin || sqftDraft.max !== sqftMax) {
        setSqftRange(sqftDraft.min, sqftDraft.max);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [sqftDraft, sqftMin, sqftMax, setSqftRange]);

  // A max below the min returns nothing and looks like a broken search, so say
  // so where it happened instead of showing an empty grid.
  const priceInverted =
    Boolean(priceDraft.min && priceDraft.max) &&
    Number(priceDraft.max) < Number(priceDraft.min);
  const sqftInverted =
    Boolean(sqftDraft.min && sqftDraft.max) &&
    Number(sqftDraft.max) < Number(sqftDraft.min);

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
              className="size-4 text-primarycolor-text"
              aria-hidden="true"
            />
          </span>
          <div className="text-left">
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              Filters
            </div>
            <div className="text-[11px] text-primarycolor-text">
              Refine results instantly
            </div>
          </div>
        </div>
        <span
          className={`text-zinc-500 dark:text-zinc-400 transition-transform duration-200 ${
            open ? 'rotate-0' : 'rotate-180'
          }`}
        >
          &#x2303;
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
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
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Country
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRY_OPTIONS.map((option) => (
                <FilterChip
                  key={option.label}
                  active={country === option.value}
                  onClick={() => setCountry(option.value)}
                >
                  {option.label}
                </FilterChip>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label htmlFor="listings-city-filter" className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              City
            </Label>
            <Input
              id="listings-city-filter"
              value={cityDraft}
              onChange={(e) => setCityDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setCity(cityDraft);
              }}
              placeholder="Toronto, Vancouver, Ottawa…"
              className="h-9 rounded-full text-xs"
              autoComplete="address-level2"
            />
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Property Type
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {propertyTypesLoading && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Loading types…</span>
              )}
              {!propertyTypesLoading && propertyTypeOptions.length === 0 && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">No types available</span>
              )}
              {propertyTypeOptions.map((type) => (
                <FilterChip
                  key={type}
                  active={propertyTypes.includes(type)}
                  onClick={() => setPropertyTypes(toggleItem(type, propertyTypes))}
                >
                  {formatPropertyType(type)}
                </FilterChip>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
              Listing Title
            </Label>
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {listingTitlesLoading && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Loading titles…</span>
              )}
              {!listingTitlesLoading && listingTitleOptions.length === 0 && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">No titles available</span>
              )}
              {listingTitleOptions.map((title) => (
                <FilterChip
                  key={title}
                  active={listingTitles.includes(title)}
                  onClick={() => setListingTitles(toggleItem(title, listingTitles))}
                >
                  {title}
                </FilterChip>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
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
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
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
            <Label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
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

          {/*
            Price has been supported by the API since the first version of the
            search — price_min and price_max — and has never had a control. It
            is the filter shoppers reach for first.
          */}
          <div className="space-y-2">
            <Label
              htmlFor="filter-price-min"
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
            >
              Price
            </Label>
            <div className="flex gap-2">
              <Input
                id="filter-price-min"
                aria-label="Minimum price"
                placeholder="Min price"
                type="number"
                min={0}
                step={10000}
                inputMode="numeric"
                value={priceDraft.min}
                onChange={(event) =>
                  setPriceDraft((current) => ({ ...current, min: event.target.value }))
                }
                className="h-9 rounded-full text-xs"
              />
              <Input
                aria-label="Maximum price"
                placeholder="Max price"
                type="number"
                min={0}
                step={10000}
                inputMode="numeric"
                value={priceDraft.max}
                onChange={(event) =>
                  setPriceDraft((current) => ({ ...current, max: event.target.value }))
                }
                aria-invalid={priceInverted}
                className="h-9 rounded-full text-xs"
              />
            </div>
            {priceInverted && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400" role="alert">
                Maximum price is below the minimum, so nothing can match.
              </p>
            )}
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          {/*
            These two inputs already existed and were wired to nothing — no
            value, no handler — so typing in them changed the search not at all.
          */}
          <div className="space-y-2">
            <Label
              htmlFor="filter-sqft-min"
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400"
            >
              Square Footage
            </Label>
            <div className="flex gap-2">
              <Input
                id="filter-sqft-min"
                aria-label="Minimum square footage"
                placeholder="Min sqft"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                value={sqftDraft.min}
                onChange={(event) =>
                  setSqftDraft((current) => ({ ...current, min: event.target.value }))
                }
                className="h-9 rounded-full text-xs"
              />
              <Input
                aria-label="Maximum square footage"
                placeholder="Max sqft"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                value={sqftDraft.max}
                onChange={(event) =>
                  setSqftDraft((current) => ({ ...current, max: event.target.value }))
                }
                aria-invalid={sqftInverted}
                className="h-9 rounded-full text-xs"
              />
            </div>
            {sqftInverted && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400" role="alert">
                Maximum area is below the minimum, so nothing can match.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
