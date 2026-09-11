/**
 * Keep a half-filled Home Value form across the sign-in step.
 *
 * Hamed: *"public page and form start open; sign-in at submission,
 * **preserving entered fields**."*
 *
 * React state alone nearly does this — both sign-in methods render in place —
 * but "nearly" is the problem. A Google popup that redirects, a session
 * restore, a tab reload, an accidental back-button: any of those drops the
 * state and the person is looking at an empty form having just typed out their
 * address, their renovations and their timeline. They do not fill it in again.
 *
 * `sessionStorage`, not `localStorage`: this is a draft in progress, not
 * something to greet someone with next week. It ends with the tab.
 *
 * The draft is deliberately **cleared on successful submission**, so a
 * property's details do not sit in browser storage on a shared or public
 * machine any longer than the task needs.
 */

import type { HomeValueRequestBody } from '@/types/homeValue';

const KEY = 'lucy:home-value-draft';

export function saveHomeValueDraft(draft: Partial<HomeValueRequestBody>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable outright — private mode, a permissions
    // policy, a browser told to block site data. The form still works; only
    // the survive-a-reload guarantee is lost, and an error here would be
    // reporting a problem the person cannot act on.
  }
}

export function loadHomeValueDraft(): Partial<HomeValueRequestBody> | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Guard the shape: storage is writable by anything running on this origin,
    // and spreading a non-object into form state would throw during render.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Partial<HomeValueRequestBody>;
  } catch {
    return null;
  }
}

export function clearHomeValueDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}


/**
 * The raw stored string, for `useSyncExternalStore`.
 *
 * A **string**, not the parsed object, because `getSnapshot` must return a
 * referentially stable value: React compares snapshots by identity, and a
 * fresh object from every call sends it into an infinite re-render. Strings
 * compare by value, so an unchanged draft is an unchanged snapshot. The
 * caller parses once with `useMemo`.
 */
export function readHomeValueDraftRaw(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * No-op subscribe.
 *
 * `sessionStorage` is per-tab, so nothing outside this page can change the
 * draft while it is open — the `storage` event fires for *other* tabs, and
 * other tabs have their own session storage. There is genuinely nothing to
 * subscribe to; `useSyncExternalStore` is being used here for its
 * `getServerSnapshot`, which is the only hydration-safe way to read a
 * browser-only value during render.
 */
export function subscribeToHomeValueDraft(): () => void {
  return () => {};
}
