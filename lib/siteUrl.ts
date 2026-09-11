/**
 * The site's own public origin, and the one list of what must not be indexed.
 *
 * Both are here rather than inline so `robots.ts`, `sitemap.ts` and the root
 * `metadata` read the same values. A canonical URL on one origin and a sitemap
 * on another is a common and quietly damaging mistake.
 */

/**
 * Public origin, no trailing slash.
 *
 * Falls back to localhost so a developer build has a valid `metadataBase`
 * rather than throwing — Next.js requires an absolute base to resolve
 * canonical URLs. The real value belongs in `NEXT_PUBLIC_SITE_URL`; Hamed
 * supplies the production domain (A3/A5 assign domain control to Lucy).
 *
 * **A production build with this unset fails, deliberately.** See
 * `assertSiteUrlConfigured` below — the fallback is a development convenience
 * and a production hazard, and the two need different behaviour.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Refuse to build for production without a real origin.
 *
 * The failure this prevents is silent and expensive. Unset, every canonical
 * URL and every entry in the sitemap points at `http://localhost:3000` —
 * so the site tells search engines that the authoritative copy of every page
 * lives on a machine they cannot reach. Nothing errors, nothing looks wrong,
 * and the whole of the search-engine work is undone.
 *
 * It is also exactly the kind of one-line configuration that gets missed,
 * because it is missed at the moment everybody is busy with a launch and
 * nobody is reading a sitemap.
 *
 * So the build stops instead. A build that fails with a clear message costs
 * five minutes; the alternative costs however long it takes someone to
 * notice, which for canonical URLs can be months.
 *
 * Deliberately **not** enforced in development or test: requiring every
 * developer to set a domain to run the app locally would be friction with no
 * safety value, and the localhost fallback is correct there.
 */
export function assertSiteUrlConfigured(): void {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (process.env.NODE_ENV !== 'production') return;

  /*
   * The opt-out excuses a **missing** value and nothing else.
   *
   * It sat above these checks at first, which meant it also excused a *bad*
   * one — `NEXT_PUBLIC_SITE_URL=localhost` in a deployed environment would
   * have passed. That is the worse failure of the two, because it looks
   * configured, and a variable named "allow missing" has no business
   * permitting it.
   */
  const missingIsAllowed = process.env.ALLOW_MISSING_SITE_URL === 'true';

  if (!configured) {
    if (missingIsAllowed) return;
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is not set.\n\n' +
        'A production build needs the real public origin (e.g. ' +
        'https://lucycharms.com). Without it, every canonical URL and the ' +
        'whole sitemap point at http://localhost:3000, which tells search ' +
        'engines the authoritative copy of every page is on a machine they ' +
        'cannot reach.\n\n' +
        'Set it in the deployment environment. For a preview build with no ' +
        'stable domain, set ALLOW_MISSING_SITE_URL=true instead.',
    );
  }

  if (!/^https?:\/\//.test(configured)) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL must include the scheme — got ${configured}. ` +
        'Use https://www.example.com, not www.example.com: a canonical URL ' +
        'without a scheme is not a URL.',
    );
  }

  if (configured.includes('localhost') || configured.includes('127.0.0.1')) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL is set to ${configured}, which is a local ` +
        'address. This is the failure the check exists to catch — it looks ' +
        'configured, so nobody looks again.',
    );
  }
}

/**
 * Path prefixes that must never be indexed or listed in the sitemap.
 *
 * Everything here is either a signed-in surface, a staff surface, or a URL
 * that carries a token. Control 2.12: "Do not expose private portal content."
 *
 * `/unsubscribe` is on the list because its URL *is* a credential — indexing
 * one would publish a working unsubscribe link for a real recipient. The page
 * also carries its own `robots: index false`, so it is covered twice on
 * purpose.
 */
export const PRIVATE_PATH_PREFIXES = [
  '/admin',
  '/agent',
  '/profile',
  '/documents',
  '/notifications',
  '/seller-portal',
  '/onboarding',
  '/auth',
  '/account-recovery',
  '/account-status',
  '/unsubscribe',
  // Two-step verification setup — the page a signed-in staff member uses to
  // enrol. Nothing on it is public, and the QR it renders is a live secret.
  '/security',
  '/saved',
  '/api',
] as const;

/**
 * Public routes, for the sitemap.
 *
 * Deliberately a hand-maintained list rather than a filesystem crawl: a new
 * route should be a decision to publish, not an accident of where a file
 * landed. `changeFrequency` and `priority` are hints only — search engines
 * treat them as such — so they are kept plausible rather than precise.
 */
export const PUBLIC_ROUTES: ReadonlyArray<{
  path: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1.0 },
  { path: '/listings', changeFrequency: 'daily', priority: 0.9 },
  { path: '/sell', changeFrequency: 'monthly', priority: 0.8 },
  // Public per Hamed's spec — "public page and form start open". A
  // service the brokerage offers, so someone searching for it should find
  // it; the report it produces lives behind sign-in.
  { path: '/home-value', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
  // Public, and in the sitemap even while its sections are unpublished:
  // the page states honestly that details are being confirmed rather than
  // inventing any, and an About page is the first thing anyone checking a
  // brokerage looks for.
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/chat', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/login', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/register', changeFrequency: 'monthly', priority: 0.3 },
];

/**
 * The privacy notice route.
 *
 * Kept out of `PUBLIC_ROUTES` deliberately: `sitemap.ts` adds it only once the
 * notice has content, so an empty page is never offered to a crawler under a
 * title that promises an answer. See `isPrivacyPolicyPublished`.
 */
export const PRIVACY_ROUTE = {
  path: '/privacy',
  changeFrequency: 'monthly',
  priority: 0.4,
} as const;

/**
 * The Resources route.
 *
 * Out of `PUBLIC_ROUTES` for the same reason as `PRIVACY_ROUTE`, and now also
 * on the client's explicit instruction (10 September 2026): *"Please keep the
 * Resources section hidden until we provide them."* Nothing in the UI links to
 * it, so listing it in the sitemap was the one remaining way anyone could find
 * it — a crawler indexing a page that says the guides are still being written.
 *
 * `sitemap.ts` adds it back automatically the moment `RESOURCE_GUIDES` is
 * non-empty, so publishing the guides is the only action needed; there is no
 * separate flag to remember to flip.
 */
export const RESOURCES_ROUTE = {
  path: '/resources',
  changeFrequency: 'monthly',
  priority: 0.5,
} as const;
