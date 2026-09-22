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
  MfaEnrolment: () => <div data-testid="enrolment" />,
}));

beforeEach(() => {
  replace.mockClear();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    hasHydrated: true,
  });
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
