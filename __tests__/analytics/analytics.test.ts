/**
 * Guards the consent contract (Task 17): nothing is tracked until the visitor
 * accepts, tracking failures never throw into product code, and events carry
 * no PII.
 */

import posthog from 'posthog-js';
import api from '@/lib/axios';
import {
  getAnalyticsConsent,
  initAnalytics,
  setAnalyticsConsent,
  subscribeToConsent,
  track,
} from '@/lib/analytics';

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { init: jest.fn(), capture: jest.fn(), opt_out_capturing: jest.fn(), opt_in_capturing: jest.fn() },
}));
jest.mock('@/lib/analyticsIdentity', () => ({
  registerAnalyticsAnonymousIdentity: jest.fn().mockResolvedValue(null),
  getOrCreateAnalyticsAnonymousId: jest.fn(() => '0d6b19db-8b3e-49d4-8ce2-6f3d4d59e81c'),
}));
jest.mock('@/lib/axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

const mockInit = posthog.init as jest.Mock;
const mockCapture = posthog.capture as jest.Mock;

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  (api.post as jest.Mock).mockResolvedValue({ data: { created: true } });
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true, value: jest.fn(() => 'a440ee2d-37e6-4ced-a5e1-78492873c225'),
  });
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
  track('listing_viewed', { listing_id: 'a440ee2d-37e6-4ced-a5e1-78492873c225' });

  expect(getAnalyticsConsent()).toBe('declined');
  expect(mockInit).not.toHaveBeenCalled();
  expect(mockCapture).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
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

test('a blocked or failing PostHog initialization leaves tracking off without throwing', async () => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
  mockInit.mockImplementation(() => { throw new Error('script blocked'); });
  try {
    setAnalyticsConsent('accepted');
    await expect(initAnalytics()).resolves.toBeUndefined();
    expect(() => track('form_abandoned', { form: 'contact_form' })).not.toThrow();
    expect(mockCapture).not.toHaveBeenCalled();
  } finally {
    mockInit.mockImplementation(() => undefined);
  }
});

test('accepting dynamically loads and initialises posthog', async () => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
  setAnalyticsConsent('accepted');
  await initAnalytics();

  expect(mockInit).toHaveBeenCalledTimes(1);
  expect(mockInit).toHaveBeenCalledWith('phc_test_key', expect.objectContaining({ capture_pageleave: false }));

  track('listing_viewed', { listing_id: 'a440ee2d-37e6-4ced-a5e1-78492873c225' });
  expect(mockCapture).toHaveBeenCalledWith(
    'listing_viewed',
    expect.objectContaining({ listing_id: 'a440ee2d-37e6-4ced-a5e1-78492873c225' }),
  );
  expect(api.post).toHaveBeenCalledWith('/analytics/events', expect.objectContaining({
    event_name: 'listing_viewed', event_version: 1,
    event_id: 'a440ee2d-37e6-4ced-a5e1-78492873c225',
  }));
});

test('revocation stops both providers, and re-acceptance permits approved events again', async () => {
  setAnalyticsConsent('accepted');
  await initAnalytics();
  setAnalyticsConsent('declined');
  track('search_performed');
  expect(api.post).not.toHaveBeenCalled();
  expect(mockCapture).not.toHaveBeenCalled();
  expect(posthog.opt_out_capturing).toHaveBeenCalled();
  setAnalyticsConsent('accepted');
  track('search_performed');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(posthog.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false });
});

test('blocked PostHog and first-party failures are independent', async () => {
  setAnalyticsConsent('accepted');
  (api.post as jest.Mock).mockRejectedValueOnce(new Error('blocked'));
  mockCapture.mockImplementationOnce(() => { throw new Error('blocked'); });
  expect(() => track('search_performed')).not.toThrow();
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('abandonment uses a keepalive first-party request and stays optional', () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  try {
    setAnalyticsConsent('accepted');
    expect(() => track('form_abandoned', { form: 'showing_request' })).not.toThrow();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/analytics/events'),
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  } finally {
    global.fetch = previousFetch;
  }
});

test('unknown or unsafe events are not sent after analytics is initialised', async () => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
  setAnalyticsConsent('accepted');
  await initAnalytics();

  track('undefined_event', { email: 'buyer@example.com' });
  track('listing_viewed', { listing_id: 'listing-1', message: 'private' });

  expect(mockCapture).not.toHaveBeenCalled();
});

test('blocked provider capture cannot break product interactions', async () => {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
  setAnalyticsConsent('accepted');
  await initAnalytics();
  mockCapture.mockImplementationOnce(() => { throw new Error('blocked'); });
  expect(() => track('product_feedback_helpful', { context: 'search', helpful: true })).not.toThrow();
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
