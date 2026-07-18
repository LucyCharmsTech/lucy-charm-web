'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  listSavedSearches,
  MAX_SAVED_SEARCHES,
  removeSavedSearch,
  saveSearch,
  type SavedSearchItem,
} from '@/lib/clientPortalStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchListingFacetOptions } from '@/services/listingsService';

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function buildQuery(city: string, type: string, minPrice: string, maxPrice: string): string {
  const params = new URLSearchParams();
  if (city.trim()) params.set('city', city.trim());
  if (type.trim()) params.set('propertyType', type.trim().toLowerCase());
  if (minPrice.trim()) params.set('price_min', minPrice.trim());
  if (maxPrice.trim()) params.set('price_max', maxPrice.trim());
  return params.toString();
}

export default function ClientSavedSearchesSection() {
  const [items, setItems] = useState<SavedSearchItem[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [propertyTypeOptions, setPropertyTypeOptions] = useState<string[]>([]);

  const minPriceValue = useMemo(() => Number.parseFloat(minPrice), [minPrice]);
  const maxPriceValue = useMemo(() => Number.parseFloat(maxPrice), [maxPrice]);
  const hasMinPrice = minPrice.trim().length > 0 && Number.isFinite(minPriceValue);
  const hasMaxPrice = maxPrice.trim().length > 0 && Number.isFinite(maxPriceValue);
  const invalidPriceRange = hasMinPrice && hasMaxPrice && maxPriceValue < minPriceValue;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItems(listSavedSearches());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(async () => fetchListingFacetOptions())
      .then((options) => {
        if (!active) return;
        setCityOptions(options.cities);
        setPropertyTypeOptions(options.propertyTypes);
      })
      .catch(() => {
        if (!active) return;
        setCityOptions([]);
        setPropertyTypeOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const canSave = useMemo(() => {
    return (
      items.length < MAX_SAVED_SEARCHES &&
      !invalidPriceRange &&
      name.trim().length >= 2 &&
      (city.trim() || propertyType.trim() || minPrice.trim() || maxPrice.trim())
    );
  }, [city, invalidPriceRange, items.length, maxPrice, minPrice, name, propertyType]);

  function handleSaveSearch() {
    if (items.length >= MAX_SAVED_SEARCHES) {
      setLimitMessage(`You can save up to ${MAX_SAVED_SEARCHES} searches.`);
      return;
    }
    if (invalidPriceRange) {
      setLimitMessage('Maximum price must be greater than or equal to minimum price.');
      return;
    }
    if (!canSave) return;
    const query = buildQuery(city, propertyType, minPrice, maxPrice);
    const next = saveSearch({
      id: crypto.randomUUID(),
      name: name.trim(),
      query,
      created_at: new Date().toISOString(),
    });
    setItems(next);
    setName('');
    setCity('');
    setPropertyType('');
    setMinPrice('');
    setMaxPrice('');
    setLimitMessage(null);
  }

  function handleDelete(id: string) {
    setItems(removeSavedSearch(id));
    setLimitMessage(null);
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Saved searches</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Save your preferred search combinations to quickly re-open filtered listings.
      </p>
      <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {items.length}/{MAX_SAVED_SEARCHES} saved
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="saved-search-name" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Search name <span className="text-primarycolor" aria-hidden="true">*</span>
          </label>
          <Input
            id="saved-search-name"
            required
            aria-required="true"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Search name (e.g. Downtown condos)"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="saved-search-city" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            City
          </label>
          <select
            id="saved-search-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Any city</option>
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="saved-search-property-type" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Property type
          </label>
          <select
            id="saved-search-property-type"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Any type</option>
            {propertyTypeOptions.map((option) => (
              <option key={option} value={option}>
                {toTitleCase(option)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="saved-search-min-price" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Minimum price
          </label>
          <Input
            id="saved-search-min-price"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="Min price"
            inputMode="numeric"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="saved-search-max-price" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Maximum price
          </label>
          <Input
            id="saved-search-max-price"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Max price"
            inputMode="numeric"
            className="h-10"
          />
        </div>
      </div>

      <div className="mt-3">
        <Button type="button" onClick={handleSaveSearch} disabled={!canSave}>
          Save search
        </Button>
      </div>
      {limitMessage && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{limitMessage}</p>
      )}
      {invalidPriceRange && (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          Maximum price must be greater than or equal to minimum price.
        </p>
      )}

      <div className="mt-5 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No saved searches yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80"
            >
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/listings${item.query ? `?${item.query}` : ''}`}>Open</Link>
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(item.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
