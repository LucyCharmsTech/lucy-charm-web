/**
 * Guards the consent contract (Task 17): nothing is tracked until the visitor
 * accepts, tracking failures never throw into product code, and events carry
 * no PII.
 */

import posthog from 'posthog-js';
import {
  getAnalyticsConsent,
  initAnalytics,
  setAnalyticsConsent,
  subscribeToConsent,
  track,
} from '@/lib/analytics';

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { init: jest.fn(), capture: jest.fn() },
}));

const mockInit = posthog.init as jest.Mock;
const mockCapture = posthog.capture as jest.Mock;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  // Deliberately NOT jest.resetModules(): `initAnalytics()` reaches
  // posthog-js through a dynamic import, so resetting the registry would
  // hand it a different mock instance than the one asserted on here.
});

test('no consent stored means no consent recorded', () => {
  expect(getAnalyticsConsent()).toBeNull();
});

test('declining never loads posthog and never sends events', async () => {
  setAnalyticsConsent('declined');
  await initAnalytics();
  track('listing_viewed', { listing_id: 'abc' });

  expect(getAnalyticsConsent()).toBe('declined');
  expect(mockInit).not.toHaveBeenCalled();
  expect(mockCapture).not.toHaveBeenCalled();
});

test('track() is a safe no-op before initialisation', () => {
  expect(() => track('chat_started')).not.toThrow();
  expect(mockCapture).not.toHaveBeenCalled();
});

test('a storage read that throws reads as "no consent" rather than crashing', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });

  expect(() => getAnalyticsConsent()).not.toThrow();
  expect(getAnalyticsConsent()).toBeNull();

  spy.mockRestore();
});

test('a storage write that throws does not break accepting consent', () => {
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage full');
  });

  expect(() => setAnalyticsConsent('accepted')).not.toThrow();

  spy.mockRestore();
});

// Runs before any test below sets `initialized`, since the flag is a
// module-level singleton that (by design) survives for the life of the page.
test('with no key configured, posthog never loads even after acceptance', async () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  setAnalyticsConsent('accepted');
  await initAnalytics();

  expect(mockInit).not.toHaveBeenCalled();
});

test('accepting dynamically loads and initialises posthog', async () => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
  setAnalyticsConsent('accepted');
  await initAnalytics();

  expect(mockInit).toHaveBeenCalledTimes(1);

  track('listing_viewed', { listing_id: 'abc' });
  expect(mockCapture).toHaveBeenCalledWith(
    'listing_viewed',
    expect.objectContaining({ listing_id: 'abc' }),
  );
});

test('consent subscribers are notified when the choice changes', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeToConsent(listener);

  setAnalyticsConsent('declined');
  expect(listener).toHaveBeenCalledTimes(1);

  unsubscribe();
  setAnalyticsConsent('accepted');
  expect(listener).toHaveBeenCalledTimes(1); // no longer subscribed
});

test('accepting persists the choice so the banner stays hidden', () => {
  setAnalyticsConsent('accepted');
  expect(getAnalyticsConsent()).toBe('accepted');
});
