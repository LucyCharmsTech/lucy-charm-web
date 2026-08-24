'use client';

/**
 * The expanded Property Checkup — opens inline on tap (Clarifications Part 2
 * §10: "no redirect to a separate page or chatbot... inline or in an attached
 * panel/drawer"). Generation happens on this first tap, not on listing load.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2Icon, XIcon } from 'lucide-react';

import { track } from '@/lib/analytics';
import { useAuthStore } from '@/stores/authStore';
import {
  isQuestionSavedLocally,
  removeQuestionLocally,
  saveQuestionLocally,
} from '@/lib/propertyCheckupLocalQuestions';
import {
  addPropertyCheckupQuestion,
  deletePropertyCheckupQuestion,
  fetchMyCheckupQuestions,
  fetchPropertyCheckup,
  requestDeeperReview,
} from '@/services/propertyCheckupService';
import type { PropertyCheckup, PropertyCheckupItem } from '@/types/api';

/** rule_id -> the caller's existing row ids, so button state survives a refresh. */
type ExistingByRule = Record<string, { savedId?: string; showingId?: string }>;

type LoadState = 'loading' | 'ready' | 'unavailable';

type Props = {
  listingId: string;
  onClose: () => void;
};

const LAST_SEEN_STORAGE_PREFIX = 'lucy-property-checkup-last-seen:';

// spec B1 step 9: "show 'Property Checkup updated since your last visit'
// when applicable." Detected client-side by comparing this open's
// `generated_at` against the last one this browser actually saw.
function checkAndRecordUpdated(listingId: string, generatedAt: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = LAST_SEEN_STORAGE_PREFIX + listingId;
  let updated = false;
  try {
    const lastSeen = localStorage.getItem(key);
    updated = Boolean(lastSeen && lastSeen !== generatedAt);
    localStorage.setItem(key, generatedAt);
  } catch {
    // Non-fatal — this is a nice-to-have hint, not a requirement.
  }
  return updated;
}

export default function PropertyCheckupPanel({ listingId, onClose }: Props) {
  const authed = useAuthStore((s) => Boolean(s.accessToken));
  const [state, setState] = useState<LoadState>('loading');
  const [checkup, setCheckup] = useState<PropertyCheckup | null>(null);
  const [updatedSinceLastVisit, setUpdatedSinceLastVisit] = useState(false);
  const [existingByRule, setExistingByRule] = useState<ExistingByRule>({});

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setUpdatedSinceLastVisit(false);
    setExistingByRule({});
    track('property_checkup_opened', { listing_id: listingId });

    // The saved/added rows live in the database, so they must be re-read
    // here — otherwise every refresh resets the buttons to their idle state
    // while the rows still exist. Fetched alongside the Checkup so the items
    // never render in the wrong state first and then flip.
    Promise.all([
      fetchPropertyCheckup(listingId),
      authed
        ? fetchMyCheckupQuestions(listingId).catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([data, questions]) => {
        if (cancelled) return;
        const byRule: ExistingByRule = {};
        for (const q of questions) {
          const entry = byRule[q.source_rule_id] ?? {};
          if (q.kind === 'saved') entry.savedId = q.id;
          else entry.showingId = q.id;
          byRule[q.source_rule_id] = entry;
        }
        setExistingByRule(byRule);
        setCheckup(data);
        setUpdatedSinceLastVisit(checkAndRecordUpdated(listingId, data.generated_at));
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [listingId, authed]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Property Checkup"
      className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
            Property Checkup
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            What stands out, and what may be worth verifying.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Property Checkup"
          className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4" aria-live="polite">
        {state === 'loading' && <CheckupLoading />}
        {state === 'unavailable' && <CheckupUnavailable />}
        {state === 'ready' && updatedSinceLastVisit && (
          <p className="mb-3 rounded-lg bg-primarycolor/10 px-3 py-2 text-xs font-semibold text-primarycolor">
            Property Checkup updated since your last visit
          </p>
        )}
        {state === 'ready' && checkup && (
          <CheckupResult
            listingId={listingId}
            checkup={checkup}
            authed={authed}
            existingByRule={existingByRule}
          />
        )}
      </div>
    </div>
  );
}

function CheckupLoading() {
  return (
    <div className="space-y-2" role="status" aria-label="Loading Property Checkup">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/60"
        />
      ))}
    </div>
  );
}

function CheckupUnavailable() {
  return (
    <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300">
      Property Checkup is temporarily unavailable. Please try again.
    </p>
  );
}

function CheckupResult({
  listingId,
  checkup,
  authed,
  existingByRule,
}: {
  listingId: string;
  checkup: PropertyCheckup;
  authed: boolean;
  existingByRule: ExistingByRule;
}) {
  const [showAll, setShowAll] = useState(false);

  if (checkup.zero_match) {
    return (
      <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300">
        Nothing additional stands out from the listing information available
        right now.
      </p>
    );
  }

  // Spec A1 step 4 / B3: first view caps at `first_view_limit`; "View full
  // checkup" only appears when there is genuinely more to show.
  const visibleItems = showAll ? checkup.items : checkup.items.slice(0, checkup.first_view_limit);
  const hasMore = checkup.items.length > checkup.first_view_limit;

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {visibleItems.map((item) => (
          <CheckupItemRow
            key={item.rule_id}
            listingId={listingId}
            item={item}
            authed={authed}
            existing={existingByRule[item.rule_id]}
          />
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => {
            setShowAll(true);
            track('property_checkup_view_full', { listing_id: listingId });
          }}
          className="text-xs font-semibold text-primarycolor hover:underline"
        >
          View full checkup
        </button>
      )}
      <DeeperReviewCta listingId={listingId} authed={authed} />
    </div>
  );
}

// `'local'` marks a signed-out save with no server-side id to delete by.
type SavedId = string | 'local' | null;

const ACTION_PILL = {
  idle: 'inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800',
  done: 'inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50',
};

function CheckupItemRow({
  listingId,
  item,
  authed,
  existing,
}: {
  listingId: string;
  item: PropertyCheckupItem;
  authed: boolean;
  existing?: { savedId?: string; showingId?: string };
}) {
  const [savedId, setSavedId] = useState<SavedId>(() => {
    if (authed) return existing?.savedId ?? null;
    return isQuestionSavedLocally(listingId, item.rule_id) ? 'local' : null;
  });
  const [showingId, setShowingId] = useState<string | null>(
    () => existing?.showingId ?? null,
  );
  const [busy, setBusy] = useState<'save' | 'unsave' | 'showing' | 'unshowing' | null>(null);

  async function handleSaveQuestion() {
    if (busy) return;
    setBusy('save');
    try {
      if (authed) {
        const created = await addPropertyCheckupQuestion({
          listing_id: listingId,
          source_rule_id: item.rule_id,
          kind: 'saved',
        });
        setSavedId(created.id);
      } else {
        // Clarifications Part 1 §7 — never force sign-in for this action.
        saveQuestionLocally(listingId, item.rule_id);
        setSavedId('local');
      }
      track('property_checkup_question_saved', {
        listing_id: listingId,
        rule_id: item.rule_id,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleUnsaveQuestion() {
    if (busy || !savedId) return;
    setBusy('unsave');
    try {
      if (savedId === 'local') {
        removeQuestionLocally(listingId, item.rule_id);
      } else {
        await deletePropertyCheckupQuestion(savedId);
      }
      setSavedId(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleAddToShowingQuestions() {
    if (busy || !authed) return;
    setBusy('showing');
    try {
      const created = await addPropertyCheckupQuestion({
        listing_id: listingId,
        source_rule_id: item.rule_id,
        kind: 'showing_question',
      });
      setShowingId(created.id);
      track('property_checkup_showing_question_added', {
        listing_id: listingId,
        rule_id: item.rule_id,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveFromShowingQuestions() {
    if (busy || !showingId) return;
    setBusy('unshowing');
    try {
      await deletePropertyCheckupQuestion(showingId);
      setShowingId(null);
    } catch {
      // Already attached to a submitted showing — the backend refuses
      // (403). Nothing to undo; the button stays "Added".
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-xl border border-zinc-200/80 p-4 dark:border-zinc-800/80">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {item.listing_states}
      </p>
      <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
        Worth verifying: {item.worth_verifying}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.why_it_matters}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={savedId ? handleUnsaveQuestion : handleSaveQuestion}
          disabled={busy === 'save' || busy === 'unsave'}
          aria-pressed={Boolean(savedId)}
          className={savedId ? ACTION_PILL.done : ACTION_PILL.idle}
        >
          {savedId ? (
            <>
              <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
              {authed ? 'Saved for later' : 'Saved on this device'}
            </>
          ) : (
            'Save question'
          )}
        </button>

        {authed && (
          <button
            type="button"
            onClick={showingId ? handleRemoveFromShowingQuestions : handleAddToShowingQuestions}
            disabled={busy === 'showing' || busy === 'unshowing'}
            aria-pressed={Boolean(showingId)}
            className={showingId ? ACTION_PILL.done : ACTION_PILL.idle}
          >
            {showingId ? (
              <>
                <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                Added to showing questions
              </>
            ) : (
              'Add to showing questions'
            )}
          </button>
        )}
      </div>
      {!authed && savedId && (
        <p className="mt-2 text-[11px] text-zinc-400">
          Sign in to keep it across devices.
        </p>
      )}
    </li>
  );
}

function DeeperReviewCta({ listingId, authed }: { listingId: string; authed: boolean }) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (submitted) {
    return (
      <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
        Your request has been received. We&apos;ll get back to you shortly and
        notify you when there&apos;s an update.
      </p>
    );
  }

  if (!authed) {
    return (
      <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300">
        Interested in this property? Sign in to request a Deeper Property
        Review.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-primarycolor/30 bg-primarycolor/5 px-4 py-3 text-left text-sm font-semibold text-primarycolor hover:bg-primarycolor/10"
      >
        Interested in this property? Want us to look deeper? Request a Deeper
        Property Review.
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await requestDeeperReview({ listing_id: listingId, questions: questions.trim() || undefined });
      setSubmitted(true);
      track('property_checkup_deeper_review_requested', { listing_id: listingId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200/80 p-4 dark:border-zinc-800/80"
    >
      <label
        htmlFor="deeper-review-questions"
        className="text-xs font-semibold text-zinc-700 dark:text-zinc-200"
      >
        Anything specific you&apos;d like us to look into? (optional)
      </label>
      <textarea
        id="deeper-review-questions"
        value={questions}
        onChange={(e) => setQuestions(e.target.value)}
        rows={3}
        maxLength={4000}
        className="mt-2 w-full rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primarycolor px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </form>
  );
}
