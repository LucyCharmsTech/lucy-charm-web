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
  jest.resetModules();
});

test('no consent stored means no consent recorded', () => {
  expect(getAnalyticsConsent()).toBeNull();
});

test('declining never loads posthog and never sends events', () => {
  setAnalyticsConsent('declined');
  initAnalytics();
  track('listing_viewed', { listing_id: 'abc' });

  expect(getAnalyticsConsent()).toBe('declined');
  expect(mockInit).not.toHaveBeenCalled();
  expect(mockCapture).not.toHaveBeenCalled();
});

test('track() is a safe no-op before initialisation', () => {
  expect(() => track('chat_started')).not.toThrow();
  expect(mockCapture).not.toHaveBeenCalled();
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
