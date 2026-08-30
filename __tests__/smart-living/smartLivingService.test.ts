/**
 * The Smart Living API client.
 *
 * The test that matters most here is
 * `an idempotency key is per intent, not per attempt`. Everything else in this
 * file guards a contract the API already enforces; that one guards a rule only
 * the client can get wrong, and getting it wrong reserves a buyer's money twice
 * while every individual request looks perfectly well-formed.
 */

import type {
  SmartLivingIntakeCandidate,
  SmartLivingPlan,
  SmartLivingPublicConfig,
} from '@/types/api';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
}));
jest.mock('@/lib/anonymousSession', () => ({
  getOrCreateAnonymousSessionToken: () => 'anonymous-session-token-1234',
}));

import api from '@/lib/axios';
import {
  clearStoredSmartLivingPlanId,
  createSmartLivingPlan,
  fetchMySmartLivingPlan,
  fetchSmartLivingPlan,
  fetchSmartLivingPublicConfig,
  getStoredSmartLivingPlanId,
  newIdempotencyKey,
  parseSmartLivingIntakeMessage,
  updateSmartLivingPlan,
  withIdempotencyKey,
} from '@/services/smartLivingService';

const mockApi = api as jest.Mocked<typeof api>;

const ANON_HEADERS = {
  headers: { 'X-Anonymous-Session-Token': 'anonymous-session-token-1234' },
};

const plan: SmartLivingPlan = {
  id: 'plan-1',
  status: 'estimated',
  location_query: null,
  location_city: 'Vaughan',
  location_region: 'ON',
  service_area_key: 'on/vaughan',
  purchase_range_key: 'custom',
  purchase_basis_cents: 74_000_000,
  purchase_basis_source: 'exact_amount',
  buying_timeline: '3_6_months',
  home_type: 'condo',
  estimated_benefit_cents: 416_250,
  cash_benefit_cents: 333_000,
  confirmed_benefit_cents: null,
  benefit_choice: null,
  benefit_choice_locked_at: null,
  high_value_review_required: false,
  terms_version_accepted: null,
  terms_accepted_at: null,
  last_calculated_at: '2026-08-28T00:00:00Z',
  created_at: '2026-08-28T00:00:00Z',
  updated_at: null,
};

const candidate: SmartLivingIntakeCandidate = {
  prefill: {
    location_city: 'Vaughan',
    buying_timeline: '6_12_months',
    home_type: 'condo',
  },
  purchase_amount_text: '$750K',
  purchase_amount_cents: 75_000_000,
  amount_is_upper_bound: false,
  requires_amount_confirmation: true,
  is_empty: false,
};

const config: SmartLivingPublicConfig = {
  range_config_version: '2026-08-launch',
  bands: [],
  branches: {},
  service_area_key: null,
  categories: [],
  catalogue_available: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// ── Idempotency ─────────────────────────────────────────────────────────────

test('an idempotency key is per intent, not per attempt', () => {
  /*
   * One buyer tap = one key, reused across every retry of that tap. The
   * failure mode this prevents is invisible from the client's side: each retry
   * looks like a well-formed request, the server sees three *different* keys,
   * and reserves the money three times.
   *
   * `withIdempotencyKey` takes the key as an argument precisely so it cannot
   * mint one per call — the shape of the API makes the mistake awkward to
   * write, which is the only reliable kind of guard against it.
   */
  const intentKey = newIdempotencyKey();

  const attemptOne = withIdempotencyKey(intentKey);
  const attemptTwo = withIdempotencyKey(intentKey);
  const attemptThree = withIdempotencyKey(intentKey);

  expect(attemptOne['Idempotency-Key']).toBe(intentKey);
  expect(attemptTwo['Idempotency-Key']).toBe(intentKey);
  expect(attemptThree['Idempotency-Key']).toBe(intentKey);
});

test('separate intents get separate keys', () => {
  expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
});

test('an idempotent request still carries the ownership token', () => {
  // Otherwise a signed-out buyer's confirm would 404 on the plan it names.
  const headers = withIdempotencyKey('key-1');
  expect(headers['X-Anonymous-Session-Token']).toBe('anonymous-session-token-1234');
});

// ── Plans ───────────────────────────────────────────────────────────────────

test('creating a plan sends the ownership token and stores the id', async () => {
  mockApi.post.mockResolvedValueOnce({ data: plan });

  await expect(
    createSmartLivingPlan({ purchase_range_key: '700_800' }),
  ).resolves.toEqual(plan);

  expect(mockApi.post).toHaveBeenCalledWith(
    '/smart_living/plans/',
    { purchase_range_key: '700_800' },
    ANON_HEADERS,
  );
  expect(getStoredSmartLivingPlanId()).toBe('plan-1');
});

test('the stored id survives a reload and can be cleared at claim time', () => {
  expect(getStoredSmartLivingPlanId()).toBeNull();
  localStorage.setItem('lucy-smart-living-plan-id', 'plan-9');
  expect(getStoredSmartLivingPlanId()).toBe('plan-9');

  // After sign-in the plan belongs to the account; a stale anonymous pointer
  // would send the next visit down the anonymous path for a plan that no
  // longer answers to it.
  clearStoredSmartLivingPlanId();
  expect(getStoredSmartLivingPlanId()).toBeNull();
});

test('the buyer amount is sent as the string they typed', async () => {
  /*
   * Not parsed, not normalised, not converted to cents. `money.py` is the only
   * parser in the system; a second one here would eventually disagree with it
   * about a rounding edge, and the disagreement would surface as a wrong
   * figure rather than an error.
   */
  mockApi.post.mockResolvedValueOnce({ data: plan });

  await createSmartLivingPlan({
    purchase_range_key: 'custom',
    purchase_amount: '$740,000',
  });

  expect(mockApi.post).toHaveBeenCalledWith(
    '/smart_living/plans/',
    { purchase_range_key: 'custom', purchase_amount: '$740,000' },
    ANON_HEADERS,
  );
});

test('a patch sends only the fields that changed', async () => {
  // The server distinguishes absent from explicitly null, and only
  // recalculates when a basis input moved. Sending the whole form back would
  // restamp "Last updated" for a timeline edit.
  mockApi.patch.mockResolvedValueOnce({ data: plan });

  await updateSmartLivingPlan('plan-1', { buying_timeline: '0_3_months' });

  expect(mockApi.patch).toHaveBeenCalledWith(
    '/smart_living/plans/plan-1',
    { buying_timeline: '0_3_months' },
    ANON_HEADERS,
  );
});

test('reading a plan sends the ownership token', async () => {
  mockApi.get.mockResolvedValueOnce({ data: plan });
  await fetchSmartLivingPlan('plan-1');
  expect(mockApi.get).toHaveBeenCalledWith('/smart_living/plans/plan-1', ANON_HEADERS);
});

test('plans/me sends no anonymous token', async () => {
  // It is answered from the bearer token alone. Sending an anonymous token
  // alongside would imply the two identities are interchangeable, and they are
  // exactly what the plan's XOR constraint keeps apart.
  mockApi.get.mockResolvedValueOnce({ data: plan });
  await fetchMySmartLivingPlan();
  expect(mockApi.get).toHaveBeenCalledWith('/smart_living/plans/me');
});

// ── Natural-language intake ─────────────────────────────────────────────────

test('parsing a sentence sends no ownership token, because there is nothing to own', async () => {
  /*
   * The route reads nothing and writes nothing — no plan exists yet when a
   * buyer types their first sentence. Attaching a session token would imply
   * otherwise and put an ownership credential on a request that has no subject.
   */
  mockApi.post.mockResolvedValueOnce({ data: candidate });

  await expect(
    parseSmartLivingIntakeMessage('Around $750K in Vaughan next spring, probably a condo'),
  ).resolves.toEqual(candidate);

  expect(mockApi.post).toHaveBeenCalledWith('/smart_living/intake/parse', {
    message: 'Around $750K in Vaughan next spring, probably a condo',
  });
});

test('the amount comes back beside the prefill, never inside it', async () => {
  // The split is the contract: `prefill` is droppable into form fields, the
  // amount has to be agreed to first.
  mockApi.post.mockResolvedValueOnce({ data: candidate });

  const heard = await parseSmartLivingIntakeMessage('around $750k in Vaughan');

  expect(heard.prefill).toEqual({
    location_city: 'Vaughan',
    buying_timeline: '6_12_months',
    home_type: 'condo',
  });
  expect('purchase_amount' in heard.prefill).toBe(false);
  expect(heard.requires_amount_confirmation).toBe(true);
});

// ── public-config ───────────────────────────────────────────────────────────

test('public-config is requested with no auth headers at all', async () => {
  // Spec A1: no sign-in wall. Not even the optional token — there is nothing
  // caller-specific in the response.
  mockApi.get.mockResolvedValueOnce({ data: config });

  await expect(fetchSmartLivingPublicConfig()).resolves.toEqual(config);
  expect(mockApi.get).toHaveBeenCalledWith('/smart_living/public-config', undefined);
});

test('a service area is passed as a query parameter when known', async () => {
  mockApi.get.mockResolvedValueOnce({ data: config });

  await fetchSmartLivingPublicConfig('on/vaughan');

  expect(mockApi.get).toHaveBeenCalledWith('/smart_living/public-config', {
    params: { service_area: 'on/vaughan' },
  });
});

test('the API route is snake_case even though the page route is kebab', async () => {
  /*
   * `/smart_living/plans` on the API, `/smart-living/plan` in Next.js. Both are
   * deliberate — every backend router prefix is snake_case and every web route
   * is kebab — and the one-character gap is the single most likely typo in
   * this file.
   */
  mockApi.get.mockResolvedValueOnce({ data: config });
  await fetchSmartLivingPublicConfig();

  const [path] = mockApi.get.mock.calls[0];
  expect(path).toContain('smart_living');
  expect(path).not.toContain('smart-living');
});
