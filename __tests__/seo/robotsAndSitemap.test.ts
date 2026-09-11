import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { PRIVATE_PATH_PREFIXES, PUBLIC_ROUTES, siteUrl } from '@/lib/siteUrl';

/**
 * Control 2.12: "crawlable content, unique metadata, canonical URLs, sitemap,
 * robots controls and accurate structured data. **Do not expose private portal
 * content.**"
 *
 * That last clause is the one worth a test. The risk is not a missing sitemap;
 * it is a portal path quietly becoming crawlable, which no one notices until it
 * is indexed.
 */

describe('robots', () => {
  it('disallows every private prefix', () => {
    const rule = robots().rules;
    const disallow = Array.isArray(rule) ? rule[0].disallow : rule.disallow;
    const disallowed = (disallow as string[]) ?? [];

    for (const prefix of PRIVATE_PATH_PREFIXES) {
      expect(disallowed).toContain(`${prefix}/`);
    }
  });

  it('still allows the public site', () => {
    const rule = robots().rules;
    const allow = Array.isArray(rule) ? rule[0].allow : rule.allow;
    expect(allow).toBe('/');
  });

  it('points at the sitemap on the same origin as the canonical base', () => {
    // A canonical URL on one origin and a sitemap on another is a common and
    // quietly damaging mistake — hence one shared `siteUrl()`.
    expect(robots().sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});

describe('sitemap', () => {
  it('lists no private path', () => {
    const urls = sitemap().map((entry) => entry.url);

    for (const url of urls) {
      const path = new URL(url).pathname;
      for (const prefix of PRIVATE_PATH_PREFIXES) {
        expect(path.startsWith(prefix)).toBe(false);
      }
    }
  });

  it('never lists the unsubscribe page, whose URL is itself a credential', () => {
    // Indexing one would publish a working unsubscribe link for a real person.
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).not.toContain('/unsubscribe');
  });

  it('lists every declared public route exactly once, absolute', () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toHaveLength(PUBLIC_ROUTES.length);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith(siteUrl())).toBe(true);
    }
  });

  it('gives the homepage a bare origin, not a trailing slash', () => {
    // `${base}/` and `${base}` are two URLs to a crawler; the canonical in the
    // root layout resolves to the bare origin, so the sitemap must match.
    expect(sitemap()[0].url).toBe(siteUrl());
  });

  it('carries a lastModified on every entry', () => {
    for (const entry of sitemap()) {
      expect(entry.lastModified).toBeDefined();
    }
  });
});

describe('siteUrl', () => {
  it('has no trailing slash, so joins never double up', () => {
    expect(siteUrl().endsWith('/')).toBe(false);
  });
});

// ── Unpublished sections stay out of the sitemap ─────────────────────────────

/**
 * The client asked on 10 September 2026 to keep the Resources section hidden
 * until they supply the guide content. Nothing in the UI links to `/resources`,
 * so the sitemap was the only remaining way to reach it — which meant a crawler
 * could index a page saying the guides were still being written.
 *
 * These pin the rule in both directions, because the failure that matters is
 * the second one: the route never coming back once the content lands.
 */
describe('/resources appears in the sitemap only when guides exist', () => {
  const loadSitemap = async (guides: unknown[]) => {
    jest.resetModules();
    jest.doMock('@/content/siteContent', () => ({
      ...jest.requireActual('@/content/siteContent'),
      RESOURCE_GUIDES: guides,
    }));
    const mod = await import('@/app/sitemap');
    return mod.default();
  };

  afterEach(() => {
    jest.dontMock('@/content/siteContent');
    jest.resetModules();
  });

  test('absent while there are no guides', async () => {
    const urls = (await loadSitemap([])).map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith('/resources'))).toBe(false);
  });

  test('present once a guide is published', async () => {
    const urls = (
      await loadSitemap([
        {
          slug: 'buying-your-first-home',
          title: 'Buying your first home',
          summary: 'What to expect.',
          body: '# Buying',
          publishedAt: '2026-09-10',
        },
      ])
    ).map((entry) => entry.url);
    expect(urls.some((url) => url.endsWith('/resources'))).toBe(true);
  });
});
