/**
 * The banner shows only when no choice has been made, and disappears for good
 * once the visitor accepts or declines.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import CookieConsentBanner from '@/components/common/CookieConsentBanner';

beforeEach(() => {
  localStorage.clear();
});

test('shows to a first-time visitor', () => {
  render(<CookieConsentBanner />);
  expect(screen.getByRole('dialog', { name: 'Cookie consent' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Decline' })).toBeTruthy();
});

test('hides after accepting and records the choice', () => {
  render(<CookieConsentBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

  expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).toBeNull();
  expect(localStorage.getItem('lucy-analytics-consent')).toBe('accepted');
});

test('hides after declining and records the choice', () => {
  render(<CookieConsentBanner />);
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

  expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).toBeNull();
  expect(localStorage.getItem('lucy-analytics-consent')).toBe('declined');
});

test('never re-appears for a visitor who already chose', () => {
  localStorage.setItem('lucy-analytics-consent', 'declined');
  render(<CookieConsentBanner />);
  expect(screen.queryByRole('dialog', { name: 'Cookie consent' })).toBeNull();
});
