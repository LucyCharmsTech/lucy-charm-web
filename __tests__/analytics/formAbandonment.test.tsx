import { act, renderHook } from '@testing-library/react';
import { useFormAbandonment } from '@/lib/useFormAbandonment';
import { getAnalyticsConsent, track } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({
  getAnalyticsConsent: jest.fn(), track: jest.fn(),
}));

const consent = getAnalyticsConsent as jest.Mock;
const capture = track as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  consent.mockReturnValue('accepted');
});

test('untouched form produces no abandonment event', () => {
  const { unmount } = renderHook(() => useFormAbandonment('contact_form'));
  unmount();
  expect(capture).not.toHaveBeenCalled();
});

test('meaningful start then leave produces one coarse event, no form values', () => {
  const { result, unmount } = renderHook(() => useFormAbandonment('home_value'));
  act(() => result.current.markStarted());
  act(() => window.dispatchEvent(new Event('pagehide')));
  unmount();
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith('form_abandoned', { form: 'home_value' });
});

test('successful submission and intentional sign-in navigation do not count as abandonment', () => {
  const success = renderHook(() => useFormAbandonment('contact_form'));
  act(() => { success.result.current.markStarted(); success.result.current.markSucceeded(); });
  success.unmount();
  const signin = renderHook(() => useFormAbandonment('home_value'));
  act(() => { signin.result.current.markStarted(); signin.result.current.markPaused(); });
  signin.unmount();
  expect(capture).not.toHaveBeenCalled();
});

test('no consent suppresses abandonment even if the user later leaves', () => {
  consent.mockReturnValue('declined');
  const { result, unmount } = renderHook(() => useFormAbandonment('contact_form'));
  act(() => result.current.markStarted());
  unmount();
  expect(capture).not.toHaveBeenCalled();
});

test('showing close and pagehide are one coarse event; reopening resets the attempt', () => {
  const { result, unmount } = renderHook(() => useFormAbandonment('showing_request'));
  act(() => result.current.markAbandoned());
  expect(capture).not.toHaveBeenCalled();
  act(() => { result.current.markStarted(); result.current.markAbandoned(); });
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith('form_abandoned', { form: 'showing_request' });
  act(() => { result.current.reset(); result.current.markStarted(); result.current.markSucceeded(); });
  unmount();
  expect(capture).toHaveBeenCalledTimes(1);
});
