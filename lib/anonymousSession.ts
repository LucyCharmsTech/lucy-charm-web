/**
 * Stable anonymous visitor id for saved listings and CRM lead correlation.
 * Stored in localStorage until the user clears site data.
 */

const STORAGE_KEY = 'lucy-anonymous-session-token';

/** Minimum length enforced by the API for anonymous session_token. */
const MIN_LEN = 20;

/**
 * Returns an existing token or creates a new random one (UUID v4, 36 chars).
 */
export function getOrCreateAnonymousSessionToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  let token = (localStorage.getItem(STORAGE_KEY) || '').trim();
  if (token.length < MIN_LEN) {
    token = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}
