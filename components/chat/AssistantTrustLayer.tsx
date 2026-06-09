'use client';

/**
 * AssistantTrustLayer
 *
 * Appears under every assistant reply. Shows:
 *   - Confidence badge (colour-coded: green ≥80 %, amber 60-79 %, red <60 %)
 *   - Expandable "Why this answer?" section with listing fields used
 *   - Model / prompt version info
 *
 * Collapsed by default — only the badge is visible; a small chevron expands the detail.
 */

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, InfoIcon } from 'lucide-react';

export type AssistantTrustLayerProps = {
  confidence_score: number | null;
  listing_fields_used?: string[] | null;
  model_version?: string | null;
  prompt_version?: string | null;
  escalation_flag?: boolean;
};

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const { bg, text, label } =
    pct >= 80
      ? { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300', label: 'High' }
      : pct >= 60
      ? { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-800 dark:text-amber-300', label: 'Medium' }
      : { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-400', label: 'Low' };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${bg} ${text}`}
      title={`Model confidence: ${pct}%`}
    >
      <span
        className={`size-1.5 rounded-full ${
          pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
        }`}
        aria-hidden="true"
      />
      {label} · {pct}%
    </span>
  );
}

export default function AssistantTrustLayer({
  confidence_score,
  listing_fields_used,
  model_version,
  prompt_version,
  escalation_flag,
}: AssistantTrustLayerProps) {
  const [open, setOpen] = useState(false);

  const hasDetail =
    (listing_fields_used && listing_fields_used.length > 0) ||
    model_version ||
    prompt_version;

  if (confidence_score == null && !hasDetail) return null;

  return (
    <div className="mt-2 border-t border-zinc-200/80 pt-2 dark:border-zinc-700/60">
      {/* Always-visible row: confidence badge + toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {confidence_score != null && (
            <ConfidenceBadge score={confidence_score} />
          )}
          {escalation_flag && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              ⚠ Escalated
            </span>
          )}
        </div>

        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Hide source details' : 'Why this answer?'}
            className="flex items-center gap-0.5 rounded text-[10px] text-zinc-400 transition hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primarycolor dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <InfoIcon className="size-3" aria-hidden="true" />
            <span>Why?</span>
            {open ? (
              <ChevronUpIcon className="size-3" aria-hidden="true" />
            ) : (
              <ChevronDownIcon className="size-3" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Expandable detail panel */}
      {open && hasDetail && (
        <div className="mt-2 space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-900/50">
          {listing_fields_used && listing_fields_used.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-zinc-600 dark:text-zinc-300">
                Listing data used in this reply
              </p>
              <div className="flex flex-wrap gap-1">
                {listing_fields_used.map((field) => (
                  <span
                    key={field}
                    className="rounded-md bg-primarycolor/10 px-1.5 py-0.5 text-[10px] font-medium text-primarycolor dark:bg-primarycolor/20"
                  >
                    {field.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(model_version || prompt_version) && (
            <p className="text-zinc-400 dark:text-zinc-500">
              {model_version && <span>{model_version}</span>}
              {model_version && prompt_version && <span> · </span>}
              {prompt_version && <span>prompt v{prompt_version}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
