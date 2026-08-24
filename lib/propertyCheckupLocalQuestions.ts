/**
 * Signed-out "Save question" storage — Property Checkup Clarifications
 * Part 1 §7: "If signed out, save it locally/on-device without forcing
 * sign-in... merge/sync the locally saved question into the user's account
 * and retain its property association" on sign-in.
 *
 * Mirrors the pattern `services/sellerJourneyService.ts` uses for resuming a
 * journey on sign-in — a per-page `useEffect` keyed on `accessToken`, not a
 * global hook — rather than an anonymous session token, because this data
 * never needs a server-side anonymous identity: it is either purely local, or
 * (once synced) belongs to a real account.
 *
 * This is a personal bookmark only (Clarifications Part 2 §7 — "it does not
 * save the whole Property Checkup"), distinct from "Add to showing
 * questions." It is never surfaced in the Request Showing flow.
 */

import { addPropertyCheckupQuestion } from '@/services/propertyCheckupService';

const STORAGE_KEY = 'lucy-property-checkup-local-questions';

type LocalQuestion = {
  listingId: string;
  sourceRuleId: string;
};

function readAll(): LocalQuestion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: LocalQuestion[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked — the save simply doesn't persist across a
    // reload. Nothing here should throw and break the button.
  }
}

export function isQuestionSavedLocally(listingId: string, sourceRuleId: string): boolean {
  return readAll().some(
    (q) => q.listingId === listingId && q.sourceRuleId === sourceRuleId,
  );
}

export function saveQuestionLocally(listingId: string, sourceRuleId: string): void {
  if (isQuestionSavedLocally(listingId, sourceRuleId)) return;
  writeAll([...readAll(), { listingId, sourceRuleId }]);
}

/** Undo a signed-out local save — the panel's own "unsave" toggle. */
export function removeQuestionLocally(listingId: string, sourceRuleId: string): void {
  writeAll(
    readAll().filter((q) => !(q.listingId === listingId && q.sourceRuleId === sourceRuleId)),
  );
}

/**
 * Push every locally-saved question to the account, then clear local
 * storage. Safe to call more than once — `addPropertyCheckupQuestion` is
 * idempotent per (user, listing, rule) on the backend, so a retry after a
 * partial failure cannot create duplicates.
 */
export async function syncLocalQuestionsToAccount(): Promise<void> {
  const pending = readAll();
  if (pending.length === 0) return;

  const results = await Promise.allSettled(
    pending.map((q) =>
      addPropertyCheckupQuestion({
        listing_id: q.listingId,
        source_rule_id: q.sourceRuleId,
        kind: 'saved',
      }),
    ),
  );

  // Keep only the ones that failed to sync — a transient error should not
  // silently drop a buyer's saved question.
  const stillPending = pending.filter((_, i) => results[i].status === 'rejected');
  writeAll(stillPending);
}
