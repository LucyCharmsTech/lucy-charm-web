/** Consent-gated Section 13 browser identity and landing attribution helpers. */

import api from '@/lib/axios';
import { analyticsRouteFamily } from '@/lib/analyticsRoutes';

const ANALYTICS_ANONYMOUS_HEADER = 'X-Analytics-Anonymous-Id';
const ANALYTICS_ID_KEY = 'lucy-analytics-anonymous-id';
const PENDING_LINK_KEY = 'lucy-analytics-pending-link-id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rejectedAnalyticsIds = new Set<string>();
let pendingLinkId: string | null = null;

function storedOrCreateAnalyticsId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = localStorage.getItem(ANALYTICS_ID_KEY);
    if (existing && rejectedAnalyticsIds.has(existing)) return null;
    if (existing && UUID.test(existing)) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(ANALYTICS_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}

export function getOrCreateAnalyticsAnonymousId(): string | null {
  const anonymousId = storedOrCreateAnalyticsId();
  if (!anonymousId || anonymousId === pendingLinkId) return null;
  try {
    return localStorage.getItem(PENDING_LINK_KEY) === anonymousId ? null : anonymousId;
  } catch {
    return null;
  }
}

type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer_domain?: string;
  landing_path?: string;
};

function safeValue(value: string | null): string | undefined {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._ -]{0,79}$/.test(normalized)) return undefined;
  if (/@|(?:bearer\s+|basic\s+|token|code=|key=|eyJ[A-Za-z0-9_-]+\.)/i.test(normalized)) return undefined;
  return normalized;
}

function landingAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  const url = new URL(window.location.href);
  const attribution: Attribution = {
    utm_source: safeValue(url.searchParams.get('utm_source')),
    utm_medium: safeValue(url.searchParams.get('utm_medium')),
    utm_campaign: safeValue(url.searchParams.get('utm_campaign')),
    landing_path: analyticsRouteFamily(url.pathname) ?? undefined,
  };
  try {
    if (document.referrer) {
      const hostname = new URL(document.referrer).hostname.toLowerCase().replace(/\.$/, '');
      if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
        attribution.referrer_domain = hostname;
      }
    }
  } catch {
    // Referrer parsing is optional and never blocks the page.
  }
  return Object.fromEntries(Object.entries(attribution).filter(([, value]) => value)) as Attribution;
}

/** Register a dedicated analytics UUID, never the chat/saves bearer token. */
export async function registerAnalyticsAnonymousIdentity(): Promise<string | null> {
  const anonymousId = getOrCreateAnalyticsAnonymousId();
  if (!anonymousId) return null;
  try {
    await api.post('/analytics/anonymous-identities', { anonymous_id: anonymousId });
    await api.put('/analytics/anonymous-identities/attribution', {
      anonymous_id: anonymousId,
      ...landingAttribution(),
    });
    return anonymousId;
  } catch {
    return null;
  }
}

/** Link only a registered UUID after the normal authenticated session is seated. */
export async function linkAnalyticsAnonymousIdentity(): Promise<void> {
  const anonymousId = storedOrCreateAnalyticsId();
  if (!anonymousId) return;
  pendingLinkId = anonymousId;
  try {
    localStorage.setItem(PENDING_LINK_KEY, anonymousId);
  } catch {
    try { localStorage.removeItem(ANALYTICS_ID_KEY); } catch { /* In-memory guard remains. */ }
    return;
  }
  try {
    await api.post('/analytics/anonymous-identities', { anonymous_id: anonymousId });
  } catch {
    return; // Registration outage is not evidence of an identity conflict.
  }
  try {
    await api.post('/analytics/identity-links', { anonymous_id: anonymousId });
  } catch (error) {
    if (!isIdentityConflict(error)) return; // Outages do not imply another account owns the UUID.
    rejectedAnalyticsIds.add(anonymousId);
    let replacement: string | null = null;
    try {
      localStorage.removeItem(ANALYTICS_ID_KEY);
      replacement = crypto.randomUUID();
      localStorage.setItem(PENDING_LINK_KEY, replacement);
      localStorage.setItem(ANALYTICS_ID_KEY, replacement);
      pendingLinkId = replacement;
      await api.post('/analytics/anonymous-identities', { anonymous_id: replacement });
      await api.post('/analytics/identity-links', { anonymous_id: replacement });
      clearPendingLink(replacement);
      await saveLandingAttribution(replacement);
    } catch (replacementError) {
      if (replacement && isIdentityConflict(replacementError)) rejectedAnalyticsIds.add(replacement);
      // One replacement attempt only. Never reuse the known-conflicted UUID.
    }
    return;
  }
  clearPendingLink(anonymousId);
  try { await saveLandingAttribution(anonymousId); } catch { /* Optional context only. */ }
}

function clearPendingLink(anonymousId: string): void {
  try {
    if (localStorage.getItem(PENDING_LINK_KEY) === anonymousId) localStorage.removeItem(PENDING_LINK_KEY);
    if (pendingLinkId === anonymousId) pendingLinkId = null;
  } catch {
    // A failed clear suppresses optional telemetry instead of risking wrong attribution.
  }
}

function isIdentityConflict(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { detail?: { code?: string } } } } | null)?.response;
  return response?.status === 403 && response.data?.detail?.code === 'analytics_identity_conflict';
}

async function saveLandingAttribution(anonymousId: string): Promise<void> {
  await api.put('/analytics/anonymous-identities/attribution', {
    anonymous_id: anonymousId,
    ...landingAttribution(),
  });
}

/** Attach only the registered opaque UUID to authoritative conversion requests. */
export function analyticsAttributionHeaders(consented: boolean): Record<string, string> {
  if (!consented) return {};
  const anonymousId = getOrCreateAnalyticsAnonymousId();
  return anonymousId ? { [ANALYTICS_ANONYMOUS_HEADER]: anonymousId } : {};
}
