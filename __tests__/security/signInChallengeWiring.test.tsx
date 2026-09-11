import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailCodeAuthForm } from '@/components/auth/EmailCodeAuthForm';
import { requestEmailCode, verifyEmailCode } from '@/services/authService';
import { verifyMfa } from '@/services/mfaService';
import { fetchCurrentUser } from '@/services/userService';
import { isMfaEnrolmentRequired } from '@/lib/mfaEnrolmentRedirect';

/**
 * The browser half of *"fix the reported Google/email bypass"* — control 1.13.
 *
 * The API returning a challenge is only half a fix. If the browser reads
 * `access_token` off that response it stores `undefined`, calls it a login,
 * and the user is left in a broken half-signed-in state — or worse, the
 * component skips the challenge entirely and the bypass survives the fix.
 *
 * These tests assert the *branch*, not the happy path.
 */

const replace = jest.fn();
const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
}));

jest.mock('@/services/authService', () => ({
  requestEmailCode: jest.fn(),
  verifyEmailCode: jest.fn(),
}));

jest.mock('@/services/mfaService', () => ({
  verifyMfa: jest.fn(),
  verifyMfaRecoveryCode: jest.fn(),
}));

jest.mock('@/services/userService', () => ({
  fetchCurrentUser: jest.fn(),
}));

jest.mock('@/lib/completeSignIn', () => ({
  completeSignIn: jest.fn().mockResolvedValue(undefined),
}));

const setAuth = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ setAuth }),
}));

const mockRequest = requestEmailCode as jest.MockedFunction<typeof requestEmailCode>;
const mockVerifyCode = verifyEmailCode as jest.MockedFunction<typeof verifyEmailCode>;
const mockVerifyMfa = verifyMfa as jest.MockedFunction<typeof verifyMfa>;
const mockMe = fetchCurrentUser as jest.MockedFunction<typeof fetchCurrentUser>;

const TOKENS = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'bearer',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequest.mockResolvedValue({
    detail: 'If the email exists, a sign-in code has been sent.',
    expires_in_minutes: 10,
  });
  mockVerifyMfa.mockResolvedValue(TOKENS);
  mockMe.mockResolvedValue({
    id: 'u1',
    email: 'agent@example.com',
    first_name: 'Ada',
    last_name: 'Okonkwo',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_anonymous: false,
    last_active_at: '2026-01-01T00:00:00Z',
    role: 'agent',
    onboarding_completed: true,
    onboarding_completed_at: '2026-01-01T00:00:00Z',
    deactivated_at: null,
    marketing_emails_enabled: true,
    listing_alerts_enabled: true,
    product_updates_enabled: true,
    mfa_enabled: true,
  } as Awaited<ReturnType<typeof fetchCurrentUser>>);
});

async function reachCodeStep() {
  render(<EmailCodeAuthForm />);
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'agent@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Send sign-in code/ }));
  await waitFor(() => screen.getByLabelText('6-digit code'));
}

test('a challenge from the email-code path shows the second factor, not a session', async () => {
  mockVerifyCode.mockResolvedValue({
    mfa_required: true,
    mfa_challenge_token: 'chal-1',
  });
  await reachCodeStep();

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '111111' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() => expect(screen.getByText('Two-step verification')).toBeTruthy());
  // The critical assertion: nothing was seated and nowhere was navigated. A
  // component that read `access_token` off the challenge would have stored
  // `undefined` here and called it a login.
  expect(setAuth).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

test('answering the challenge completes the sign-in it interrupted', async () => {
  mockVerifyCode.mockResolvedValue({
    mfa_required: true,
    mfa_challenge_token: 'chal-1',
  });
  await reachCodeStep();
  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '111111' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => screen.getByLabelText('6-digit code'));

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '222222' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

  await waitFor(() => expect(mockVerifyMfa).toHaveBeenCalledWith('chal-1', '222222'));
  await waitFor(() => expect(replace).toHaveBeenCalled());
});

test('a client without MFA is unaffected — no challenge, straight in', async () => {
  // The fix must not turn a second factor on for everyone. 1.13 scopes it to
  // staff; if this fails, the change has made the product worse for the
  // people it was never about.
  mockVerifyCode.mockResolvedValue(TOKENS);
  await reachCodeStep();

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '111111' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() => expect(replace).toHaveBeenCalled());
  expect(screen.queryByText('Two-step verification')).toBeNull();
});

test('starting over from the challenge returns to the address, not the spent code', async () => {
  // The emailed code was consumed by the request that produced the challenge,
  // so offering it again would only fail.
  mockVerifyCode.mockResolvedValue({
    mfa_required: true,
    mfa_challenge_token: 'chal-1',
  });
  await reachCodeStep();
  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '111111' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => screen.getByText('Two-step verification'));

  fireEvent.click(screen.getByRole('button', { name: 'Start over' }));

  expect(screen.getByLabelText('Email address')).toBeTruthy();
});

// ── The enrolment 403 ────────────────────────────────────────────────────────

test('only the tagged 403 is treated as "you need to enrol"', () => {
  // An ordinary permission denial and an enrolment requirement are both 403
  // and lead to opposite screens: "this isn't yours" versus "set this up".
  // Only the server can tell them apart, so it tags one.
  expect(
    isMfaEnrolmentRequired({
      response: { status: 403, data: { detail: { code: 'mfa_enrolment_required' } } },
    }),
  ).toBe(true);

  expect(
    isMfaEnrolmentRequired({
      response: { status: 403, data: { detail: 'Requires one of roles: [agent]' } },
    }),
  ).toBe(false);

  expect(
    isMfaEnrolmentRequired({
      response: { status: 401, data: { detail: { code: 'mfa_enrolment_required' } } },
    }),
  ).toBe(false);

  expect(isMfaEnrolmentRequired(new Error('network'))).toBe(false);
});
