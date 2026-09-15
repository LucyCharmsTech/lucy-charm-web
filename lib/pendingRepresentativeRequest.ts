/**
 * Survives exactly one navigation: "Ask a Lucy representative" while signed
 * out opens the chat widget's login gate, which links to a real /login (or
 * /register) route — a full page navigation that unmounts the listing page
 * and everything in its React context, including the pending request.
 *
 * Persisted here at the moment of the click, and consumed once on the next
 * mount of the listing's chat provider. One-shot by design: this is not a
 * general durability layer, just enough to survive the login round-trip.
 */

const STORAGE_KEY = 'lucy-pending-representative-request';

type StoredRequest = {
  listingId: string;
  ruleId: string;
  message: string;
};

export function savePendingRepresentativeRequest(
  listingId: string,
  ruleId: string,
  message: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredRequest = { listingId, ruleId, message };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Non-fatal — the in-memory context still handles the same-session case.
  }
}

/** Reads and immediately clears the stored request — one-shot, so a stale
 * or already-handled entry can never resurrect itself on a later visit. */
export function consumePendingRepresentativeRequest(
  listingId: string,
): { ruleId: string; message: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRequest>;
    // Only remove on an actual match — a stray visit to a different listing
    // while one is still pending elsewhere must not destroy it. The storage
    // slot holds at most one pending request app-wide, matching the single
    // in-memory `pendingRepresentativeRequest` this restores into.
    if (parsed.listingId !== listingId || !parsed.ruleId || !parsed.message) return null;
    localStorage.removeItem(STORAGE_KEY);
    return { ruleId: parsed.ruleId, message: parsed.message };
  } catch {
    return null;
  }
}

export function clearPendingRepresentativeRequest(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-fatal.
  }
}
