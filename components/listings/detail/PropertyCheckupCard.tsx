'use client';

/**
 * The quiet, always-available Property Checkup teaser (spec A3: "Do not hide
 * the feature until an interest trigger; it should always be quietly
 * available"). No API call on mount — generation only happens once the panel
 * opens (Clarifications Part 2 §10).
 *
 * Interest signals (Clarifications Part 1 §9): Save + Revisit only, both
 * launch signals. "Revisit" here is the second view of this listing ever, per
 * browser — the client has not yet specified a time window, so this is the
 * simplest reading and easy to change without touching layout.
 */

import { useEffect, useRef, useState } from 'react';
import { SearchCheckIcon } from 'lucide-react';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/stores/authStore';
import { checkListingSaved } from '@/services/savedListingsService';
import { syncLocalQuestionsToAccount } from '@/lib/propertyCheckupLocalQuestions';
import PropertyCheckupPanel from '@/components/listings/detail/PropertyCheckupPanel';

const REVISIT_STORAGE_PREFIX = 'lucy-property-checkup-viewed:';

function markVisitAndCheckRevisit(listingId: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = REVISIT_STORAGE_PREFIX + listingId;
  const seen = localStorage.getItem(key) === '1';
  if (!seen) {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // Non-fatal — prominence is a nice-to-have, not a requirement.
    }
  }
  return seen;
}

type Props = {
  listingId: string;
};

type ProminentReason = 'saved' | 'revisit' | null;

export default function PropertyCheckupCard({ listingId }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [open, setOpen] = useState(false);
  const [prominentReason, setProminentReason] = useState<ProminentReason>(null);
  const syncedForToken = useRef<string | null>(null);

  useEffect(() => {
    const isRevisit = markVisitAndCheckRevisit(listingId);
    if (isRevisit) {
      setProminentReason('revisit');
      // Clarifications Part 2 §12: "listing saved/revisited" is one of the
      // events Property Checkup analytics should capture.
      track('property_checkup_interest_signal', { listing_id: listingId, reason: 'revisit' });
      return;
    }
    // "Save" signal: ask the server directly rather than tracking a local
    // flag, since a listing can already be saved from a prior session.
    let cancelled = false;
    checkListingSaved(listingId)
      .then((r) => {
        if (!cancelled && r.saved) {
          setProminentReason('saved');
          track('property_checkup_interest_signal', { listing_id: listingId, reason: 'saved' });
        }
      })
      .catch(() => {
        // A failed check just means the card stays in its default state.
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  useEffect(() => {
    if (!accessToken || syncedForToken.current === accessToken) return;
    syncedForToken.current = accessToken;
    void syncLocalQuestionsToAccount();
  }, [accessToken]);

  return (
    <>
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={
            prominentReason
              ? 'flex w-full items-center gap-3 rounded-xl border border-primarycolor/30 bg-primarycolor/5 p-4 text-left hover:bg-primarycolor/10'
              : 'flex w-full items-center gap-3 rounded-xl p-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
          }
        >
          <SearchCheckIcon
            className="size-5 shrink-0 text-primarycolor"
            aria-hidden="true"
          />
          <span>
            <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Property Checkup
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              {prominentReason === 'saved'
                ? 'Saved this home? See what may be worth verifying.'
                : prominentReason === 'revisit'
                  ? 'Taking another look? Review the Property Checkup.'
                  : 'See what stands out and what may be worth verifying.'}
            </span>
          </span>
        </button>
      </section>

      {open && (
        <PropertyCheckupPanel listingId={listingId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
