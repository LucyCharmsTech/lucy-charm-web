/**
 * Saved listings API — supports logged-in users and anonymous session tokens.
 */

import api from '@/lib/axios';
import { getOrCreateAnonymousSessionToken } from '@/lib/anonymousSession';
import type { SavedListingCheckRead, SavedListingsRead } from '@/types/api';
import { ANONYMOUS_SESSION_HEADER } from '@/types/api';
import { useAuthStore } from '@/stores/authStore';

function anonRequestHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken
    ? ''
    : getOrCreateAnonymousSessionToken();
  if (!token) return {};
  return { [ANONYMOUS_SESSION_HEADER]: token };
}

export async function checkListingSaved(
  listingId: string,
): Promise<SavedListingCheckRead> {
  const res = await api.get<SavedListingCheckRead>(
    `/saved_listings/check/${listingId}`,
    { headers: anonRequestHeaders() },
  );
  return res.data;
}

export async function saveListing(listingId: string): Promise<SavedListingsRead> {
  const authed = Boolean(useAuthStore.getState().accessToken);
  const body = authed
    ? { listing_id: listingId }
    : {
        listing_id: listingId,
        session_token: getOrCreateAnonymousSessionToken(),
      };
  const res = await api.post<SavedListingsRead>('/saved_listings/', body);
  return res.data;
}

export async function unsaveListing(savedListingId: string): Promise<SavedListingsRead> {
  const res = await api.delete<SavedListingsRead>(
    `/saved_listings/${savedListingId}`,
    { headers: anonRequestHeaders() },
  );
  return res.data;
}

/**
 * Adopt this device's anonymous saves into the account that just signed in.
 *
 * Without it, a shopper who saves half a dozen homes and then registers lands
 * on an empty favourites page — the rows are still there under the session
 * token, and this browser still holds that token, but nothing claimed them.
 *
 * Returns the account's full save list, so the caller can render immediately.
 */
export async function claimAnonymousSaves(): Promise<SavedListingsRead[]> {
  const token = getOrCreateAnonymousSessionToken();
  if (!token) return [];
  const res = await api.post<SavedListingsRead[]>(
    '/saved_listings/claim',
    null,
    { headers: { [ANONYMOUS_SESSION_HEADER]: token } },
  );
  return res.data;
}

/** All saves for the current user or anonymous session (see GET /saved_listings/mine). */
export async function listMySavedListings(): Promise<SavedListingsRead[]> {
  const res = await api.get<SavedListingsRead[]>('/saved_listings/mine', {
    headers: anonRequestHeaders(),
  });
  return res.data;
}
