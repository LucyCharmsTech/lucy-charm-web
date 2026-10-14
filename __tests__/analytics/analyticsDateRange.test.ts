import { localDateTimeToUtc } from '@/lib/analyticsDateRange';

const expectedByTimezone: Record<string, string> = {
  UTC: '2026-10-13T12:00:00.000Z',
  'Africa/Addis_Ababa': '2026-10-13T09:00:00.000Z',
  'America/Los_Angeles': '2026-10-13T19:00:00.000Z',
};

test('converts a browser-local time to the UTC instant for this test process timezone', () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const expected = expectedByTimezone[timezone] ?? new Date('2026-10-13T12:00').toISOString();
  expect(localDateTimeToUtc('2026-10-13T12:00')).toBe(expected);
});

test('an unselected bound remains absent', () => {
  expect(localDateTimeToUtc('')).toBeUndefined();
});
