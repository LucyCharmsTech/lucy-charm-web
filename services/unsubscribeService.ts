/**
 * Public unsubscribe API — the only service in the app that must work with no
 * session at all.
 *
 * The client was told unsubscribe "works without signing in", so these three
 * calls carry a token from the email footer and nothing else. `api` attaches a
 * Bearer token when one happens to be in the store, which is harmless: the
 * endpoints ignore it and authorize on the token in the body.
 *
 * GET  /unsubscribe?token=…       what this address currently receives
 * POST /unsubscribe               switch one stream, or all, off
 * POST /unsubscribe/resubscribe   switch one stream back on
 */

import api from '@/lib/axios';
import type { UnsubscribeState } from '@/types/api';

/** Every stream a recipient can be opted out of individually. */
export const CONSENT_STREAMS = [
  'marketing',
  'listing_alert',
  'product_update',
  'saved_search_alert',
] as const;

export type ConsentStream = (typeof CONSENT_STREAMS)[number];

/** Not a stream — the single stop-all switch. */
export const ALL_PROMOTIONAL = 'all_promotional';

/** Labels shown to the recipient. Kept here so both pages read the same words. */
export const STREAM_LABELS: Record<ConsentStream, string> = {
  marketing: 'Lucy updates and offers',
  listing_alert: 'New listing alerts',
  product_update: 'Product news',
  saved_search_alert: 'Daily saved-search matches',
};

export const STREAM_DESCRIPTIONS: Record<ConsentStream, string> = {
  marketing: 'Occasional emails about Lucy Charms services and offers.',
  listing_alert: 'Emails when a property matching your interests is listed.',
  product_update: 'Occasional emails about new features on the site.',
  saved_search_alert: 'A daily email when new properties match a saved search.',
};

export async function fetchUnsubscribeState(token: string): Promise<UnsubscribeState> {
  const res = await api.get<UnsubscribeState>('/unsubscribe', { params: { token } });
  return res.data;
}

export async function unsubscribeStream(
  token: string,
  stream: ConsentStream | typeof ALL_PROMOTIONAL,
): Promise<UnsubscribeState> {
  const res = await api.post<UnsubscribeState>('/unsubscribe', { token, stream });
  return res.data;
}

export async function resubscribeStream(
  token: string,
  stream: ConsentStream,
): Promise<UnsubscribeState> {
  const res = await api.post<UnsubscribeState>('/unsubscribe/resubscribe', { token, stream });
  return res.data;
}
