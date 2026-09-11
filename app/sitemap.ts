import type { MetadataRoute } from 'next';
import { RESOURCE_GUIDES, isPrivacyPolicyPublished } from '@/content/siteContent';
import {
  PRIVACY_ROUTE,
  PUBLIC_ROUTES,
  RESOURCES_ROUTE,
  siteUrl,
} from '@/lib/siteUrl';

/**
 * Sitemap. Control 2.12, and deliberately conservative about listings.
 *
 * Static public routes only, for now. Listing detail pages are public and
 * indexable, so they belong in a sitemap eventually — but two things have to be
 * settled first and neither is ours to decide:
 *
 *   1. **Volume.** Sitemaps cap at 50,000 URLs, so a full IDX catalogue needs a
 *      paginated sitemap index, not this file.
 *   2. **Lifecycle.** Control 3.9 requires removed, expired, suspended and
 *      sold/gated records to show "the correct permitted state". A sitemap
 *      naming a listing that has since left the feed invites crawlers to a
 *      dead or gated URL, so it has to be generated from active listings at
 *      request time and revalidated as the feed changes.
 *
 * Building that against a feed whose integration tests cannot currently run
 * (the IDX bearer token is unset outside staging) would be guesswork. Recorded
 * as a known limitation rather than half-built.
 *
 * `PRIVATE_PATH_PREFIXES` is not filtered here because `PUBLIC_ROUTES` is an
 * explicit allow-list — nothing private can appear unless someone adds it
 * deliberately.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();

  /*
   * Two routes are listed only once they have content, for the same reason:
   * pointing a crawler at a page that says "being finalised" indexes a page
   * that answers nothing, under a title promising it does.
   *
   *   `/privacy`   — a notice people search for by name. Appears the moment the
   *                  text arrives.
   *   `/resources` — the client asked (10 Sep 2026) for the section to stay
   *                  hidden until they supply the guides. Nothing in the UI
   *                  links to it, so the sitemap was the last route in, and a
   *                  crawler is exactly who would have found it.
   *
   * Both come back on their own when the content does. Neither needs a flag
   * anyone has to remember to flip.
   */
  const routes = [
    ...PUBLIC_ROUTES,
    ...(isPrivacyPolicyPublished() ? [PRIVACY_ROUTE] : []),
    ...(RESOURCE_GUIDES.length > 0 ? [RESOURCES_ROUTE] : []),
  ];

  return routes.map((route) => ({
    url: `${base}${route.path === '/' ? '' : route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
