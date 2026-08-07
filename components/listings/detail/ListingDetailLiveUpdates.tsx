'use client';

/**
 * Invisible companion to the server-rendered listing detail page. The page
 * itself renders from `serverFetch` with no client-side copy of the listing to
 * patch, so a change event re-renders the route in place with `router.refresh()`
 * — the detail fetch runs with `revalidate: 0` for exactly this reason: a
 * cached read would make the refresh serve the value that just changed.
 *
 * Signed-out visitors hold no socket, so this renders nothing for them and the
 * page behaves as before.
 */

import { useRouter } from 'next/navigation';
import { realtimeChannel } from '@/lib/realtime/channels';
import { useChannels, useRealtimeEvent, useRefetchOnReconnect } from '@/lib/realtime/hooks';
import type { ListingDeletedPayload, ListingUpdatedPayload } from '@/types/api';

export default function ListingDetailLiveUpdates({ listingId }: { listingId: string }) {
  const router = useRouter();
  useChannels([realtimeChannel.listing(listingId)]);

  useRealtimeEvent<ListingUpdatedPayload>('listing.updated', ({ payload }) => {
    if (payload.listing_id !== listingId) return;
    router.refresh();
  });

  // A removed listing has nothing left to render, and every action on the page
  // would 404 — send the reader back to the grid, which no longer lists it.
  useRealtimeEvent<ListingDeletedPayload>('listing.deleted', ({ payload }) => {
    if (payload.listing_id !== listingId) return;
    router.replace('/listings');
  });

  useRefetchOnReconnect(() => router.refresh());

  return null;
}
