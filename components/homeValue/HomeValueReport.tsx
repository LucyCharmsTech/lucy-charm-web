'use client';

import { useState } from 'react';
import { FileTextIcon, InfoIcon } from 'lucide-react';
import { createHomeValueFollowUp } from '@/services/homeValueService';
import { HomeValueAttachments } from '@/components/homeValue/HomeValueAttachments';
import type { HomeValueFollowUpType, HomeValueRequestRead } from '@/types/homeValue';

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
  const [followUpType, setFollowUpType] = useState<HomeValueFollowUpType | null>(null);
  const [message, setMessage] = useState('');
  const [followUpNotice, setFollowUpNotice] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const address = request.unit
    ? `${request.address}, unit ${request.unit}`
    : request.address;
  // Existing published reports predate explicit outcomes. A stored low/high
  // pair is the only unambiguous legacy case and remains an estimated range.
  const outcome = request.report_outcome ?? (
    request.value_low !== null && request.value_high !== null ? 'estimated_range' : null
  );

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
            <HomeValueAttachments requestId={request.id} />
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

      {outcome === 'estimated_range' && request.value_low !== null && request.value_high !== null && (
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

      {outcome !== 'estimated_range' && request.outcome_explanation && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="font-semibold">
            {outcome === 'needs_more_information'
              ? 'More information is needed'
              : 'We cannot provide a reliable range'}
          </p>
          <p className="mt-1 whitespace-pre-line">{request.outcome_explanation}</p>
        </div>
      )}

      {request.data_support && request.data_support_explanation && (
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold">Data support: </span>
          {request.data_support}. {request.data_support_explanation}
        </p>
      )}

      <ReportList title="Approved property facts" values={request.approved_property_facts} />
      <ReportList title="Assumptions" values={request.assumptions} />
      <ReportList title="Unknowns" values={request.unknowns} />
      <ReportList title="Conflicts considered" values={request.conflicts} />

      {request.local_market_context && <ReportText title="Local market context" value={request.local_market_context} />}
      <ReportList title="Value factors" values={request.value_factors} />
      {request.reconciliation && <ReportText title="Why this range" value={request.reconciliation} />}

      {(request.published_evidence?.length ?? 0) > 0 && (
        <section className="mt-3">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Supporting evidence</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {request.published_evidence?.map((evidence) => <li key={evidence.id}>{evidence.summary}</li>)}
          </ul>
        </section>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Prepared by a Lucy Charms representative
        {request.report_version_number ? ` · Version ${request.report_version_number}` : ''}
        {request.report_as_of_date ? ` · As of ${new Date(request.report_as_of_date).toLocaleDateString()}` : ''}
        {request.published_at
          ? ` on ${new Date(request.published_at).toLocaleDateString()}`
          : ''}
        . This is an opinion of value, not an appraisal or guaranteed price.
      </p>

      <section className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Questions or next steps</h4>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Request a correction, provide requested information, or ask for a consultation. Your request does not change this published report.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700" onClick={() => { setFollowUpType('correction'); setFollowUpNotice(null); }}>Request a correction</button>
          {outcome === 'needs_more_information' && <button type="button" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700" onClick={() => { setFollowUpType('more_information'); setFollowUpNotice(null); }}>Provide information</button>}
          <button type="button" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700" onClick={() => { setFollowUpType('consultation'); setFollowUpNotice(null); }}>Request consultation</button>
        </div>
        {followUpType && <form className="mt-3 space-y-2" onSubmit={(event) => {
          event.preventDefault();
          setSubmitting(true); setFollowUpError(null);
          void createHomeValueFollowUp(request.id, followUpType, message).then(() => {
            setMessage(''); setFollowUpNotice('Your request was sent to the review team.'); setFollowUpType(null);
          }).catch(() => setFollowUpError('Could not send your request. Please try again.')).finally(() => setSubmitting(false));
        }}>
          <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100" htmlFor={`home-value-follow-up-${request.id}`}>How can we help?</label>
          <textarea id={`home-value-follow-up-${request.id}`} required value={message} onChange={(event) => setMessage(event.target.value)} rows={3} className="w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          <button disabled={submitting} type="submit" className="rounded-lg bg-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-60">Send request</button>
        </form>}
        {followUpNotice && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{followUpNotice}</p>}
        {followUpError && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{followUpError}</p>}
      </section>
      <HomeValueAttachments requestId={request.id} />
    </article>
  );
}

function ReportList({ title, values }: { title: string; values?: string[] | null }) {
  if (!values || values.length === 0) return null;
  return <section className="mt-3"><h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">{values.map((value) => <li key={value}>{value}</li>)}</ul></section>;
}

function ReportText({ title, value }: { title: string; value: string }) {
  return <section className="mt-3"><h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4><p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{value}</p></section>;
}
