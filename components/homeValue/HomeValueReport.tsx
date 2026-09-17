'use client';

import { FileTextIcon, InfoIcon } from 'lucide-react';
import type { HomeValueRequestRead } from '@/types/homeValue';

/**
 * A published Home Value report, in the requester's portal.
 *
 * Hamed: *"the report appears in the portal and the email links securely"*,
 * and *"Use the existing human-reviewed report workflow — **not an instant
 * public valuation number**."*
 *
 * Two things this deliberately does:
 *
 * **The limitations sit with the range, not below the fold.** A range read
 * without them is exactly the "instant valuation number" the instruction rules
 * out — the limitations are what make it a person's opinion rather than a
 * figure. They are rendered adjacent and at the same weight, never collapsed
 * behind a "details" toggle.
 *
 * **A range, never a single number.** Even when the two values are close, both
 * are shown. A midpoint would read as a price, and a price is what this
 * workflow exists not to produce automatically.
 */

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  });
}

export function HomeValueReport({ request }: { request: HomeValueRequestRead }) {
  const address = request.unit
    ? `${request.address}, unit ${request.unit}`
    : request.address;

  // Not published yet. The server has already blanked the figures, so there is
  // nothing here to leak — this branch is about telling the person where their
  // request stands rather than showing them an empty report.
  if (request.status !== 'report_ready') {
    return (
      <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-start gap-2.5">
          <FileTextIcon
            className="mt-0.5 size-5 shrink-0 text-zinc-500 dark:text-zinc-400"
            aria-hidden="true"
          />
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {address}
            </h3>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              {request.status === 'under_review'
                ? 'A Lucy Charms representative is preparing your valuation.'
                : 'We have your request.'}
            </p>
            {/*
              No date, no estimate of one. Hamed: "No fixed response-time
              promise." The line that would naturally go here — "usually within
              two business days" — is precisely what is excluded.
            */}
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              It will appear here once it is ready, and we will let you know.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {address}
      </h3>

      {request.value_low !== null && request.value_high !== null && (
        <p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {formatMoney(request.value_low)} – {formatMoney(request.value_high)}
        </p>
      )}

      {request.limitations && (
        /*
          Adjacent to the range and at full weight, never collapsed. A range
          read without its limitations is the automatic valuation number this
          workflow exists to avoid.
        */
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
          <InfoIcon
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">What this range assumes</p>
            <p className="mt-0.5 whitespace-pre-line">{request.limitations}</p>
          </div>
        </div>
      )}

      {request.report_summary && (
        <p className="mt-3 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
          {request.report_summary}
        </p>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Prepared by a Lucy Charms representative
        {request.published_at
          ? ` on ${new Date(request.published_at).toLocaleDateString()}`
          : ''}
        . This is an opinion of value, not an appraisal.
      </p>
    </article>
  );
}
