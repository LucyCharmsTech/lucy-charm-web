import {
  formatShowingDateTime,
  formatShowingDateTimeParts,
  showingStatusLabel,
} from '@/lib/showingPresentation';

test('showing statuses use readable customer/staff labels', () => {
  expect(showingStatusLabel('awaiting_confirmation')).toBe('Awaiting Confirmation');
  expect(showingStatusLabel('reschedule_needed')).toBe('Reschedule Needed');
});

test('showing times include full date, time, and an explicit browser timezone', () => {
  const result = formatShowingDateTime('2026-10-10T15:30:00Z');
  expect(result).toMatch(/2026/);
  expect(result).toMatch(/\d{1,2}:\d{2}/);
  // Intl's browser-local short zone is intentionally displayed rather than a
  // hard-coded brokerage city.
  expect(result).toMatch(/[A-Z]{2,}|GMT|UTC/);
});

test('showing times expose individually renderable date, time, and timezone parts', () => {
  const result = formatShowingDateTimeParts('2026-10-10T15:30:00Z');

  expect(result.date).toMatch(/2026/);
  expect(result.time).toMatch(/\d{1,2}:\d{2}/);
  expect(result.timezone).toMatch(/\S/);
});
