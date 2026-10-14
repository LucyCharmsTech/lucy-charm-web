'use client';

import { useRef, useState } from 'react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { track } from '@/lib/analytics';
import type { FeedbackContext, ProblemCategory } from '@/lib/productFeedback';
import { submitProductFeedback } from '@/services/productFeedbackService';

export function ProductFeedbackPrompt({ context }: { context: FeedbackContext }) {
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [problemOpen, setProblemOpen] = useState(false);
  const [category, setCategory] = useState<ProblemCategory>('bug');
  const [description, setDescription] = useState('');
  const [problemSent, setProblemSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const helpfulId = useRef<string | null>(null);
  const problemId = useRef<string | null>(null);
  const inFlight = useRef(false);

  async function sendHelpful(helpful: boolean) {
    if (answer !== null || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      helpfulId.current ??= globalThis.crypto.randomUUID();
      await submitProductFeedback({
        submission_id: helpfulId.current, feedback_type: 'helpful', context, helpful,
      });
      setAnswer(helpful);
      try { track('product_feedback_helpful', { context, helpful }); } catch { /* Optional telemetry. */ }
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Could not save feedback. Please try again.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function sendProblem(event: React.FormEvent) {
    event.preventDefault();
    if (problemSent || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      problemId.current ??= globalThis.crypto.randomUUID();
      await submitProductFeedback({
        submission_id: problemId.current, feedback_type: 'problem', context,
        category, description: description.trim(),
      });
      setProblemSent(true);
      setProblemOpen(false);
      // Never pass the description, URLs, or identity to PostHog.
      try { track('product_problem_reported', { context, category }); } catch { /* Optional telemetry. */ }
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Could not save your report. Please try again.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-label="Product feedback" className="border-t border-zinc-200 bg-zinc-50 px-4 py-5 text-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">Was this helpful?</span>
          {answer === null ? (
            <>
              <button type="button" disabled={busy} onClick={() => void sendHelpful(true)} className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Helpful</button>
              <button type="button" disabled={busy} onClick={() => void sendHelpful(false)} className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Not helpful</button>
            </>
          ) : <span role="status">Thanks for your feedback.</span>}
          {!problemSent && <button type="button" onClick={() => setProblemOpen((value) => !value)} className="underline underline-offset-2">Report a problem</button>}
          {problemSent && <span role="status">Problem report received.</span>}
        </div>
        {problemOpen && !problemSent && (
          <form onSubmit={(event) => void sendProblem(event)} className="max-w-xl space-y-3">
            <label className="block font-medium">Problem category
              <select value={category} onChange={(event) => { setCategory(event.target.value as ProblemCategory); problemId.current = null; }} className="mt-1 block w-full rounded-lg border bg-white p-2 text-zinc-900">
                <option value="bug">Something did not work</option>
                <option value="content">Incorrect or unclear content</option>
                <option value="accessibility">Accessibility issue</option>
                <option value="other">Other product issue</option>
              </select>
            </label>
            <label className="block font-medium">Description (optional)
              <textarea maxLength={1000} value={description} onChange={(event) => { setDescription(event.target.value); problemId.current = null; }} rows={3} className="mt-1 block w-full rounded-lg border bg-white p-2 text-zinc-900" />
            </label>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Do not include passwords, access codes, private documents, or sensitive personal information. This check cannot catch everything.</p>
            <button type="submit" disabled={busy} className="rounded-lg bg-primarycolor px-4 py-2 font-semibold text-primarycolor-foreground disabled:opacity-50">Send problem report</button>
          </form>
        )}
        {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
      </div>
    </section>
  );
}
