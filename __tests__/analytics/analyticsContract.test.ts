import { isApprovedBrowserAnalyticsEvent } from '@/lib/analyticsContract';

describe('browser analytics contract', () => {
  test('accepts an existing approved event and exact properties', () => {
    expect(isApprovedBrowserAnalyticsEvent('listing_viewed', { listing_id: 'a440ee2d-37e6-4ced-a5e1-78492873c225' })).toBe(true);
  });

  test('rejects undefined, missing, unknown, and private payloads', () => {
    expect(isApprovedBrowserAnalyticsEvent('not_defined', {})).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('listing_viewed', {})).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('listing_viewed', { listing_id: 'listing-123', extra: 'nope' })).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('listing_viewed', { listing_id: 'listing-123', email: 'buyer@example.com' })).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('listing_viewed', { listing_id: 'Bearer secret-token' })).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('listing_viewed', { listing_id: '15551234567' })).toBe(false);
  });

  test('feedback and abandonment accept only coarse approved values', () => {
    expect(isApprovedBrowserAnalyticsEvent('product_feedback_helpful', { context: 'listing', helpful: false })).toBe(true);
    expect(isApprovedBrowserAnalyticsEvent('product_feedback_helpful', { context: '/listings/123', helpful: true })).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('product_feedback_helpful', { context: 'listing', helpful: 'yes' })).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('product_problem_reported', { context: 'home_value', category: 'bug' })).toBe(true);
    expect(isApprovedBrowserAnalyticsEvent('product_problem_reported', { context: 'home_value', category: 'bug', description: 'private' })).toBe(false);
    expect(isApprovedBrowserAnalyticsEvent('form_abandoned', { form: 'contact_form' })).toBe(true);
    expect(isApprovedBrowserAnalyticsEvent('form_abandoned', { form: 'home_value', address: 'private' })).toBe(false);
  });
});
