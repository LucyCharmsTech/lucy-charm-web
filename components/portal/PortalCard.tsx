'use client';

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  LockIcon,
  ShieldOffIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The nine card states, defined once — control 6.14.
 *
 * *"Each card/page defines **loading, empty, success, pending, no-action-needed,
 * unavailable, locked, expired and permission-denied** states."*
 *
 * Defined here rather than per card because nine states written nine times
 * become nine slightly different vocabularies: one card says "Not available",
 * the next says "Unavailable", a third silently renders nothing. A shared
 * component is the only way "each card defines these states" stays true as
 * cards are added.
 *
 * The distinctions that matter, and that a screen would otherwise blur:
 *
 * **empty vs. no-action-needed.** "You have no saved homes" invites an action.
 * "Nothing needs your attention" says the opposite. Collapsing them into one
 * empty state makes a finished checklist look like a broken one.
 *
 * **locked vs. permission-denied.** *Locked* is "not yet" — a gate that will
 * open. *Permission denied* is "not yours". Telling someone to wait for
 * something they will never be allowed to see is worse than saying no.
 *
 * **unavailable vs. expired.** *Unavailable* is our fault and worth retrying.
 * *Expired* is time passing and needs a new request. Offering "try again" on
 * an expired thing wastes the reader's time.
 */

export type PortalCardState =
  | 'loading'
  | 'empty'
  | 'success'
  | 'pending'
  | 'no_action_needed'
  | 'unavailable'
  | 'locked'
  | 'expired'
  | 'permission_denied';

/** Every state, so a test can assert none is missing. */
export const PORTAL_CARD_STATES: PortalCardState[] = [
  'loading',
  'empty',
  'success',
  'pending',
  'no_action_needed',
  'unavailable',
  'locked',
  'expired',
  'permission_denied',
];

type StatePresentation = {
  /** Fallback wording. A caller may always pass something more specific. */
  message: string;
  icon: typeof ClockIcon | null;
  tone: string;
  /** Whether offering a retry makes sense at all. */
  retryable: boolean;
};

const PRESENTATION: Record<PortalCardState, StatePresentation> = {
  loading: {
    message: 'Loading…',
    icon: null,
    tone: 'text-zinc-500 dark:text-zinc-400',
    retryable: false,
  },
  empty: {
    message: 'Nothing here yet.',
    icon: null,
    tone: 'text-zinc-500 dark:text-zinc-400',
    retryable: false,
  },
  success: {
    message: 'Done.',
    icon: CheckCircle2Icon,
    tone: 'text-emerald-700 dark:text-emerald-400',
    retryable: false,
  },
  pending: {
    message: 'Waiting on us — we will let you know.',
    icon: ClockIcon,
    tone: 'text-amber-700 dark:text-amber-400',
    retryable: false,
  },
  no_action_needed: {
    // Deliberately not "empty": nothing to do is a good outcome, not a gap.
    message: 'Nothing needs your attention right now.',
    icon: CheckCircle2Icon,
    tone: 'text-emerald-700 dark:text-emerald-400',
    retryable: false,
  },
  unavailable: {
    message: 'This is temporarily unavailable.',
    icon: AlertTriangleIcon,
    tone: 'text-amber-700 dark:text-amber-400',
    retryable: true,
  },
  locked: {
    // "Not yet", not "not yours".
    message: 'This unlocks once an earlier step is complete.',
    icon: LockIcon,
    tone: 'text-zinc-600 dark:text-zinc-400',
    retryable: false,
  },
  expired: {
    // Time passing, not a fault. A retry would not help; a new request would.
    message: 'This has expired. Please request a new one.',
    icon: ClockIcon,
    tone: 'text-zinc-600 dark:text-zinc-400',
    retryable: false,
  },
  permission_denied: {
    message: 'You do not have access to this.',
    icon: ShieldOffIcon,
    tone: 'text-zinc-600 dark:text-zinc-400',
    retryable: false,
  },
};

export function portalStateMessage(state: PortalCardState): string {
  return PRESENTATION[state].message;
}

export function isRetryable(state: PortalCardState): boolean {
  return PRESENTATION[state].retryable;
}

type PortalCardProps = {
  title: string;
  description?: string;
  state: PortalCardState;
  /** Overrides the default wording for this state. */
  message?: string;
  /** Offered only where a retry could actually help — see `isRetryable`. */
  onRetry?: () => void;
  /** Rendered instead of a state message when the state is `success`. */
  children?: React.ReactNode;
  className?: string;
};

export function PortalCard({
  title,
  description,
  state,
  message,
  onRetry,
  children,
  className,
}: PortalCardProps) {
  const presentation = PRESENTATION[state];
  const Icon = presentation.icon;
  const showContent = state === 'success' && children;

  return (
    <section
      className={cn(
        'rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40',
        className,
      )}
      aria-busy={state === 'loading'}
      aria-label={title}
    >
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      )}

      {showContent ? (
        <div className="mt-4">{children}</div>
      ) : (
        <p
          className={cn('mt-4 inline-flex items-center gap-2 text-sm', presentation.tone)}
          // `status` for the benign states, `alert` only where something is
          // actually wrong — a screen reader should not be interrupted to be
          // told there is nothing to do.
          role={state === 'unavailable' ? 'alert' : 'status'}
        >
          {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
          {message ?? presentation.message}
        </p>
      )}

      {/* Only where retrying could help. Not on expired, locked or denied. */}
      {presentation.retryable && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Try again
        </button>
      )}
    </section>
  );
}
