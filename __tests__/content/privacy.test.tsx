import { render, screen } from '@testing-library/react';
import PrivacyPage from '@/app/privacy/page';
import { PrivacyLink } from '@/components/common/PrivacyLink';
import {
  PRIVACY_CONTENT,
  isPrivacyPolicyPublished,
  isPublished,
} from '@/content/siteContent';

/**
 * The privacy notice — Q6 requires one *"for each consent request"*.
 *
 * There was no such page and nothing for a consent line to point at. These
 * tests cover the two things that are easy to get wrong: publishing an empty
 * page as though it said something, and linking to it before it does.
 */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('the page while no notice is supplied', () => {
  test('no section is published yet', () => {
    // If this fails, content has arrived — good. Confirm it is approved, then
    // update the test to name what is published rather than deleting it.
    for (const [name, block] of Object.entries(PRIVACY_CONTENT)) {
      expect([name, isPublished(block)]).toEqual([name, false]);
    }
  });

  test('it says so honestly, and gives the reader somewhere to go', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/being finalised/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /contact us/i })).toBeTruthy();
  });

  test('it offers the practical routes a privacy notice normally would', () => {
    // Someone arriving here wants one of three things. Saying we will answer
    // directly is honest and useful; saying nothing is neither.
    render(<PrivacyPage />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/what information we hold/i);
    expect(text).toMatch(/correct it/i);
    expect(text).toMatch(/delete it/i);
  });

  test('it makes no claim it cannot back', () => {
    // The page must not invent policy. The single factual statement it does
    // make — that analytics only run on consent — is verifiable in the code.
    render(<PrivacyPage />);
    const text = document.body.textContent ?? '';

    expect(text).toMatch(/do not run any visitor analytics unless you accept/i);
    // No invented retention period, no invented sharing promise.
    for (const invented of [
      /\d+\s*(days|months|years)/i,
      /we never share/i,
      /third part/i,
      /GDPR|PIPEDA/i,
    ]) {
      expect(text).not.toMatch(invented);
    }
  });

  test('no placeholder text reaches the page', () => {
    render(<PrivacyPage />);
    const text = document.body.textContent ?? '';
    for (const placeholder of [/lorem ipsum/i, /\bTBC\b/, /\[.*\]/, /placeholder/i]) {
      expect(text).not.toMatch(placeholder);
    }
  });
});

describe('the link on consent lines', () => {
  test('renders nothing while there is no notice', () => {
    // A link to a page that answers nothing is worse than no link: it implies
    // the answer exists and sends the reader to a dead end.
    expect(isPrivacyPolicyPublished()).toBe(false);
    const { container } = render(<PrivacyLink />);
    expect(container.innerHTML).toBe('');
  });

  test('one published section is enough to make it worth linking', () => {
    // A partial notice is still something a reader can use. Requiring all
    // seven sections would keep the links hidden long after the page became
    // useful.
    const original = PRIVACY_CONTENT.whoWeAre;
    try {
      PRIVACY_CONTENT.whoWeAre = {
        heading: 'Who we are',
        paragraphs: ['Lucy Charms Realty, of somewhere real.'],
      };
      expect(isPrivacyPolicyPublished()).toBe(true);

      render(<PrivacyLink />);
      expect(screen.getByRole('link', { name: /privacy notice/i })).toBeTruthy();
      expect(
        screen.getByRole('link', { name: /privacy notice/i }).getAttribute('href'),
      ).toBe('/privacy');
    } finally {
      PRIVACY_CONTENT.whoWeAre = original;
    }
  });

  test('a published section also renders on the page', () => {
    const original = PRIVACY_CONTENT.retention;
    try {
      PRIVACY_CONTENT.retention = {
        heading: 'How long we keep information',
        paragraphs: ['Contact enquiries are kept for two years.'],
      };
      render(<PrivacyPage />);
      expect(screen.getByRole('heading', { name: /How long we keep/ })).toBeTruthy();
      // And the holding message steps aside once there is real content.
      expect(screen.queryByText(/being finalised/i)).toBeNull();
    } finally {
      PRIVACY_CONTENT.retention = original;
    }
  });
});
