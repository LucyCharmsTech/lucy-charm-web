import { analyticsRouteFamily } from '@/lib/analyticsRoutes';
import { isApprovedBrowserAnalyticsEvent } from '@/lib/analyticsContract';

test.each([
  ['/listings/real-property-id?campaign=private#contact', '/listings/[id]'],
  ['/documents/492eab1d-9200-4881-b82e-a1e0882d3999', '/documents/[id]'],
  ['/admin/inquiries/private-lead', '/admin/inquiries/[id]'],
  ['/seller-portal/private-transaction', '/seller-portal/[id]'],
  ['/agent/listings/private-listing', '/agent/listings/[id]'],
])('normalizes %s to %s', (path, family) => {
  expect(analyticsRouteFamily(path)).toBe(family);
});

test('unknown routes fail closed and raw IDs cannot be pageview properties', () => {
  expect(analyticsRouteFamily('/unknown/private-id')).toBeNull();
  expect(isApprovedBrowserAnalyticsEvent('$pageview', {
    $current_url: `${window.location.origin}/documents/private-id`,
  })).toBe(false);
  expect(isApprovedBrowserAnalyticsEvent('$pageview', {
    $current_url: `${window.location.origin}/documents/[id]`,
  })).toBe(true);
});
