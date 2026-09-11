'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_FILTERS, paramsFromFilters } from '@/lib/listingFilters';
import { listSavedSearches as listDeviceSearches } from '@/lib/clientPortalStorage';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { fetchListingFacetOptions } from '@/services/listingsService';
import {
  createSavedSearch,
  deleteSavedSearch,
  describeFilters,
  fetchMySavedSearches,
  fetchSavedSearchLimit,
  importDeviceSearches,
  updateSavedSearch,
} from '@/services/savedSearchService';
import type { SavedSearch } from '@/types/api';

function toTitleCase(value: string): string {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * The link a saved search opens.
 *
 * Goes through the shared filter serialiser rather than hand-writing keys. A
 * hand-written version once emitted `propertyType`, `price_min` and
 * `price_max` into a URL the listings page only read `country` and `city`
 * from, so "Downtown condos under 800k" quietly returned every listing in that
 * city at any price.
 */
function linkFor(filters: Record<string, unknown>): string {
  return `/listings?${paramsFromFilters({
    ...DEFAULT_FILTERS,
    city: String(filters.city ?? ''),
    propertyTypes: filters.property_type ? [String(filters.property_type)] : [],
    priceMin: filters.price_min ? String(filters.price_min) : '',
    priceMax: filters.price_max ? String(filters.price_max) : '',
  }).toString()}`;
}

export default function ClientSavedSearchesSection() {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [limit, setLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [propertyTypeOptions, setPropertyTypeOptions] = useState<string[]>([]);

  const [deviceCount, setDeviceCount] = useState(0);
  const [importDismissed, setImportDismissed] = useState(false);

  const minPriceValue = useMemo(() => Number.parseFloat(minPrice), [minPrice]);
  const maxPriceValue = useMemo(() => Number.parseFloat(maxPrice), [maxPrice]);
  const hasMinPrice = minPrice.trim().length > 0 && Number.isFinite(minPriceValue);
  const hasMaxPrice = maxPrice.trim().length > 0 && Number.isFinite(maxPriceValue);
  const invalidPriceRange = hasMinPrice && hasMaxPrice && maxPriceValue < minPriceValue;

  useEffect(() => {
    let active = true;
    Promise.all([fetchMySavedSearches(), fetchSavedSearchLimit()])
      .then(([rows, quota]) => {
        if (!active) return;
        setItems(rows);
        setLimit(quota.limit);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Could not load your saved searches.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let active = true;
    fetchListingFacetOptions()
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDeviceCount(listDeviceSearches().length);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const atLimit = limit !== null && items.length >= limit;
  const canSave =
    !atLimit &&
    !invalidPriceRange &&
    name.trim().length >= 2 &&
    Boolean(city.trim() || propertyType.trim() || minPrice.trim() || maxPrice.trim());

  function currentFilters(): Record<string, unknown> {
    const filters: Record<string, unknown> = {};
    if (city.trim()) filters.city = city.trim();
    if (propertyType.trim()) filters.property_type = propertyType.trim();
    if (hasMinPrice) filters.price_min = minPriceValue;
    if (hasMaxPrice) filters.price_max = maxPriceValue;
    return filters;
  }

  async function handleSave() {
    if (!canSave) return;
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      await createSavedSearch({ name: name.trim(), filters: currentFilters() });
      setName('');
      setCity('');
      setPropertyType('');
      setMinPrice('');
      setMaxPrice('');
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not save that search.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    setBusy(id);
    setError(null);
    try {
      await deleteSavedSearch(id);
      setItems((prev) => prev.filter((row) => row.id !== id));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not delete that search.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleEmail(row: SavedSearch) {
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSavedSearch(row.id, {
        email_enabled: !row.email_enabled,
      });
      setItems((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      setNotice(
        updated.email_enabled
          ? `Daily emails on for “${updated.name}”. New matches only — nothing already listed.`
          : `Daily emails paused for “${updated.name}”. The search is kept.`,
      );
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not change that setting.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    setBusy('import');
    setError(null);
    setNotice(null);
    try {
      const device = listDeviceSearches();
      const result = await importDeviceSearches(
        device.map((entry) => ({
          name: entry.name,
          filters: { city: new URLSearchParams(entry.query).get('city') ?? '' },
        })),
      );
      const parts = [`${result.imported.length} kept`];
      if (result.duplicates.length > 0) {
        parts.push(`${result.duplicates.length} already saved`);
      }
      if (result.rejected.length > 0) {
        parts.push(`not enough room for: ${result.rejected.join(', ')}`);
      }
      setNotice(parts.join(' · '));
      setImportDismissed(true);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not bring those searches over.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Saved searches</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Saved to your account, so they follow you between devices.
      </p>
      {limit !== null && (
        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {items.length}/{limit} saved
        </p>
      )}

      {deviceCount > 0 && !importDismissed && (
        <div className="mt-4 rounded-xl border border-primarycolor/30 bg-primarycolor/5 p-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Keep searches from this device?
          </p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {deviceCount} {deviceCount === 1 ? 'search was' : 'searches were'} saved
            on this browser before. Bringing them over will not turn on any emails.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={() => void handleImport()}
              disabled={busy !== null}
              className="h-8 rounded-full bg-primarycolor px-3 text-xs font-semibold text-primarycolor-foreground hover:bg-primarycolor/90"
            >
              Keep them
            </Button>
            <button
              type="button"
              onClick={() => setImportDismissed(true)}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Input
          aria-label="Search name"
          placeholder="Search name (e.g. Downtown condos)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
        />
        <Input
          aria-label="City"
          list="saved-search-cities"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <datalist id="saved-search-cities">
          {cityOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <Input
          aria-label="Property type"
          list="saved-search-types"
          placeholder="Property type"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value)}
        />
        <datalist id="saved-search-types">
          {propertyTypeOptions.map((option) => (
            <option key={option} value={toTitleCase(option)} />
          ))}
        </datalist>
        <Input
          aria-label="Min price"
          type="number"
          placeholder="Min price"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
        <Input
          aria-label="Max price"
          type="number"
          placeholder="Max price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>

      {invalidPriceRange && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Maximum price must be greater than or equal to minimum price.
        </p>
      )}
      {atLimit && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          You can save up to {limit} searches. Delete one to make room.
        </p>
      )}

      <Button
        type="button"
        onClick={() => void handleSave()}
        disabled={!canSave || busy !== null}
        className="mt-3 h-9 rounded-full bg-primarycolor px-4 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-60"
      >
        {busy === 'save' ? 'Saving…' : 'Save search'}
      </Button>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No saved searches yet.
          </p>
        ) : (
          items.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {row.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {describeFilters(row.filters)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={linkFor(row.filters)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(row.id)}
                    disabled={busy !== null}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={row.email_enabled}
                  disabled={busy !== null}
                  onChange={() => void handleToggleEmail(row)}
                />
                Email me new matches daily
              </label>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
