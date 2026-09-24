import type { ShowingRequestStatus } from '@/types/api';

const STATUS_LABELS: Record<ShowingRequestStatus, string> = {
  requested: 'Requested',
  being_arranged: 'Being Arranged',
  awaiting_confirmation: 'Awaiting Confirmation',
  confirmed: 'Confirmed',
  reschedule_needed: 'Reschedule Needed',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export function showingStatusLabel(status: ShowingRequestStatus): string {
  return STATUS_LABELS[status];
}

/**
 * Render the canonical UTC timestamp in the viewer's browser timezone. The
 * short timezone name is deliberate: no brokerage timezone is configured for
 * showings, so the UI must not silently claim a Toronto-local time.
 */
export type ShowingDateTimeParts = {
  date: string;
  time: string;
  timezone: string;
};

/**
 * Keep the three operational parts separate so dense staff views can wrap
 * them without dropping either the time or the browser-local timezone.
 */
export function formatShowingDateTimeParts(value: string): ShowingDateTimeParts {
  const timestamp = new Date(value);
  const date = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(timestamp);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
  const timezone = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    timeZoneName: 'short',
  })
    .formatToParts(timestamp)
    .find((part) => part.type === 'timeZoneName')?.value
    ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  return { date, time, timezone };
}

export function formatShowingDateTime(value: string): string {
  const { date, time, timezone } = formatShowingDateTimeParts(value);
  return `${date}, ${time} ${timezone}`;
}
