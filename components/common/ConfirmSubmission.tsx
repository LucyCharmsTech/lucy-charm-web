'use client';

import { useState } from 'react';
import { AlertCircleIcon, ArrowLeftIcon, LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Say what is about to happen, get a yes, then report what actually happened.
 *
 * **Control 4.10** — *"Before consequential submission, summarize what will
 * happen and request confirmation… **Report actual backend status, not assumed
 * success**."*
 *
 * Both halves matter, and the second is the one usually missed.
 *
 * ### Why a summary, not just a submit button
 * A form is a list of fields; it does not tell you what pressing the button
 * *does*. Someone filling in a showing request cannot tell from the form
 * whether they are booking a viewing or asking for one. Summarising in plain
 * sentences — including what will **not** happen — is what makes the
 * difference between informed consent and a click.
 *
 * ### Why "actual backend status" is a separate requirement
 * The tempting implementation is: request resolves, show "Confirmed!". That is
 * *assumed* success, and here it would be a lie of exactly the kind C5 warns
 * about — *"Lucy may collect a showing request, but cannot confirm the
 * appointment"*. A request that was accepted is **pending**, not confirmed,
 * and telling someone their viewing is booked when an agent has not yet seen
 * it produces a person standing outside a house at 2pm.
 *
 * So `onConfirm` returns the outcome and this renders **what the server said**.
 * A caller that cannot report a real status should not use this component.
 */

export type SubmissionOutcome = {
  /** Did the server accept it? */
  ok: boolean;
  /**
   * The server's own status word, shown to the user as-is where possible —
   * "pending", "received", "awaiting agent". Never invent "confirmed".
   */
  status: string;
  /** What this status means for the person, in their terms. */
  message: string;
};

type ConfirmSubmissionProps = {
  /** What the action is, e.g. "Request this showing". */
  title: string;
  /**
   * What will happen, one plain sentence per line.
   * Include the limits — what this does *not* do — not only the effects.
   */
  summary: string[];
  confirmLabel: string;
  onConfirm: () => Promise<SubmissionOutcome>;
  onBack: () => void;
  /** Rendered after a successful outcome, e.g. a reference number. */
  children?: React.ReactNode;
};

export function ConfirmSubmission({
  title,
  summary,
  confirmLabel,
  onConfirm,
  onBack,
  children,
}: ConfirmSubmissionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmissionOutcome | null>(null);

  async function handleConfirm() {
    // Guarding on `submitting` rather than only disabling the button: a
    // double-tap on a slow connection fires twice before React re-renders,
    // and a duplicate showing request is a real phone call to un-book.
    if (submitting) return;
    setSubmitting(true);
    try {
      setOutcome(await onConfirm());
    } catch {
      // A thrown error is not "no outcome" — it is a failed outcome, and the
      // person needs to know their request did not go through. Rendering
      // nothing here would leave them looking at a confirm button they already
      // pressed, unsure whether it worked.
      setOutcome({
        ok: false,
        status: 'failed',
        message:
          'We could not send this. Nothing was submitted — please try again, ' +
          'or contact us directly.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div
          className={
            outcome.ok
              ? 'rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-700/60 dark:bg-emerald-950/30'
              : 'rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-700/60 dark:bg-red-950/30'
          }
        >
          <p
            className={
              outcome.ok
                ? 'text-sm font-semibold text-emerald-900 dark:text-emerald-200'
                : 'text-sm font-semibold text-red-900 dark:text-red-200'
            }
          >
            {/* The server's word, not ours. */}
            Status: {outcome.status}
          </p>
          <p
            className={
              outcome.ok
                ? 'mt-1 text-sm text-emerald-800 dark:text-emerald-300'
                : 'mt-1 text-sm text-red-800 dark:text-red-300'
            }
          >
            {outcome.message}
          </p>
        </div>
        {outcome.ok && children}
        {!outcome.ok && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOutcome(null)}
            className="h-10 rounded-xl"
          >
            Back
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
          Before we send this, here is exactly what happens:
        </p>
      </div>

      <ul className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
        {summary.map((line) => (
          <li
            key={line}
            className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <AlertCircleIcon
              className="mt-0.5 size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400"
              aria-hidden="true"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting}
          className="h-11 flex-1 rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
              Sending…
            </span>
          ) : (
            confirmLabel
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="h-11 rounded-xl"
        >
          <span className="inline-flex items-center gap-1.5">
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Change
          </span>
        </Button>
      </div>
    </div>
  );
}
