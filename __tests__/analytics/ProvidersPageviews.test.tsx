import { act, render, waitFor } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Providers from '@/components/Providers';
import { initAnalytics, trackPageview } from '@/lib/analytics';

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }));
jest.mock('next/dynamic', () => ({ __esModule: true, default: () => () => null }));
jest.mock('@react-oauth/google', () => ({ GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { accessToken: null; user: null }) => unknown) =>
    selector({ accessToken: null, user: null }),
}));
jest.mock('@/lib/analytics', () => ({
  initAnalytics: jest.fn(), trackPageview: jest.fn(), setAnalyticsAudience: jest.fn(),
  subscribeToConsent: jest.fn(() => () => {}),
  getConsentSnapshot: jest.fn(() => 'accepted'),
  getConsentServerSnapshot: jest.fn(() => 'unknown'),
}));

const pathname = usePathname as jest.Mock;
const init = initAnalytics as jest.Mock;
const pageview = trackPageview as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  pathname.mockReturnValue('/listings/private-id');
});

test('waits for initialization, emits initial pageview once, then follows navigation', async () => {
  let ready!: () => void;
  init.mockReturnValue(new Promise<void>((resolve) => { ready = resolve; }));
  const view = render(<Providers>content</Providers>);
  expect(pageview).not.toHaveBeenCalled();
  await act(async () => { ready(); });
  await waitFor(() => expect(pageview).toHaveBeenCalledTimes(1));
  expect(pageview).toHaveBeenCalledWith('/listings/private-id');
  view.rerender(<Providers>content</Providers>);
  expect(pageview).toHaveBeenCalledTimes(1);
  pathname.mockReturnValue('/contact');
  init.mockResolvedValue(undefined);
  view.rerender(<Providers>content</Providers>);
  await waitFor(() => expect(pageview).toHaveBeenCalledTimes(2));
  expect(pageview).toHaveBeenLastCalledWith('/contact');
});
