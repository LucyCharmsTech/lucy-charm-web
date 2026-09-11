import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import Footer from '@/components/Footer';
import SiteFooter from '@/components/SiteFooter';
import { NAV_LINKS } from '@/components/NavBar';

/**
 * A page nothing links to is, for disclosure purposes, not published.
 *
 * `/about` carries the RECO brokerage and branch registration numbers the
 * client sent specifically so they could be displayed. It shipped orphaned —
 * reachable only by typing the URL — and `/contact` was reachable only from the
 * mobile menu, so desktop visitors had no link to either. These tests exist so
 * that regressing to that state fails the build instead of going unnoticed for
 * another few weeks.
 */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const mockPathname = jest.fn<string, []>();
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// ── The disclosure pages are linked ──────────────────────────────────────────

describe.each([
  ['/about', 'About'],
  ['/contact', 'Contact'],
])('%s is reachable', (href, label) => {
  test(`the footer links to it as "${label}"`, () => {
    mockPathname.mockReturnValue('/');
    render(<Footer />);

    const link = screen.getByRole('link', { name: label });
    expect(link.getAttribute('href')).toBe(href);
  });
});

test('the footer links to the privacy policy', () => {
  // Privacy lives in the footer only, next to the disclosure block, rather than
  // competing for space in the primary nav.
  render(<Footer />);
  expect(
    screen.getByRole('link', { name: 'Privacy policy' }).getAttribute('href'),
  ).toBe('/privacy');
});

test('the footer publishes both office addresses', () => {
  // Client-supplied and approved for display. The footer redesign moved these
  // into a Contact column; losing one in a future restyle would drop approved
  // disclosure, so both are pinned by street address.
  render(<Footer />);
  expect(screen.getByText(/140 Yonge Street, Unit 228/)).not.toBeNull();
  expect(screen.getByText(/222 Queen Street, Unit 1045/)).not.toBeNull();
});

test('the footer names the legal entity behind the trading name', () => {
  render(<Footer />);
  expect(screen.getByText(/registered\s+brokerage name of Lucy Charms Inc\./))
    .not.toBeNull();
});

test('the footer publishes the brokerage registration numbers', () => {
  // The reason /about matters. If this disappears from the footer, the numbers
  // exist on exactly one orphaned page again.
  render(<Footer />);
  expect(screen.getByText(/RECO brokerage #/)).not.toBeNull();
});

// ── The top nav ──────────────────────────────────────────────────────────────

describe.each([
  ['/about', 'About'],
  ['/contact', 'Contact'],
])('the top nav includes %s', (href, label) => {
  test(`"${label}" is in NAV_LINKS`, () => {
    // The desktop nav and the mobile menu both map this one array, so an entry
    // here is reachable on every viewport. `/contact` used to be hardcoded into
    // the mobile block only, which is how desktop lost it.
    expect(NAV_LINKS).toEqual(expect.arrayContaining([{ label, href }]));
  });
});

test('no nav entry is duplicated', () => {
  // Contact was briefly in NAV_LINKS *and* hardcoded in the mobile menu, which
  // rendered it twice on small screens.
  const hrefs = NAV_LINKS.map((link) => link.href);
  expect(hrefs).toEqual([...new Set(hrefs)]);
});

// ── The signed-in security page ──────────────────────────────────────────────

describe('/security is reachable on purpose, not only by force', () => {
  /*
   * The page existed and worked, but the only route to it was involuntary: the
   * axios interceptor redirects there when the API demands enrolment. Nothing
   * let a person choose to go, which stranded a client wanting to turn two-step
   * verification on (optional for them, and honoured by the policy) and anyone
   * wanting to see or regenerate recovery codes.
   *
   * Asserted against the source rather than a render, because NavBar needs four
   * stores and a router mocked to render and that scaffolding would test the
   * mocks more than the link.
   */
  const navBarSource = readFileSync(
    join(process.cwd(), 'components/NavBar.tsx'),
    'utf8',
  );

  test('both the desktop dropdown and the mobile menu link to it', () => {
    const links = navBarSource.match(/href="\/security"/g) ?? [];
    expect(links).toHaveLength(2);
  });

  test('it stays out of the public nav', () => {
    // Signed-in only. It renders a live TOTP secret, so it does not belong
    // beside Buy and Sell.
    const navLinks = navBarSource.match(/const NAV_LINKS = \[(.*?)\];/s)?.[1] ?? '';
    expect(navLinks).not.toContain('/security');
  });

  test('it stays out of the footer', () => {
    render(<Footer />);
    expect(screen.queryByRole('link', { name: /security/i })).toBeNull();
  });
});

// ── Where the footer appears ─────────────────────────────────────────────────

describe('the footer is site-wide but not in the consoles', () => {
  test.each([
    '/',
    '/listings',
    '/about',
    '/contact',
    '/privacy',
    '/login',
    // Keeps the site nav, so it keeps the footer — same rule as NavBar.
    '/seller-portal',
    '/seller-portal/abc-123',
  ])('renders on %s', (pathname) => {
    mockPathname.mockReturnValue(pathname);
    const { container } = render(<SiteFooter />);
    expect(container.querySelector('footer')).not.toBeNull();
  });

  test.each(['/admin', '/admin/staff', '/agent', '/agent/showings'])(
    'is suppressed on %s',
    (pathname) => {
      // Working surfaces with their own chrome. Exactly the routes where NavBar
      // also returns null.
      mockPathname.mockReturnValue(pathname);
      const { container } = render(<SiteFooter />);
      expect(container.querySelector('footer')).toBeNull();
    },
  );

  test('a route that merely starts with a console name still gets the footer', () => {
    // `startsWith('/agent')` alone would swallow this. The boundary check is
    // what keeps the suppression scoped to the console and its children.
    mockPathname.mockReturnValue('/agents-directory');
    const { container } = render(<SiteFooter />);
    expect(container.querySelector('footer')).not.toBeNull();
  });
});
