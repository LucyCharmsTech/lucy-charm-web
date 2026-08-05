import {
  BadgeCheckIcon,
  BellIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import type { NotificationEventType } from '@/types/api';

type NotificationVisual = {
  Icon: LucideIcon;
  /** Tone for the icon chip only — copy always comes from title/body. */
  tone: string;
};

/**
 * Per-event-type presentation, as one lookup table rather than conditionals in the
 * item component — the STATUS_STYLES approach from app/agent/showings/page.tsx.
 * Icon and tone share a record so the two can never drift apart.
 */
const VISUALS: Record<NotificationEventType, NotificationVisual> = {
  'showing.requested': {
    Icon: CalendarPlusIcon,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  'showing.confirmed': {
    Icon: CalendarCheckIcon,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  'showing.rescheduled': {
    Icon: CalendarClockIcon,
    tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  'report.status_updated': {
    Icon: BadgeCheckIcon,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
};

const FALLBACK: NotificationVisual = {
  Icon: BellIcon,
  tone: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
};

/**
 * `event_type` is an open set — the API ships new values without a frontend
 * release, so an unknown type must render neutrally rather than blow up on a
 * missing lookup.
 */
export function notificationVisual(eventType: string): NotificationVisual {
  return VISUALS[eventType as NotificationEventType] ?? FALLBACK;
}
