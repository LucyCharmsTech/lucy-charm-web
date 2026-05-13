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
 * Fetches `path` from the backend API and returns the parsed JSON body, or
 * `null` when the request fails (network error, non-2xx status).  Never
 * throws — callers should handle the null case gracefully.
 */
export async function serverFetch<T>(
  path: string,
  { revalidate = 60, ...init }: FetchOptions = {},
): Promise<T | null> {
  try {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      next: { revalidate },
      ...init,
    });

    if (!res.ok) {
      console.warn(`[serverFetch] ${res.status} ${res.statusText} — ${url}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.warn('[serverFetch] network error:', err);
    return null;
  }
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
