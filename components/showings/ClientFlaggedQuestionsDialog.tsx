'use client';

/**
 * Full list of Property Checkup questions a buyer flagged for a showing —
 * opened from the "Client flagged N things" button in the agent/admin
 * showings tables, which previously only showed a truncated, hover-only
 * preview.
 */

import { XIcon } from 'lucide-react';

type Props = {
  open: boolean;
  buyerName: string;
  questions: string[];
  onClose: () => void;
};

export default function ClientFlaggedQuestionsDialog({ open, buyerName, questions, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-flagged-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="client-flagged-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              What {buyerName} flagged
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              From Property Checkup, sent with this showing request.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {questions.map((q) => (
            <li
              key={q}
              className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
            >
              {q}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
