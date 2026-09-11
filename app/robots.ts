import type { MetadataRoute } from 'next';
import { PRIVATE_PATH_PREFIXES, siteUrl } from '@/lib/siteUrl';

/**
 * Crawler controls. Control 2.12: "crawlable content, unique metadata,
 * canonical URLs, sitemap, robots controls and accurate structured data.
 * **Do not expose private portal content.**"
 *
 * The disallow list is `PRIVATE_PATH_PREFIXES`, shared with `sitemap.ts` so the
 * two can never disagree about what is private — a path excluded from the
 * sitemap but crawlable, or vice versa, is the failure this shares one list to
 * avoid.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATH_PREFIXES.map((prefix) => `${prefix}/`),
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
