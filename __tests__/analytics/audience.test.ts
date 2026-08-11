/**
 * The audience segment attached to every event: signed-in versus not, and
 * which role, so staff browsing can be filtered out of visitor numbers.
 *
 * The hard rule these tests defend: it is a SEGMENT, never an IDENTITY. No
 * user id, email, or name may appear, and `posthog.identify` must never be
 * called.
 */

import posthog from 'posthog-js';
import {
  getAnalyticsAudience,
  initAnalytics,
  setAnalyticsAudience,
  setAnalyticsConsent,
  track,
} from '@/lib/analytics';

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { init: jest.fn(), capture: jest.fn(), identify: jest.fn() },
}));

const mockCapture = posthog.capture as jest.Mock;
const mockIdentify = posthog.identify as jest.Mock;

/** posthog-js is mocked, so init() only flips our internal flag. */
function enableTracking() {
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key';
  setAnalyticsConsent('accepted');
  initAnalytics();
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  setAnalyticsAudience(null);
});

test('defaults to an anonymous visitor', () => {
  expect(getAnalyticsAudience()).toEqual({
    is_authenticated: false,
    user_role: 'visitor',
  });
});

test('signing out resets to visitor', () => {
  setAnalyticsAudience('agent');
  setAnalyticsAudience(null);
  expect(getAnalyticsAudience()).toEqual({
    is_authenticated: false,
    user_role: 'visitor',
  });
});

test.each([
  ['client', true],
  ['agent', true],
  ['superadmin', true],
] as const)('role %s is marked authenticated', (role, authed) => {
  setAnalyticsAudience(role);
  expect(getAnalyticsAudience()).toEqual({ is_authenticated: authed, user_role: role });
});

test('every event carries the audience segment', () => {
  enableTracking();
  setAnalyticsAudience('agent');
  track('listing_viewed', { listing_id: 'abc-123' });

  expect(mockCapture).toHaveBeenCalledWith('listing_viewed', {
    is_authenticated: true,
    user_role: 'agent',
    listing_id: 'abc-123',
  });
});

test('anonymous events are labelled as visitor', () => {
  enableTracking();
  track('chat_started', { surface: 'general' });

  expect(mockCapture).toHaveBeenCalledWith('chat_started', {
    is_authenticated: false,
    user_role: 'visitor',
    surface: 'general',
  });
});

test('call sites can never leak PII through the audience segment', () => {
  enableTracking();
  setAnalyticsAudience('client');
  track('showing_requested', { listing_id: 'abc' });

  const [, props] = mockCapture.mock.calls[0];
  const serialised = JSON.stringify(props);
  for (const forbidden of ['email', 'first_name', 'last_name', 'user_id', 'phone', 'score']) {
    expect(serialised).not.toContain(forbidden);
  }
});

test('we never identify a person in PostHog', () => {
  enableTracking();
  setAnalyticsAudience('superadmin');
  track('search_performed', { city: 'Calgary' });

  expect(mockIdentify).not.toHaveBeenCalled();
});
