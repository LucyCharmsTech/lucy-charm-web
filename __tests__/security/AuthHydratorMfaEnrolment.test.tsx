import { render, waitFor } from '@testing-library/react';
import AuthHydrator from '@/components/AuthHydrator';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';

/**
 * An agent signed in with Google, was sent to /security to set up two-step
 * verification, and landed on /login instead. On /security the enrolment
 * redirect stands aside, so the /users/me 403 reached AuthHydrator, which
 * cleared the session — and the security page then sent a signed-out visitor
 * to sign in. The enrolment 403 must leave the session in place.
 */

jest.mock('@/services/userService', () => ({
  fetchCurrentUser: jest.fn(),
}));

const mockedFetchCurrentUser = fetchCurrentUser as jest.MockedFunction<
  typeof fetchCurrentUser
>;

function forbidden(detail: unknown) {
  return { response: { status: 403, data: { detail } } };
}

beforeEach(() => {
  mockedFetchCurrentUser.mockReset();
  useAuthStore.setState({
    accessToken: 'enrolment-token',
    refreshToken: 'refresh-token',
    user: null,
  });
});

test('the MFA enrolment 403 keeps the session so /security can finish setup', async () => {
  mockedFetchCurrentUser.mockRejectedValue(
    forbidden({ code: 'mfa_enrolment_required' }),
  );

  render(<AuthHydrator />);

  await waitFor(() => expect(mockedFetchCurrentUser).toHaveBeenCalled());
  // Let the rejection settle before asserting nothing was cleared.
  await Promise.resolve();
  expect(useAuthStore.getState().accessToken).toBe('enrolment-token');
  expect(useAuthStore.getState().refreshToken).toBe('refresh-token');
});

test('any other 403 on /users/me still clears the session', async () => {
  mockedFetchCurrentUser.mockRejectedValue(forbidden('Not permitted'));

  render(<AuthHydrator />);

  await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
});
