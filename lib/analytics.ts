/**
 * PostHog analytics — the single tracking module (Task 17, reduced scope).
 *
 * Rules encoded here, do not relax them:
 * - Nothing loads or sends until the visitor ACCEPTS the cookie banner.
 * - `autocapture` stays off: we send the deliberate, named events below and
 *   nothing else, so no button text / form content can leak.
 * - Events carry NO PII — anonymous id + event name + safe context (listing id,
 *   city). Names, emails, scores, and chat text never go to PostHog; business
 *   truth stays in our own database.
 * - Every function is a safe no-op without consent, without a key, or on the
 *   server — a tracking failure must never break a product flow.
 */

import posthog from 'posthog-js';

const CONSENT_KEY = 'lucy-analytics-consent';

export type AnalyticsConsent = 'accepted' | 'declined' | null;

/** Audience segment for every event. `visitor` = signed out. */
export type AnalyticsRole = 'visitor' | 'client' | 'agent' | 'superadmin';

let initialized = false;

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
  const value = localStorage.getItem(CONSENT_KEY);
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
  localStorage.setItem(CONSENT_KEY, consent);
  if (consent === 'accepted') initAnalytics();
  consentListeners.forEach((listener) => listener());
}

/** Idempotent. Loads PostHog only with consent + a configured key. */
export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  if (getAnalyticsConsent() !== 'accepted') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: false, // manual — App Router route changes, see trackPageview()
    capture_pageleave: true,
    persistence: 'localStorage',
  });
  initialized = true;
}

/**
 * Fire a named event. Safe no-op without consent/key/init.
 * Audience segment is merged in automatically — call sites never pass it.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    posthog.capture(event, { ...audience, ...properties });
  } catch {
    // Analytics must never break the product.
  }
}

export function trackPageview(path: string): void {
  track('$pageview', { $current_url: window.location.origin + path });
}
