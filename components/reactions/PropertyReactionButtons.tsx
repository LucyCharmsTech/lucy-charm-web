'use client';

import { useEffect, useState } from 'react';
import { HeartIcon, HelpCircleIcon, LoaderIcon, XIcon } from 'lucide-react';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import {
  REACTIONS,
  REACTION_DESCRIPTIONS,
  REACTION_LABELS,
  clearMyReaction,
  fetchMyReaction,
  setMyReaction,
} from '@/services/propertyReactionsService';
import { useAuthStore } from '@/stores/authStore';
import type { PropertyReaction } from '@/types/api';

/**
 * Love / Maybe / Not for me — three buttons on a property.
 *
 * Controls 6.10 and 6.11. The client's description is the specification:
 *
 *   "A buyer picks one, it replaces whatever they picked before, and they can
 *    change or clear it at any time — one state per property, always
 *    reversible. Love saves the property to their favourites. Maybe keeps it
 *    on a shortlist without committing, so it stays visible while they decide.
 *    Not for me hides it from their browsing so it stops reappearing, with an
 *    undo in case it was tapped by accident."
 *
 * Three behaviours follow, and each is deliberate:
 *
 * **Pressing the active reaction clears it.** "Change or clear it at any time"
 * needs a way to get back to no reaction, and a fourth "None" button would be
 * clutter for something a second press expresses naturally.
 *
 * **Not for me shows an undo rather than acting silently.** It is the only
 * destructive-feeling one — the property leaves the list under the buyer's
 * finger — and the client asked for the undo by name.
 *
 * **Nothing is inferred.** 6.11 forbids reading affordability, urgency or
 * agent value from any of this, so the only analytics event records that a
 * reaction was set, never a score or a ranking.
 */

const ICONS: Record<PropertyReaction, typeof HeartIcon> = {
  love: HeartIcon,
  maybe: HelpCircleIcon,
  not_for_me: XIcon,
};

type PropertyReactionButtonsProps = {
  listingId: string;
  /** Fires after any change, so a list can drop a hidden card. */
  onChange?: (next: PropertyReaction | null) => void;
  className?: string;
};

export function PropertyReactionButtons({
  listingId,
  onChange,
  className,
}: PropertyReactionButtonsProps) {
  const authed = useAuthStore((s) => Boolean(s.accessToken));
  const [reaction, setReaction] = useState<PropertyReaction | null>(null);
  const [pending, setPending] = useState<PropertyReaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justHidden, setJustHidden] = useState(false);

  useEffect(() => {
    if (!authed) return;
    let active = true;
    fetchMyReaction(listingId)
      .then((row) => {
        if (active) setReaction(row?.reaction ?? null);
      })
      .catch(() => {
        // A failed read leaves the buttons unset rather than blocking the
        // property. Reacting still works.
      });
    return () => {
      active = false;
    };
  }, [authed, listingId]);

  if (!authed) return null;

  async function choose(next: PropertyReaction) {
    // A second press on the active one clears it.
    const clearing = reaction === next;
    setPending(next);
    setError(null);
    setJustHidden(false);
    try {
      if (clearing) {
        await clearMyReaction(listingId);
        setReaction(null);
        onChange?.(null);
      } else {
        await setMyReaction(listingId, next);
        setReaction(next);
        onChange?.(next);
        if (next === 'not_for_me') setJustHidden(true);
      }
      track('property_reaction_set', {
        listing_id: listingId,
        reaction: clearing ? null : next,
      });
    } catch {
      setError('Could not save that. Please try again.');
    } finally {
      setPending(null);
    }
  }

  async function undoHide() {
    setPending('not_for_me');
    setError(null);
    try {
      await clearMyReaction(listingId);
      setReaction(null);
      setJustHidden(false);
      onChange?.(null);
    } catch {
      setError('Could not undo that. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="How do you feel about this home?"
      >
        {REACTIONS.map((option) => {
          const Icon = ICONS[option];
          const active = reaction === option;
          const busy = pending === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => void choose(option)}
              disabled={pending !== null}
              // `aria-pressed` is what tells a screen reader this is a
              // toggle showing current state, not a plain action.
              aria-pressed={active}
              title={
                active
                  ? `${REACTION_LABELS[option]} — press again to clear`
                  : REACTION_DESCRIPTIONS[option]
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60',
                active
                  ? 'border-primarycolor bg-primarycolor/10 text-primarycolor-text'
                  : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
              )}
            >
              {busy ? (
                <LoaderIcon className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Icon
                  className={cn('size-3.5', active && option === 'love' && 'fill-current')}
                  aria-hidden="true"
                />
              )}
              {REACTION_LABELS[option]}
            </button>
          );
        })}
      </div>

      {justHidden && (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400"
        >
          Hidden from your browsing.
          <button
            type="button"
            onClick={() => void undoHide()}
            disabled={pending !== null}
            className="font-semibold text-primarycolor-text hover:underline disabled:opacity-60"
          >
            Undo
          </button>
        </p>
      )}

      {reaction === 'love' && !justHidden && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Saved to your favourites.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
