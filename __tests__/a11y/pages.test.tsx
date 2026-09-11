import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import AboutPage from '@/app/about/page';
import ResourcesPage from '@/app/resources/page';
import { ContactForm } from '@/components/contact/ContactForm';
import { EmailCodeAuthForm } from '@/components/auth/EmailCodeAuthForm';
import { HomeValueForm } from '@/components/homeValue/HomeValueForm';
import { MfaEnrolment } from '@/components/security/MfaEnrolment';

/**
 * WCAG 2.2 AA on the whole surfaces — plan item 4.7.
 *
 * Component-level checks miss the failures that only exist in composition: two
 * `id`s colliding, a heading level skipped between sections, a landmark
 * nested inside another. These render the real pages.
 */

expect.extend(toHaveNoViolations);

const AXE_OPTIONS = {
  // jsdom has no layout engine, so contrast cannot be computed here and axe
  // returns "incomplete" rather than a result. Reporting that as a pass would
  // claim something never measured — see `.docs/accessibility-and-cwv.md`.
  rules: { 'color-contrast': { enabled: false } },
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/services/authService', () => ({
  requestEmailCode: jest.fn(),
  verifyEmailCode: jest.fn(),
}));
jest.mock('@/services/leadCaptureService', () => ({
  submitContactForm: jest.fn(),
  CONTACT_TOPICS: ['Buying', 'Selling / Home Value', 'Existing request', 'General question'],
  TOPIC_LEAD_TYPE: {
    Buying: 'buyer',
    'Selling / Home Value': 'seller',
    'Existing request': 'buyer',
    'General question': 'buyer',
  },
}));
jest.mock('@/services/homeValueService', () => ({ submitHomeValueRequest: jest.fn() }));
jest.mock('@/services/mfaService', () => ({
  fetchMfaStatus: jest.fn().mockResolvedValue({
    enabled: false,
    required: true,
    state: 'enrolment_required',
    enrolled_at: null,
    recovery_codes_remaining: 0,
    locked: false,
  }),
  startMfaSetup: jest.fn(),
  enableMfa: jest.fn(),
  disableMfa: jest.fn(),
  regenerateRecoveryCodes: jest.fn(),
}));
jest.mock('@/components/auth/GoogleAuthButton', () => ({
  GoogleLoginButton: () => <button type="button">Continue with Google</button>,
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ accessToken: null, user: null, setAuth: jest.fn() }),
}));

async function expectAccessible(ui: React.ReactElement) {
  const { container } = render(ui);
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
}

test('the About page is accessible', async () => {
  await expectAccessible(<AboutPage />);
});

test('the Resources page is accessible', async () => {
  await expectAccessible(<ResourcesPage />);
});

test('the contact form is accessible', async () => {
  await expectAccessible(<ContactForm />);
});

test('the email sign-in form is accessible', async () => {
  await expectAccessible(<EmailCodeAuthForm />);
});

test('the Home Value form is accessible', async () => {
  // The longest form on the site, with three fieldsets, six "Not sure"
  // controls and four selects — the most opportunities for a duplicate id or
  // an unlabelled control.
  await expectAccessible(<HomeValueForm />);
});

test('the two-step verification setup screen is accessible', async () => {
  await expectAccessible(<MfaEnrolment />);
});
