const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact "time since" label for notification timestamps.
 * Falls back to an absolute date past a week, where "9d ago" stops being useful.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const elapsed = Date.now() - then;
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;

  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Full timestamp for the `title` tooltip on a relative label. */
export function formatAbsoluteTime(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  return then.toLocaleString();
}
