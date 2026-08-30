/**
 * The four-question intake flow.
 *
 * Three behaviours here are the ones worth protecting, and all three are easy
 * to regress into something that still looks like it works:
 *
 * 1. **The plan is created on the first answer**, not the last. Batching four
 *    answers into one POST at the end would leave nothing to claim at sign-in.
 * 2. **A null estimate renders the non-dollar preview**, never $0. Those are
 *    different statements — one says we do not know, the other says nothing.
 * 3. **A resumed plan skips answered questions.** Spec A1.6: no repeated
 *    questions, for anonymous returners as much as signed-in buyers.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { SmartLivingPlan, SmartLivingPublicConfig } from '@/types/api';

jest.mock('@/services/smartLivingService', () => ({
  fetchSmartLivingPublicConfig: jest.fn(),
  fetchSmartLivingPlan: jest.fn(),
  createSmartLivingPlan: jest.fn(),
  updateSmartLivingPlan: jest.fn(),
  getStoredSmartLivingPlanId: jest.fn(),
  parseSmartLivingIntakeMessage: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

import IntakeFlow from '@/components/smart-living/IntakeFlow';
import { track } from '@/lib/analytics';
import {
  createSmartLivingPlan,
  fetchSmartLivingPlan,
  fetchSmartLivingPublicConfig,
  getStoredSmartLivingPlanId,
  parseSmartLivingIntakeMessage,
  updateSmartLivingPlan,
} from '@/services/smartLivingService';

const mockFetchConfig = fetchSmartLivingPublicConfig as jest.Mock;
const mockFetchPlan = fetchSmartLivingPlan as jest.Mock;
const mockCreate = createSmartLivingPlan as jest.Mock;
const mockUpdate = updateSmartLivingPlan as jest.Mock;
const mockStoredId = getStoredSmartLivingPlanId as jest.Mock;
const mockParse = parseSmartLivingIntakeMessage as jest.Mock;
const mockTrack = track as jest.Mock;

const config: SmartLivingPublicConfig = {
  range_config_version: '2026-08-launch',
  bands: [
    { key: '700_800', kind: 'closed', min_cents: 70_000_000, max_cents: 80_000_000, branch: null },
    { key: 'custom', kind: 'exact', min_cents: null, max_cents: null, branch: null },
    { key: 'not_sure', kind: 'no_basis', min_cents: null, max_cents: null, branch: null },
  ],
  branches: {},
  service_area_key: null,
  categories: [],
  catalogue_available: false,
};

function makePlan(overrides: Partial<SmartLivingPlan> = {}): SmartLivingPlan {
  return {
    id: 'plan-1',
    status: 'estimated',
    location_query: 'Vaughan, ON',
    location_city: 'Vaughan',
    location_region: 'ON',
    service_area_key: 'on/vaughan',
    purchase_range_key: null,
    purchase_basis_cents: null,
    purchase_basis_source: 'none',
    buying_timeline: null,
    home_type: null,
    estimated_benefit_cents: null,
    cash_benefit_cents: null,
    confirmed_benefit_cents: null,
    benefit_choice: null,
    benefit_choice_locked_at: null,
    high_value_review_required: false,
    terms_version_accepted: null,
    terms_accepted_at: null,
    last_calculated_at: null,
    created_at: '2026-08-28T00:00:00Z',
    updated_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchConfig.mockResolvedValue(config);
  mockStoredId.mockReturnValue(null);
});

async function startFresh() {
  render(<IntakeFlow />);
  await screen.findByText('Where are you hoping to buy?');
}

async function answerLocation(plan = makePlan()) {
  mockCreate.mockResolvedValueOnce(plan);
  fireEvent.change(screen.getByLabelText('City or area'), {
    target: { value: 'Vaughan' },
  });
  fireEvent.click(screen.getByText('Continue'));
  await screen.findByText(/what price range/i);
}

// ── The plan is a server row from the first answer ───────────────────────────

test('the first answer creates the plan rather than being held client-side', async () => {
  /*
   * Batching all four answers into one POST at the end is the tidier build and
   * the wrong one: a Smart Living plan has to be claimed exactly once at
   * sign-in, and there is nothing to claim if the only copy is in the browser.
   */
  await startFresh();
  await answerLocation();

  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith({
    location_query: 'Vaughan, ON',
    location_city: 'Vaughan',
    location_region: 'ON',
  });
});

test('later answers patch the existing plan instead of creating another', async () => {
  await startFresh();
  await answerLocation();

  mockUpdate.mockResolvedValueOnce(
    makePlan({ purchase_range_key: '700_800', estimated_benefit_cents: 421_875 }),
  );
  fireEvent.click(screen.getByRole('button', { name: /select a price range/i }));
  fireEvent.click(screen.getByText('$700K – $800K'));

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  expect(mockUpdate).toHaveBeenCalledWith('plan-1', {
    purchase_range_key: '700_800',
    purchase_amount: null,
  });
  // Still exactly one plan.
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test('a failed save does not advance the step', async () => {
  // Advancing optimistically would let a buyer reach the preview while their
  // answer silently failed to persist.
  await startFresh();
  mockCreate.mockRejectedValueOnce({
    response: { data: { detail: 'Anonymous session token must be between 16 and 64 characters.' } },
  });

  fireEvent.change(screen.getByLabelText('City or area'), {
    target: { value: 'Vaughan' },
  });
  fireEvent.click(screen.getByText('Continue'));

  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).toMatch(/16 and 64/);
  expect(screen.getByText('Where are you hoping to buy?')).toBeTruthy();
});

test('a city shorter than two characters is caught before the request', async () => {
  await startFresh();
  fireEvent.change(screen.getByLabelText('City or area'), { target: { value: 'V' } });
  fireEvent.click(screen.getByText('Continue'));

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();
});

// ── The estimate is whatever the server said ────────────────────────────────

test('a dollar estimate is rendered from the server figure', async () => {
  await startFresh();
  await answerLocation();

  mockUpdate.mockResolvedValueOnce(
    makePlan({ purchase_range_key: '700_800', estimated_benefit_cents: 421_875 }),
  );
  fireEvent.click(screen.getByRole('button', { name: /select a price range/i }));
  fireEvent.click(screen.getByText('$700K – $800K'));
  await screen.findByText(/when are you thinking/i);

  mockUpdate.mockResolvedValueOnce(
    makePlan({ purchase_range_key: '700_800', estimated_benefit_cents: 421_875, buying_timeline: '3_6_months' }),
  );
  fireEvent.click(screen.getByText('3 – 6 months'));
  await screen.findByText(/what kind of home/i);

  mockUpdate.mockResolvedValueOnce(
    makePlan({
      purchase_range_key: '700_800',
      estimated_benefit_cents: 421_875,
      cash_benefit_cents: 337_500,
      buying_timeline: '3_6_months',
      home_type: 'condo',
      last_calculated_at: '2026-08-28T00:00:00Z',
    }),
  );
  fireEvent.click(screen.getByText('Condo'));

  expect(await screen.findByText('$4,218.75')).toBeTruthy();
  expect(screen.getByText(/\$3,375\.00/)).toBeTruthy();
});

test('a null estimate shows the non-dollar preview, never a zero', async () => {
  /*
   * `null` and `0` are different statements. A $0 tells a buyer their benefit
   * is nothing; the truth is that we have no purchase amount to work from, and
   * "Not sure" is a legitimate answer to question 2.
   */
  await startFresh();
  await answerLocation();

  const noBasis = makePlan({ purchase_range_key: 'not_sure' });
  mockUpdate.mockResolvedValueOnce(noBasis);
  fireEvent.click(screen.getByRole('button', { name: /select a price range/i }));
  fireEvent.click(screen.getByText('Not sure yet'));
  await screen.findByText(/when are you thinking/i);

  mockUpdate.mockResolvedValueOnce({ ...noBasis, buying_timeline: 'exploring' });
  fireEvent.click(screen.getByText('Just exploring'));
  await screen.findByText(/what kind of home/i);

  mockUpdate.mockResolvedValueOnce({
    ...noBasis,
    buying_timeline: 'exploring',
    home_type: 'not_sure',
  });
  fireEvent.click(screen.getByText('Not sure'));

  expect(await screen.findByText(/what Smart Living could cover/i)).toBeTruthy();
  expect(screen.getByText(/rather show you nothing than a number/i)).toBeTruthy();
  expect(screen.queryByText('$0.00')).toBeNull();
});

// ── Resume ──────────────────────────────────────────────────────────────────

test('a resumed plan skips the questions already answered', async () => {
  // Spec A1.6: no repeated questions. This applies to an anonymous returner as
  // much as to a signed-in buyer — it is about not asking twice, not about who
  // is asking.
  mockStoredId.mockReturnValue('plan-1');
  mockFetchPlan.mockResolvedValueOnce(
    makePlan({ purchase_range_key: '700_800', estimated_benefit_cents: 421_875 }),
  );

  render(<IntakeFlow />);

  expect(await screen.findByText(/when are you thinking/i)).toBeTruthy();
  expect(screen.queryByText('Where are you hoping to buy?')).toBeNull();
});

test('"Not sure" counts as an answered question on resume', async () => {
  /*
   * The band key says whether they replied; the *basis* does not.
   * `purchase_basis_source` stays `'none'` for "Not sure", and resuming on
   * that would re-ask a question the buyer already answered.
   */
  mockStoredId.mockReturnValue('plan-1');
  mockFetchPlan.mockResolvedValueOnce(
    makePlan({ purchase_range_key: 'not_sure', purchase_basis_source: 'none' }),
  );

  render(<IntakeFlow />);

  expect(await screen.findByText(/when are you thinking/i)).toBeTruthy();
});

test('a stored id the server no longer knows starts a fresh flow', async () => {
  // Ordinary, not an error: the plan may have been claimed by an account on
  // another device. Showing an error for something the buyer cannot act on
  // would strand them.
  mockStoredId.mockReturnValue('plan-gone');
  mockFetchPlan.mockRejectedValueOnce({ response: { status: 404 } });

  render(<IntakeFlow />);

  expect(await screen.findByText('Where are you hoping to buy?')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('an unseeded deployment says so instead of rendering an empty picker', async () => {
  mockFetchConfig.mockRejectedValueOnce({
    response: { data: { detail: 'Smart Living configuration (ranges) is temporarily unavailable.' } },
  });

  render(<IntakeFlow />);

  expect((await screen.findByRole('alert')).textContent).toMatch(/temporarily unavailable/i);
});

// ── "Just tell us in your own words" ────────────────────────────────────────
//
// The parallel entrance to the same four questions. Every test below is really
// one test asked five ways: **a parsed amount is proposed, never applied.** The
// three other fields land in visible form state a buyer corrects at a glance;
// a wrong amount is invisible and flows into a figure they plan against.

const HEARD = {
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

async function describeIt(message = 'Around $750K in Vaughan next spring, probably a condo') {
  fireEvent.change(screen.getByLabelText(/tell us in your own words/i), {
    target: { value: message },
  });
  fireEvent.click(screen.getByText('Fill this in for me'));
}

test('a sentence fills the three sight-confirmable fields and lands on the unanswered one', async () => {
  await startFresh();
  mockParse.mockResolvedValueOnce(HEARD);
  mockCreate.mockResolvedValueOnce(
    makePlan({ buying_timeline: '6_12_months', home_type: 'condo' }),
  );

  await describeIt();

  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  expect(mockCreate).toHaveBeenCalledWith({
    location_city: 'Vaughan',
    location_query: 'Vaughan',
    buying_timeline: '6_12_months',
    home_type: 'condo',
  });
  // Where, when and what kind are answered; the price question is not.
  expect(await screen.findByText(/what price range/i)).toBeTruthy();
});

test('the amount she heard is never part of the write', async () => {
  /*
   * The server excludes it from `prefill`, and the client copies field by field
   * rather than spreading — so an amount cannot reach a plan through this path
   * even if the parse response grew one tomorrow.
   */
  await startFresh();
  mockParse.mockResolvedValueOnce(HEARD);
  mockCreate.mockResolvedValueOnce(makePlan({ buying_timeline: '6_12_months', home_type: 'condo' }));

  await describeIt();

  await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  const payload = mockCreate.mock.calls[0][0];
  expect('purchase_amount' in payload).toBe(false);
  expect('purchase_range_key' in payload).toBe(false);
});

test('the amount is put to the buyer in their own words, and only applied on a yes', async () => {
  await startFresh();
  mockParse.mockResolvedValueOnce(HEARD);
  mockCreate.mockResolvedValueOnce(makePlan({ buying_timeline: '6_12_months', home_type: 'condo' }));
  await describeIt();

  // Echoed verbatim — "$750K", not a normalised "$750,000.00" they never wrote.
  expect(await screen.findByText(/Should we use that as your purchase amount/i)).toBeTruthy();
  expect(screen.getByText('$750K')).toBeTruthy();

  mockUpdate.mockResolvedValueOnce(
    makePlan({
      buying_timeline: '6_12_months',
      home_type: 'condo',
      purchase_range_key: 'custom',
      purchase_basis_cents: 75_000_000,
      estimated_benefit_cents: 421_875,
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: /yes, use \$750K/i }));

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
  // The buyer's string, under the custom band — the same payload the picker's
  // "Enter my own amount" produces. Nothing is parsed on this side.
  expect(mockUpdate).toHaveBeenCalledWith('plan-1', {
    purchase_range_key: 'custom',
    purchase_amount: '$750K',
  });
});

test('declining the heard amount writes nothing and leaves the picker', async () => {
  await startFresh();
  mockParse.mockResolvedValueOnce(HEARD);
  mockCreate.mockResolvedValueOnce(makePlan({ buying_timeline: '6_12_months', home_type: 'condo' }));
  await describeIt();

  fireEvent.click(await screen.findByText('Let me choose'));

  expect(screen.queryByText(/Should we use that as your purchase amount/i)).toBeNull();
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(screen.getByText(/what price range/i)).toBeTruthy();
});

test('an upper bound is reported without an accept button', async () => {
  /*
   * "Under $500K" is a ceiling they named, not a price they intend to pay.
   * Offering to apply it would build the whole preview on the one number the
   * buyer explicitly ruled out, so this branch has no accept control at all.
   */
  await startFresh();
  mockParse.mockResolvedValueOnce({
    ...HEARD,
    prefill: { location_city: 'Toronto' },
    purchase_amount_text: null,
    purchase_amount_cents: 50_000_000,
    amount_is_upper_bound: true,
    requires_amount_confirmation: false,
  });
  mockCreate.mockResolvedValueOnce(makePlan({ location_city: 'Toronto' }));

  await describeIt('Looking under $500k in Toronto');

  expect(await screen.findByText(/that is a limit rather than an amount/i)).toBeTruthy();
  expect(screen.getByText('$500,000')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^yes, use/i })).toBeNull();
});

test('an unusable message says so rather than guessing, and writes nothing', async () => {
  await startFresh();
  mockParse.mockResolvedValueOnce({
    prefill: {},
    purchase_amount_text: null,
    purchase_amount_cents: null,
    amount_is_upper_bound: false,
    requires_amount_confirmation: false,
    is_empty: true,
  });

  await describeIt('hello');

  // A note, not an alert: the buyer did nothing wrong, and the four questions
  // are still right there.
  expect(await screen.findByRole('status')).toBeTruthy();
  expect(mockCreate).not.toHaveBeenCalled();
  expect(screen.getByText('Where are you hoping to buy?')).toBeTruthy();
});

// ── Analytics ───────────────────────────────────────────────────────────────

test('each answered question emits a funnel event', async () => {
  await startFresh();
  await answerLocation();

  expect(mockTrack).toHaveBeenCalledWith('smart_living_intake_started');
  expect(mockTrack).toHaveBeenCalledWith('smart_living_question_answered', {
    question: 'location',
  });
});

test('the range event records whether a figure came back', async () => {
  // The single most useful signal on this screen: how many buyers reach the
  // preview with a dollar amount versus the non-dollar version.
  await startFresh();
  await answerLocation();

  mockUpdate.mockResolvedValueOnce(makePlan({ purchase_range_key: 'not_sure' }));
  fireEvent.click(screen.getByRole('button', { name: /select a price range/i }));
  fireEvent.click(screen.getByText('Not sure yet'));

  await waitFor(() =>
    expect(mockTrack).toHaveBeenCalledWith('smart_living_question_answered', {
      question: 'purchase_range',
      band: 'not_sure',
      custom_amount: false,
      has_estimate: false,
    }),
  );
});
