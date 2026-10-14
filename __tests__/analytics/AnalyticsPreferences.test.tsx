import { fireEvent, render, screen } from '@testing-library/react';
import AnalyticsPreferences from '@/components/common/AnalyticsPreferences';
import Footer from '@/components/Footer';
import { getAnalyticsConsent, track } from '@/lib/analytics';
import api from '@/lib/axios';

jest.mock('@/lib/analyticsIdentity', () => ({
  registerAnalyticsAnonymousIdentity: jest.fn().mockResolvedValue(null),
  getOrCreateAnalyticsAnonymousId: jest.fn(() => null),
}));
jest.mock('@/lib/axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  (api.post as jest.Mock).mockResolvedValue({ data: { created: true } });
});

test('the footer keeps analytics preferences discoverable after the banner closes', () => {
  render(<Footer />);
  expect(screen.getByRole('link', { name: 'Analytics preferences' }).getAttribute('href'))
    .toBe('/privacy#analytics-preferences');
});

test('a first-time visitor can accept, withdraw, and accept again', () => {
  render(<AnalyticsPreferences />);
  expect(screen.getByText(/not yet chosen/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));
  expect(getAnalyticsConsent()).toBe('accepted');
  track('search_performed');
  expect(api.post).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Withdraw analytics consent' }));
  expect(getAnalyticsConsent()).toBe('declined');
  track('search_performed');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/analytics is off/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));
  expect(getAnalyticsConsent()).toBe('accepted');
  track('search_performed');
  expect(api.post).toHaveBeenCalledTimes(2);
});

test('decline and withdrawal persist when preferences remount after reload', () => {
  const first = render(<AnalyticsPreferences />);
  fireEvent.click(screen.getByRole('button', { name: 'Decline analytics' }));
  first.unmount();
  render(<AnalyticsPreferences />);
  expect(screen.getByText(/analytics is off/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Decline analytics' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw analytics consent' }));
  expect(localStorage.getItem('lucy-analytics-consent')).toBe('declined');
});
