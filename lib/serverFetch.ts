/**
 * Lightweight server-side fetch wrapper for Next.js Server Components.
 * Axios is browser-only (uses localStorage for tokens); server components must
 * use native fetch instead.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

type FetchOptions = RequestInit & {
  /** ISR revalidation interval in seconds.  Defaults to 60. */
  revalidate?: number;
};

/**
 * The outcome of a server-side fetch.
 *
 * `not_found` and `error` are kept apart deliberately. Collapsing both to null
 * meant the detail page called `notFound()` for a perfectly live listing
 * whenever the API was restarting — telling the visitor, and any crawler
 * reading the 404, that a real property had been removed. "We could not reach
 * the server" and "this does not exist" are different sentences and the page
 * has to be able to say the right one.
 */
export type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: 'not_found' | 'error' };

/**
 * Fetches `path` from the backend API. Never throws — the result says what
 * happened, and callers decide what each outcome means for their page.
 */
export async function serverFetchResult<T>(
  path: string,
  { revalidate = 60, ...init }: FetchOptions = {},
): Promise<FetchResult<T>> {
  const url = `${API_BASE}${path}`;
  let res: Response;

  try {
    res = await fetch(url, { next: { revalidate }, ...init });
  } catch (err) {
    console.warn('[serverFetch] network error:', err);
    return { ok: false, kind: 'error' };
  }

  if (res.status === 404 || res.status === 410) {
    return { ok: false, kind: 'not_found' };
  }
  if (!res.ok) {
    console.warn(`[serverFetch] ${res.status} ${res.statusText} — ${url}`);
    return { ok: false, kind: 'error' };
  }

  try {
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    // A 200 whose body will not parse is a broken server, not a missing row.
    console.warn('[serverFetch] unparseable body:', err);
    return { ok: false, kind: 'error' };
  }
}

/**
 * `serverFetchResult` for callers that genuinely cannot act on the difference —
 * a marketing strip that renders nothing either way. Do not reach for this on a
 * page whose whole content is the fetched resource.
 */
export async function serverFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T | null> {
  const result = await serverFetchResult<T>(path, options);
  return result.ok ? result.data : null;
}

/** Builds a URL-encoded query string from a plain object (omits null/undefined). */
export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/** Returns true if `str` looks like a UUID v4 (8-4-4-4-12 hex). */
export function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str,
  );
}
