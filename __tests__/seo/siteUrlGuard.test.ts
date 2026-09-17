import { assertSiteUrlConfigured, siteUrl } from '@/lib/siteUrl';

/**
 * The deploy guard on `NEXT_PUBLIC_SITE_URL`.
 *
 * The failure it prevents is silent and expensive: unset, every canonical URL
 * and every sitemap entry points at `http://localhost:3000`, so the site tells
 * search engines the authoritative copy of every page lives on a machine they
 * cannot reach. Nothing errors and nothing looks wrong — which is exactly why
 * it needs a build failure rather than a warning.
 *
 * It is also the classic one-line configuration that gets missed, because it
 * is missed at the moment everybody is busy with a launch and nobody is
 * reading a sitemap.
 */

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

function withEnv(env: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL, ...env } as NodeJS.ProcessEnv;
}

test('a production build with no origin fails', () => {
  withEnv({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: undefined,
    ALLOW_MISSING_SITE_URL: undefined,
  });
  expect(() => assertSiteUrlConfigured()).toThrow(/NEXT_PUBLIC_SITE_URL is not set/);
});

test('the message says what to set and why', () => {
  // A build failure whose message does not say what to do is just a blocked
  // deploy at 2am.
  withEnv({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: undefined,
    ALLOW_MISSING_SITE_URL: undefined,
  });
  try {
    assertSiteUrlConfigured();
    throw new Error('should have thrown');
  } catch (error) {
    const message = (error as Error).message;
    expect(message).toMatch(/sitemap/i);
    expect(message).toMatch(/ALLOW_MISSING_SITE_URL/);
  }
});

test('a real origin passes', () => {
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.lucycharms.ca' });
  expect(() => assertSiteUrlConfigured()).not.toThrow();
});

test('a localhost origin is refused even though it is set', () => {
  // The nastier version of the same failure: it *looks* configured, so nobody
  // looks again.
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' });
  expect(() => assertSiteUrlConfigured()).toThrow(/local address/i);
});

test('an origin with no scheme is refused', () => {
  // A canonical URL without a scheme is not a URL, and `new URL()` would
  // throw somewhere far less informative.
  withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'www.lucycharms.ca' });
  expect(() => assertSiteUrlConfigured()).toThrow(/include the scheme/i);
});

test('development is not blocked', () => {
  // Requiring every developer to own a domain to run the app would be friction
  // with no safety value, and the localhost fallback is correct there.
  withEnv({ NODE_ENV: 'development', NEXT_PUBLIC_SITE_URL: undefined });
  expect(() => assertSiteUrlConfigured()).not.toThrow();
});

test('the local escape hatch works and is explicit', () => {
  // `next build` sets NODE_ENV=production even on a laptop. The opt-out is
  // named so that grepping for it in a deployed environment finds the
  // decision, rather than being a variable that quietly disables a check.
  withEnv({
    NODE_ENV: 'production',
    NEXT_PUBLIC_SITE_URL: undefined,
    ALLOW_MISSING_SITE_URL: 'true',
  });
  expect(() => assertSiteUrlConfigured()).not.toThrow();
});

test('the escape hatch needs exactly "true", not any truthy string', () => {
  // So a stray `ALLOW_MISSING_SITE_URL=1` or `=false` does not silently
  // disable the guard.
  for (const value of ['1', 'false', 'yes', '']) {
    withEnv({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: undefined,
      ALLOW_MISSING_SITE_URL: value,
    });
    expect(() => assertSiteUrlConfigured()).toThrow();
  }
});

test('siteUrl still strips a trailing slash', () => {
  // A canonical of `https://x.com//about` is a different URL to `/about`.
  withEnv({ NEXT_PUBLIC_SITE_URL: 'https://www.lucycharms.ca/' });
  expect(siteUrl()).toBe('https://www.lucycharms.ca');
});
