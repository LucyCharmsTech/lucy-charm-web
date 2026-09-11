import { render, screen } from '@testing-library/react';
import AboutPage from '@/app/about/page';
import ResourcesPage from '@/app/resources/page';
import { ContentSection } from '@/components/content/ContentSection';
import { AiDisclosure, AI_DISCLOSURE_TEXT } from '@/components/common/AiDisclosure';

/**
 * Plan items 4.3 and 4.4 — the pages, and the AI disclosure.
 */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// ── An unsupplied section renders nothing ────────────────────────────────────

test('an unsupplied block renders no heading, no wrapper, no spacing', () => {
  // Not "Coming soon", not a greyed-out heading. A page announcing a category
  // of information the brokerage does not publish is worse than a shorter one.
  const { container } = render(
    <ContentSection block={{ heading: null, paragraphs: null }} />,
  );
  expect(container.innerHTML).toBe('');
});

test('a heading with no body renders nothing', () => {
  // The half-finished state that ships by accident: someone adds the heading
  // while waiting for the copy.
  const { container } = render(
    <ContentSection block={{ heading: 'Our registration', paragraphs: null }} />,
  );
  expect(container.innerHTML).toBe('');
});

test('a supplied block renders its heading and every paragraph', () => {
  render(
    <ContentSection
      block={{
        heading: 'Our service area',
        paragraphs: ['We work across the GTA.', 'And in Hamilton.'],
      }}
      id="service-area"
    />,
  );
  expect(screen.getByRole('heading', { name: 'Our service area' })).toBeTruthy();
  expect(screen.getByText('We work across the GTA.')).toBeTruthy();
  expect(screen.getByText('And in Hamilton.')).toBeTruthy();
});

// ── The About page today ─────────────────────────────────────────────────────

test('the About page shows the approved brokerage details and no placeholder text', () => {
  render(<AboutPage />);
  const text = document.body.textContent ?? '';

  // The client-approved facts are present.
  expect(text).toContain('Lucy Charms Realty');
  expect(text).toContain('Lucy Charms Inc.');
  expect(text).toMatch(/6026720/);
  expect(text).toMatch(/6027141/);

  // Still nothing that looks like scaffolding or an unfilled template.
  expect(text).not.toMatch(/\bTBC\b|\bTBD\b|lorem ipsum|placeholder/i);
  expect(text).not.toMatch(/\[.*\]/);
});

test('the About page publishes the approved brokerage identity and registration', () => {
  render(<AboutPage />);
  expect(screen.getByRole('heading', { name: /who we are/i })).toBeTruthy();
  expect(screen.getByRole('heading', { name: /registration/i })).toBeTruthy();
  // The "being confirmed" fallback only shows when nothing is published.
  expect(screen.queryByText(/being confirmed/i)).toBeNull();
});

test('the About page carries the AI disclosure even before the fuller explanation arrives', () => {
  // The one thing on the page not waiting on approval: it states what the
  // software is, which is a fact about our own system.
  render(<AboutPage />);
  expect(screen.getByText(new RegExp('Lucy is an AI assistant'))).toBeTruthy();
});

// ── Resources today ──────────────────────────────────────────────────────────

test('the Resources page lists no articles rather than empty stubs', () => {
  // 4.4: "No empty/fabricated articles." Three headings with placeholder
  // bodies is how a site ends up with three indexed pages of nothing.
  const { container } = render(<ResourcesPage />);
  expect(container.querySelector('ul')).toBeNull();
  expect(screen.getByText(/guides are being written/i)).toBeTruthy();
});

test('the Resources page points somewhere useful in the meantime', () => {
  render(<ResourcesPage />);
  expect(screen.getByRole('link', { name: /ask us/i })).toBeTruthy();
  expect(screen.getByRole('link', { name: /ask Lucy/i })).toBeTruthy();
});

// ── The disclosure itself ────────────────────────────────────────────────────

test('the disclosure says what Lucy is and what a human does', () => {
  // "Lucy is an AI assistant" alone tells someone what they are talking to and
  // not what to do about it. The second clause is the useful half — and it
  // describes the boundary the escalation system actually enforces server-side.
  render(<AiDisclosure />);
  const text = screen.getByText(new RegExp('Lucy is an AI assistant')).textContent ?? '';
  expect(text).toMatch(/licensed representative/i);
});

test('the disclosure is not an alert', () => {
  // It is context, not a problem. An alert would interrupt a screen-reader
  // user every time the chat renders.
  render(<AiDisclosure />);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('both variants say exactly the same thing', () => {
  // The difference between them is how much room there is, not what is
  // disclosed — two wordings would drift, and the shorter one would lose the
  // part that matters.
  const inline = render(<AiDisclosure variant="inline" />);
  expect(inline.container.textContent).toContain(AI_DISCLOSURE_TEXT);
  inline.unmount();

  const banner = render(<AiDisclosure variant="banner" />);
  expect(banner.container.textContent).toContain(AI_DISCLOSURE_TEXT);
});

test('the learn-more link is opt-in, so it cannot point at an unpublished section', () => {
  const without = render(<AiDisclosure />);
  expect(without.container.querySelector('a')).toBeNull();
  without.unmount();

  const withLink = render(<AiDisclosure showLearnMore />);
  expect(withLink.container.querySelector('a')?.getAttribute('href')).toBe('/about#ai');
});
