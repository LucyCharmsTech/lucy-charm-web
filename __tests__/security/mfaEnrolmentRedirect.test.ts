import axios from 'axios';
import {
  attachMfaEnrolmentInterceptor,
  isMfaEnrolmentRequired,
  MFA_ENROLMENT_PATH,
} from '@/lib/mfaEnrolmentRedirect';

/**
 * Client report: "before an admin comes to this when trying to login, there is
 * a slight error page that shouldn't be rendered but is rendering, it
 * disappears fast."
 *
 * That was `/admin`'s own error state. The interceptor starts the redirect to
 * the enrolment screen and then rejected the promise anyway. `location.assign`
 * is asynchronous, so the rejection reached the page's catch first, the page
 * set an error, React painted a red box, and only then did the browser
 * navigate. Sixteen pages under /admin and /agent load on mount and render an
 * error box on rejection, so this is fixed once here rather than in each catch.
 */

const enrolmentRequired = {
  response: { status: 403, data: { detail: { code: 'mfa_enrolment_required' } } },
};

function makeClient(pathname: string) {
  const go = jest.fn();
  const client = axios.create();
  attachMfaEnrolmentInterceptor(client, { currentPath: () => pathname, go });
  // Reject before any request leaves, so this tests the interceptor alone.
  client.interceptors.request.use(() => Promise.reject(enrolmentRequired));
  return { client, assign: go };
}

/** Did the promise settle within a turn or two of the event loop? */
async function settledQuickly(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  const race = await Promise.race([
    promise.then(() => 'resolved').catch(() => 'rejected'),
    new Promise((r) => setTimeout(() => r(marker), 50)),
  ]);
  return race !== marker;
}

test('the redirect is started', async () => {
  const { client, assign } = makeClient('/admin');
  void client.get('/anything').catch(() => {});
  await new Promise((r) => setTimeout(r, 10));
  expect(assign).toHaveBeenCalledWith(MFA_ENROLMENT_PATH);
});

test('the caller is left pending, so no page paints an error over the redirect', async () => {
  const { client } = makeClient('/admin');
  expect(await settledQuickly(client.get('/anything'))).toBe(false);
});

test('an ordinary failure still rejects, so real errors are still shown', async () => {
  const assign = jest.fn();

  const client = axios.create();
  attachMfaEnrolmentInterceptor(client, { currentPath: () => '/admin', go: assign });
  client.interceptors.request.use(() =>
    Promise.reject({ response: { status: 500, data: { detail: 'Boom' } } }),
  );

  expect(await settledQuickly(client.get('/anything'))).toBe(true);
  expect(assign).not.toHaveBeenCalled();
});

test('already on the enrolment screen: no redirect, and the error is surfaced', async () => {
  // The setup screen's own calls are the likeliest to hit this, and redirecting
  // would reload the page under someone mid-setup.
  const { client, assign } = makeClient(MFA_ENROLMENT_PATH);

  expect(await settledQuickly(client.get('/anything'))).toBe(true);
  expect(assign).not.toHaveBeenCalled();
});

test('the predicate only matches the enrolment code', () => {
  expect(isMfaEnrolmentRequired(enrolmentRequired)).toBe(true);
  expect(
    isMfaEnrolmentRequired({ response: { status: 403, data: { detail: 'Forbidden' } } }),
  ).toBe(false);
  expect(isMfaEnrolmentRequired({ response: { status: 401, data: {} } })).toBe(false);
  expect(isMfaEnrolmentRequired(new Error('network'))).toBe(false);
});
