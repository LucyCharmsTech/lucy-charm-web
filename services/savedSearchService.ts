/**
 * Server-side saved searches — control 6.1 and the client's Q6.
 *
 * Replaces `lib/clientPortalStorage`'s localStorage array, which our
 * 1 September report described: *"Saved searches never leave the visitor's
 * browser. They are stored on the device only, limited to three, and disappear
 * if someone changes computer."*
 *
 * The limit is **read from the server**, not hardcoded — Q6 says five,
 * *"configurable"*, so the number belongs in one place and it is not here.
 */

import api from '@/lib/axios';
import type {
  SavedSearch,
  SavedSearchImportResult,
  SavedSearchLimit,
} from '@/types/api';

/** Filter keys a saved search may carry. Mirrors the server's allow-list. */
export const SAVED_SEARCH_FILTER_KEYS = [
  'city',
  'province_state',
  'country',
  'property_type',
  'property_types',
  'property_subtype',
  'property_subtypes',
  'transaction_type',
  'price_min',
  'price_max',
  'beds_min',
  'baths_min',
  'sqft_min',
  'sqft_max',
  'sort_by',
  'sort_order',
] as const;

export async function fetchMySavedSearches(): Promise<SavedSearch[]> {
  const res = await api.get<SavedSearch[]>('/saved_searches/mine');
  return res.data;
}

export async function fetchSavedSearchLimit(): Promise<SavedSearchLimit> {
  const res = await api.get<SavedSearchLimit>('/saved_searches/limit');
  return res.data;
}

export async function createSavedSearch(input: {
  name: string;
  filters: Record<string, unknown>;
  email_enabled?: boolean;
}): Promise<SavedSearch> {
  const res = await api.post<SavedSearch>('/saved_searches', input);
  return res.data;
}

export async function updateSavedSearch(
  id: string,
  patch: { name?: string; filters?: Record<string, unknown>; email_enabled?: boolean },
): Promise<SavedSearch> {
  const res = await api.patch<SavedSearch>(`/saved_searches/${id}`, patch);
  return res.data;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await api.delete(`/saved_searches/${id}`);
}

/**
 * Carry searches saved on this device onto the account.
 *
 * Returns what was kept, what merged as a duplicate, and what did not fit —
 * Q6 forbids discarding silently, so the caller must show the rejected names.
 */
export async function importDeviceSearches(
  searches: { name: string; filters: Record<string, unknown> }[],
): Promise<SavedSearchImportResult> {
  const res = await api.post<SavedSearchImportResult>('/saved_searches/import', {
    searches,
  });
  return res.data;
}

/** A short human description of a saved search's filters, for a list row. */
export function describeFilters(filters: Record<string, unknown>): string {
  const parts: string[] = [];
  if (filters.city) parts.push(String(filters.city));
  if (filters.property_type) parts.push(String(filters.property_type));
  if (filters.beds_min) parts.push(`${filters.beds_min}+ beds`);
  if (filters.baths_min) parts.push(`${filters.baths_min}+ baths`);
  if (filters.price_min || filters.price_max) {
    const min = filters.price_min ? `$${Number(filters.price_min).toLocaleString()}` : '';
    const max = filters.price_max ? `$${Number(filters.price_max).toLocaleString()}` : '';
    parts.push(min && max ? `${min}–${max}` : min ? `from ${min}` : `up to ${max}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'All listings';
}
