import axios from 'axios';
import { attachAuthRefreshInterceptor } from '@/lib/axiosAuthRefresh';

/**
 * A wrong sign-in code must not be treated as a stale session.
 *
 * `/auth/email-code` was absent from the skip list. A wrong code answers 401,
 * so for anyone already holding a refresh token the interceptor refreshed the
 * session and replayed the request — spending a second of the five allowed
 * attempts on a single typo, and showing a refresh error rather than "that
 * code is not right".
 */

const refresh = jest.fn();
jest.mock('@/services/authService', () => ({
  refreshToken: (...args: unknown[]) => refresh(...args),
}));

function clientThatAlwaysGets401() {
  const client = axios.create();
  attachAuthRefreshInterceptor(client);
  client.interceptors.request.use(() =>
    Promise.reject({
      response: { status: 401, data: { detail: 'That code is not valid.' } },
      config: { url: '/auth/email-code/verify' },
    }),
  );
  return client;
}

beforeEach(() => refresh.mockClear());

test('a wrong email code does not trigger a token refresh', async () => {
  const client = clientThatAlwaysGets401();

  await expect(client.post('/auth/email-code/verify')).rejects.toBeDefined();

  expect(refresh).not.toHaveBeenCalled();
});

test('the original error is what surfaces, not a refresh failure', async () => {
  const client = clientThatAlwaysGets401();

  await expect(client.post('/auth/email-code/verify')).rejects.toMatchObject({
    response: { data: { detail: 'That code is not valid.' } },
  });
});
