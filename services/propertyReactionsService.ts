/**
 * Love / Maybe / Not for me — controls 6.10 and 6.11.
 *
 * One reversible state per property. The API enforces that with a unique index
 * on (user, listing), so the client never has to reconcile two reactions.
 *
 * Signed-in only: control 6.10 says "one stored *user*-property state", and a
 * reaction has to survive across devices to be worth anything. Guest saving
 * and its merge are control 6.8, a separate item.
 */

import api from '@/lib/axios';
import type { PropertyReaction, PropertyReactionRead } from '@/types/api';

/** The three, in the order they are shown. */
export const REACTIONS = ['love', 'maybe', 'not_for_me'] as const;

export const REACTION_LABELS: Record<PropertyReaction, string> = {
  love: 'Love',
  maybe: 'Maybe',
  not_for_me: 'Not for me',
};

/** What each one does, in the client's own terms. Used for the button titles. */
export const REACTION_DESCRIPTIONS: Record<PropertyReaction, string> = {
  love: 'Saves this home to your favourites',
  maybe: 'Keeps this home on your shortlist while you decide',
  not_for_me: 'Hides this home from your browsing',
};

export async function fetchMyReaction(
  listingId: string,
): Promise<PropertyReactionRead | null> {
  const res = await api.get<PropertyReactionRead | null>(
    `/property_reactions/me/${listingId}`,
  );
  return res.data ?? null;
}

export async function fetchMyReactions(
  reaction?: PropertyReaction,
): Promise<PropertyReactionRead[]> {
  const res = await api.get<PropertyReactionRead[]>('/property_reactions/me', {
    params: reaction ? { reaction } : undefined,
  });
  return res.data;
}

/** Set or replace. Repeating the current reaction is harmless. */
export async function setMyReaction(
  listingId: string,
  reaction: PropertyReaction,
): Promise<PropertyReactionRead> {
  const res = await api.put<PropertyReactionRead>(
    `/property_reactions/me/${listingId}`,
    { reaction },
  );
  return res.data;
}

/** Clear it. Also the undo for "Not for me". Clearing nothing is a no-op. */
export async function clearMyReaction(listingId: string): Promise<void> {
  await api.delete(`/property_reactions/me/${listingId}`);
}
