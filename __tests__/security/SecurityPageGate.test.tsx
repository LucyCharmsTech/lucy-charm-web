import { render, screen, waitFor } from '@testing-library/react';
import SecurityPageGate from '@/components/security/SecurityPageGate';
import { useAuthStore } from '@/stores/authStore';

/**
 * Client report: "Tried to setup 2FA authentication but it keeps saying not
 * authenticated even though I was trying to signup with google."
 *
 * They were not signed in. Their Google sign-up had failed, and `MfaEnrolment`
 * asks the API for MFA status the moment it mounts, so the request went out
 * with no Authorization header and the API answered FastAPI's stock
 * `401 {"detail": "Not authenticated"}`. The page printed that string in red,
 * which reads like two-step verification is broken rather than like being
 * logged out.
 */

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
}));

// The gate must decide before this ever mounts; if it renders, the unauthenticated
// request that produced the original error has already been made.
jest.mock('@/components/security/MfaEnrolment', () => ({
  MfaEnrolment: ({ onEnrolmentComplete }: { onEnrolmentComplete?: () => void }) => (
    <button data-testid="enrolment" type="button" onClick={onEnrolmentComplete}>MFA</button>
  ),
}));

beforeEach(() => {
  replace.mockClear();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    hasHydrated: true,
  });
  jest.spyOn(useAuthStore.persist, 'hasHydrated').mockReturnValue(true);
  sessionStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('a signed-out visitor is sent to sign in, and never mounts the enrolment form', async () => {
  render(<SecurityPageGate />);

  expect(screen.queryByTestId('enrolment')).toBeNull();
  expect(screen.getByText('Taking you to sign in…')).toBeTruthy();

  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith('/login?redirect=%2Fsecurity'),
  );
});

test('the redirect carries the way back, so sign-in returns here', async () => {
  render(<SecurityPageGate />);
  await waitFor(() => expect(replace).toHaveBeenCalled());

  const target = new URL(replace.mock.calls[0][0], 'http://x');
  expect(target.searchParams.get('redirect')).toBe('/security');
});

test('nothing is decided before the persisted session is visible to the render', () => {
  // A full page load hydrates with the store's initial state, where the token
  // reads null. Redirecting then sent signed-in staff to /login, which sent
  // them straight back here — an endless loop on the enrolment screen.
  const hydrated = jest
    .spyOn(useAuthStore.persist, 'hasHydrated')
    .mockReturnValue(false);

  render(<SecurityPageGate />);

  expect(replace).not.toHaveBeenCalled();
  expect(screen.queryByTestId('enrolment')).toBeNull();
  expect(screen.getByText('Loading…')).toBeTruthy();
  hydrated.mockRestore();
});

test('a signed-in visitor gets the enrolment form and no redirect', () => {
  useAuthStore.setState({
    accessToken: 'a-token',
    refreshToken: null,
    user: null,
    hasHydrated: true,
  });

  render(<SecurityPageGate />);

  expect(screen.getByTestId('enrolment')).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});

test('a completed invitation enrolment returns to agent onboarding', () => {
  useAuthStore.setState({
    accessToken: 'a-token',
    refreshToken: null,
    user: null,
    hasHydrated: true,
  });
  sessionStorage.setItem('lucy-mfa-enrolment-return-path', '/agent/onboarding');

  render(<SecurityPageGate />);
  screen.getByTestId('enrolment').click();

  expect(replace).toHaveBeenCalledWith('/agent/onboarding');
  expect(sessionStorage.getItem('lucy-mfa-enrolment-return-path')).toBeNull();
});
