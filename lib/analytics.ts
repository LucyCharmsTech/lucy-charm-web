/**
 * PostHog analytics — the single tracking module (Task 17, reduced scope).
 *
 * Rules encoded here, do not relax them:
 * - Nothing loads or sends until the visitor ACCEPTS the cookie banner. This
 *   includes the `posthog-js` bytes themselves: they are dynamically
 *   imported inside `initAnalytics()`, never statically, so a visitor who
 *   never accepts never downloads the SDK.
 * - `autocapture` stays off: we send the deliberate, named events below and
 *   nothing else, so no button text / form content can leak.
 * - Events carry NO PII — anonymous id + event name + safe context (listing id,
 *   city). Names, emails, scores, and chat text never go to PostHog; business
 *   truth stays in our own database.
 * - Every function is a safe no-op without consent, without a key, or on the
 *   server — a tracking failure must never break a product flow. This also
 *   covers storage: a browser with blocked/full localStorage must not throw
 *   out of the consent banner.
 */

import type { PostHog } from 'posthog-js';

const CONSENT_KEY = 'lucy-analytics-consent';

/** Loaded lazily by `initAnalytics()`; `track()` is a no-op until it lands. */
let posthogInstance: PostHog | null = null;

/** Never throw out of a storage read — a locked-down browser reads as "no consent yet." */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Never throw out of a storage write — consent still applies for this session even if it can't persist. */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked or full. The in-memory choice for this page load still
    // stands; it just won't survive a reload.
  }
}

export type AnalyticsConsent = 'accepted' | 'declined' | null;

/** Audience segment for every event. `visitor` = signed out. */
export type AnalyticsRole = 'visitor' | 'client' | 'agent' | 'superadmin';

let initialized = false;

/** Memoised in-flight SDK load, so overlapping callers init exactly once. */
let initPromise: Promise<void> | null = null;

/**
 * Attached to every event so PostHog can answer "signed-in versus not" and so
 * staff browsing can be filtered out of visitor numbers.
 *
 * Deliberately NOT an identity: no user id, email, or name is ever sent, and
 * we never call `posthog.identify()`. These are coarse segments only, which
 * keeps the promise that nothing leaving the app can be traced to a person.
 */
let audience: { is_authenticated: boolean; user_role: AnalyticsRole } = {
  is_authenticated: false,
  user_role: 'visitor',
};

/** Call on login, logout, and session hydration. */
export function setAnalyticsAudience(role: AnalyticsRole | null): void {
  audience = {
    is_authenticated: role != null && role !== 'visitor',
    user_role: role ?? 'visitor',
  };
}

export function getAnalyticsAudience(): {
  is_authenticated: boolean;
  user_role: AnalyticsRole;
} {
  return audience;
}

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null;
  const value = safeGetItem(CONSENT_KEY);
  return value === 'accepted' || value === 'declined' ? value : null;
}

/**
 * Consent as an external store so the banner can read it with
 * `useSyncExternalStore` — no setState-in-effect and no hydration mismatch
 * (the server snapshot is `'unknown'`, so nothing renders while prerendering).
 */
const consentListeners = new Set<() => void>();

export function subscribeToConsent(listener: () => void): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

export function getConsentSnapshot(): AnalyticsConsent {
  return getAnalyticsConsent();
}

export function getConsentServerSnapshot(): 'unknown' {
  return 'unknown';
}

export function setAnalyticsConsent(consent: 'accepted' | 'declined'): void {
  if (typeof window === 'undefined') return;
  safeSetItem(CONSENT_KEY, consent);
  if (consent === 'accepted') void initAnalytics();
  consentListeners.forEach((listener) => listener());
}

/**
 * Idempotent. Dynamically imports and loads PostHog only with consent + a
 * configured key — a visitor who never accepts never downloads the SDK.
 *
 * The in-flight load is memoised, so the two callers that can legitimately
 * overlap (the banner's accept handler and the Providers effect) load and
 * init the SDK exactly once between them.
 */
export function initAnalytics(): Promise<void> {
  if (initialized || typeof window === 'undefined') return Promise.resolve();
  if (getAnalyticsConsent() !== 'accepted') return Promise.resolve();
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return Promise.resolve();

  initPromise ??= loadAndInit(key);
  return initPromise;
}

async function loadAndInit(key: string): Promise<void> {
  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false, // manual — App Router route changes, see trackPageview()
      capture_pageleave: true,
      persistence: 'localStorage',
    });
    posthogInstance = posthog;
    initialized = true;
  } catch {
    // Analytics must never break the product — the SDK failing to load or
    // init just means tracking stays off. Clear the memo so a later call
    // (e.g. the next route change) can retry a transient chunk failure.
    initPromise = null;
  }
}

/**
 * Fire a named event. Safe no-op without consent/key/init.
 * Audience segment is merged in automatically and last, so a call-site
 * property can never overwrite it — call sites never pass it themselves.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized || !posthogInstance) return;
  try {
    posthogInstance.capture(event, { ...properties, ...audience });
  } catch {
    // Analytics must never break the product.
  }
}

export function trackPageview(path: string): void {
  track('$pageview', { $current_url: window.location.origin + path });
}
