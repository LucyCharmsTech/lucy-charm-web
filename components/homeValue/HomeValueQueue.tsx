'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon, LockIcon, ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { serverMessage } from '@/lib/formStates';
import { HomeValueReviewerAttachments } from '@/components/homeValue/HomeValueReviewerAttachments';
import {
  acknowledgeHomeValueRepresentationReview,
  clearHomeValueCompliance,
  createHomeValueEvidence,
  deleteHomeValueEvidence,
  fetchHomeValueEvidence,
  fetchHomeValueFollowUps,
  generateHomeValueAiDraft,
  fetchHomeValueReportVersions,
  fetchStaffHomeValueRequests,
  publishHomeValueReport,
  saveHomeValueDraft,
  updateHomeValueEvidence,
  updateHomeValueFollowUp,
} from '@/services/homeValueService';
import type {
  HomeValueDataSupport,
  HomeValueAiDraftSuggestions,
  HomeValueEvidence,
  HomeValueEvidenceBody,
  HomeValueFollowUpStaff,
  HomeValueReportVersion,
  HomeValueReportOutcome,
  HomeValueRequestStaff,
} from '@/types/homeValue';

/**
 * The reviewer's queue for Home Value requests — plan item 4.2.
 *
 * Hamed: *"A person sets range and limitations, **approves publication on the
 * backend**, **drafts stay private**, the report appears in the portal and the
 * email links securely."*
 *
 * ### The order of the controls is the order of the work
 *
 * Draft → clear compliance → publish, top to bottom, with publish **disabled
 * until compliance is cleared**. The server refuses it either way — that is
 * where the control actually lives — but a button that looks available and
 * then returns 403 teaches people the software is unreliable rather than that
 * they missed a step.
 *
 * ### Why the range and the limitations sit in one block
 *
 * They are published together and mean nothing apart. A reviewer who can save
 * a range and forget the limitations will eventually do it, and the result is
 * the automatic valuation number the whole workflow exists to avoid — merely
 * typed by a person. The publish button requires both.
 */

type HomeValueQueueProps = {
  /** Admin sees everything; an agent sees their own plus the central queue. */
  role: 'admin' | 'agent';
};

export function HomeValueQueue({ role }: HomeValueQueueProps) {
  const [items, setItems] = useState<HomeValueRequestStaff[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestedId =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('request_id');

  useEffect(() => {
    let active = true;
    fetchStaffHomeValueRequests()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((err: unknown) => {
        if (active) {
          setLoadError(serverMessage(err, 'Could not load Home Value requests.'));
          setItems([]);
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  if (items === null) {
    return (
      <div
        role="status"
        aria-label="Loading Home Value requests"
        className="flex items-center gap-2 p-6 text-sm text-zinc-500"
      >
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="p-6 text-sm text-red-600 dark:text-red-400">
        {loadError}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
        No Home Value requests yet.
      </p>
    );
  }

  // Daily Work links here with a source id.  The normal list API remains the
  // permission boundary: only an item already returned for this reviewer can
  // be focused.  A stale or inaccessible id therefore reveals nothing and
  // leaves the ordinary permitted queue usable.
  const requestedItem = requestedId
    ? items.find((item) => item.id === requestedId) ?? null
    : null;
  const visibleItems = requestedItem ? [requestedItem] : items;

  return (
    <>
      {requestedId && !requestedItem && (
        <p role="status" className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          The requested Home Value item is unavailable. Showing your permitted queue.
        </p>
      )}
      {requestedItem && (
        <p role="status" className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Showing the Home Value request opened from Daily Work.
        </p>
      )}
      <ul className="space-y-4">
      {visibleItems.map((item) => (
        <HomeValueQueueItem
          key={item.id}
          item={item}
          role={role}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
      ))}
      </ul>
    </>
  );
}

function HomeValueQueueItem({
  item,
  role,
  onChanged,
}: {
  item: HomeValueRequestStaff;
  role: 'admin' | 'agent';
  onChanged: () => void;
}) {
  const [low, setLow] = useState(item.value_low?.toString() ?? '');
  const [high, setHigh] = useState(item.value_high?.toString() ?? '');
  const [limitations, setLimitations] = useState(item.limitations ?? '');
  const [summary, setSummary] = useState(item.report_summary ?? '');
  const [outcome, setOutcome] = useState<HomeValueReportOutcome>(
    item.report_outcome ?? 'estimated_range',
  );
  const [outcomeExplanation, setOutcomeExplanation] = useState(item.outcome_explanation ?? '');
  const [dataSupport, setDataSupport] = useState<HomeValueDataSupport | ''>(
    item.data_support ?? '',
  );
  const [dataSupportExplanation, setDataSupportExplanation] = useState(
    item.data_support_explanation ?? '',
  );
  const [approvedFacts, setApprovedFacts] = useState((item.approved_property_facts ?? []).join('\n'));
  const [assumptions, setAssumptions] = useState((item.assumptions ?? []).join('\n'));
  const [unknowns, setUnknowns] = useState((item.unknowns ?? []).join('\n'));
  const [conflicts, setConflicts] = useState((item.conflicts ?? []).join('\n'));
  const [marketContext, setMarketContext] = useState(item.local_market_context ?? '');
  const [valueFactors, setValueFactors] = useState((item.value_factors ?? []).join('\n'));
  const [reconciliation, setReconciliation] = useState(item.reconciliation ?? '');
  const [reportAsOfDate, setReportAsOfDate] = useState(item.report_as_of_date ?? '');
  const [notes, setNotes] = useState(item.internal_notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [versions, setVersions] = useState<HomeValueReportVersion[] | null>(null);
  const [followUps, setFollowUps] = useState<HomeValueFollowUpStaff[] | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<HomeValueAiDraftSuggestions | null>(null);

  const published = item.status === 'report_ready';
  const complianceCleared = Boolean(item.compliance_cleared_at);
  const hasValidRange =
    Number(low) > 0 &&
    Number(high) > 0 &&
    Number(low) <= Number(high) &&
    limitations.trim().length > 0 &&
    dataSupport !== '' &&
    dataSupportExplanation.trim().length > 0;
  const hasUsefulNonEstimateExplanation = outcomeExplanation.trim().length > 0;
  const canPublish = complianceCleared && !busy && (
    outcome === 'estimated_range' ? hasValidRange : hasUsefulNonEstimateExplanation
  );

  const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
  const reportFields = () => ({
    report_outcome: outcome,
    value_low: outcome === 'estimated_range' && low ? Number(low) : null,
    value_high: outcome === 'estimated_range' && high ? Number(high) : null,
    limitations: outcome === 'estimated_range' ? limitations || null : null,
    report_summary: summary || null,
    outcome_explanation: outcomeExplanation || null,
    data_support: outcome === 'estimated_range' ? dataSupport || null : null,
    data_support_explanation: outcome === 'estimated_range' ? dataSupportExplanation || null : null,
    approved_property_facts: lines(approvedFacts),
    assumptions: lines(assumptions),
    unknowns: lines(unknowns),
    conflicts: lines(conflicts),
    local_market_context: marketContext || null,
    value_factors: lines(valueFactors),
    reconciliation: reconciliation || null,
    report_as_of_date: reportAsOfDate || null,
  });

  async function run<T>(action: () => Promise<T>, success: string): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      setNotice(success);
      onChanged();
      return result;
    } catch (err: unknown) {
      setError(serverMessage(err, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {item.address}
            {item.unit ? `, unit ${item.unit}` : ''}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {item.full_name} · {item.relationship.replace('_', ' ')} · represented
            elsewhere: {item.represented_elsewhere.replace('_', ' ')}
          </p>
          {!item.assigned_agent_id && (
            /*
              The central brokerage queue is the absence of an assignment.
              Surfaced plainly because an unassigned request is work nobody has
              picked up — and a queue nobody can see is a queue nobody works.
            */
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Unassigned — in the central brokerage queue
            </p>
          )}
          {item.representation_review_status === 'required' && (role === 'admin' || item.assigned_agent_id) && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              Another representative was reported. Review and acknowledge this neutral relationship status before any relationship-oriented follow-up.
              <Button type="button" variant="outline" className="ml-2 h-7" disabled={busy} onClick={() => void run(() => acknowledgeHomeValueRepresentationReview(item.id), 'Representation status acknowledged.')}>Acknowledge review</Button>
            </div>
          )}
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {item.status.replace('_', ' ')}
        </span>
      </div>

      {/* What the person told us. Read-only — this is their answer, not ours. */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {(
          [
            ['Type', item.property_type],
            ['Beds', item.beds],
            ['Baths', item.baths],
            ['Parking', item.parking],
            ['Size', item.approximate_size],
            ['Condition', item.condition],
            ['Timeline', item.timeline],
          ] as const
        )
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
              <dd
                className={
                  value === 'not_sure'
                    ? // "Not sure" is a real answer, and a more useful one
                      // than a guess — it says check the title. Shown
                      // differently so a reviewer sees it as an answer rather
                      // than skims past it as a value.
                      'font-medium italic text-amber-700 dark:text-amber-400'
                    : 'font-medium text-zinc-900 dark:text-zinc-100'
                }
              >
                {value === 'not_sure' ? 'Not sure' : value}
              </dd>
            </div>
          ))}
      </dl>

      {(role === 'admin' || item.assigned_agent_id) && (
        <HomeValueReviewerAttachments requestId={item.id} />
      )}

      {item.renovations && (
        <p className="mt-2 whitespace-pre-line text-xs text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold">Renovations:</span> {item.renovations}
        </p>
      )}

      {/* ── The report ─────────────────────────────────────────────────────── */}
      <fieldset className="mt-4 space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
          Valuation
        </legend>

        <div className="space-y-1.5">
          <Label htmlFor={`outcome-${item.id}`}>Report outcome *</Label>
          <select
            id={`outcome-${item.id}`}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as HomeValueReportOutcome)}
            disabled={busy}
            className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="estimated_range">Estimated range</option>
            <option value="needs_more_information">Needs more information</option>
            <option value="unable_to_estimate_reliably">Unable to estimate reliably</option>
          </select>
        </div>

        {outcome === 'estimated_range' && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`low-${item.id}`}>Lower value</Label>
            <Input
              id={`low-${item.id}`}
              type="number"
              inputMode="numeric"
              value={low}
              onChange={(event) => setLow(event.target.value)}
              disabled={busy}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`high-${item.id}`}>Upper value</Label>
            <Input
              id={`high-${item.id}`}
              type="number"
              inputMode="numeric"
              value={high}
              onChange={(event) => setHigh(event.target.value)}
              disabled={busy}
              className="h-10 rounded-xl"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`lim-${item.id}`}>
            Limitations — what this range assumes *
          </Label>
          <Textarea
            id={`lim-${item.id}`}
            rows={2}
            value={limitations}
            onChange={(event) => setLimitations(event.target.value)}
            placeholder="Exterior viewing only; no interior inspection carried out."
            disabled={busy}
            className="rounded-xl"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {/* Says why it is required, because "another mandatory box" reads
                as bureaucracy until the reason is given. */}
            Published alongside the range. A range without its limitations is an
            automatic-looking number, which is what this workflow exists to
            avoid.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`support-${item.id}`}>Data support *</Label>
            <select
              id={`support-${item.id}`}
              value={dataSupport}
              onChange={(event) => setDataSupport(event.target.value as HomeValueDataSupport | '')}
              disabled={busy}
              className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">Select support level</option>
              <option value="strong">Strong</option>
              <option value="moderate">Moderate</option>
              <option value="limited">Limited</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`support-explanation-${item.id}`}>Why this support level *</Label>
            <Textarea id={`support-explanation-${item.id}`} rows={2} value={dataSupportExplanation} onChange={(event) => setDataSupportExplanation(event.target.value)} disabled={busy} className="rounded-xl" />
          </div>
        </div>
        </>}

        {outcome !== 'estimated_range' && (
          <div className="space-y-1.5">
            <Label htmlFor={`outcome-explanation-${item.id}`}>Client explanation *</Label>
            <Textarea id={`outcome-explanation-${item.id}`} rows={3} value={outcomeExplanation} onChange={(event) => setOutcomeExplanation(event.target.value)} disabled={busy} className="rounded-xl" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No value range will be published for this outcome.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`sum-${item.id}`}>Client-visible summary *</Label>
          <Textarea
            id={`sum-${item.id}`}
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            disabled={busy}
            className="rounded-xl"
          />
        </div>

        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={busy} className="h-9 rounded-xl" onClick={() => void run(
              () => generateHomeValueAiDraft(item.id, outcome === 'estimated_range'),
              'AI suggestions generated. Review and apply only what is appropriate.',
            ).then((suggestions) => { if (suggestions) setAiSuggestions(suggestions); })}>Generate AI suggestions</Button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Optional reviewer drafting help. It cannot set values, support level, compliance, or publish.</p>
          </div>
          {aiSuggestions && <div className="mt-3 space-y-2 text-sm">
            <AiSuggestion title="Normalized property facts" values={aiSuggestions.normalized_property_facts} onUse={() => setApprovedFacts(aiSuggestions.normalized_property_facts.join('\n'))} />
            <AiSuggestion title="Missing information" values={aiSuggestions.missing_information} />
            <AiSuggestion title="Potential conflicts" values={aiSuggestions.conflict_suggestions} onUse={() => setConflicts(aiSuggestions.conflict_suggestions.join('\n'))} />
            <AiSuggestion title="Assumptions" values={aiSuggestions.assumptions} onUse={() => setAssumptions(aiSuggestions.assumptions.join('\n'))} />
            <AiSuggestion title="Unknowns" values={aiSuggestions.unknowns} onUse={() => setUnknowns(aiSuggestions.unknowns.join('\n'))} />
            <AiSuggestion title="Value factors" values={aiSuggestions.value_factors} onUse={() => setValueFactors(aiSuggestions.value_factors.join('\n'))} />
            <AiTextSuggestion title="Local market context" value={aiSuggestions.local_market_context} onUse={() => setMarketContext(aiSuggestions.local_market_context ?? '')} />
            <AiTextSuggestion title="Why this range" value={aiSuggestions.reconciliation} onUse={() => setReconciliation(aiSuggestions.reconciliation ?? '')} />
            <AiTextSuggestion title="Homeowner-facing summary" value={aiSuggestions.report_summary} onUse={() => setSummary(aiSuggestions.report_summary ?? '')} />
          </div>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`as-of-${item.id}`}>Report as-of date</Label>
          <Input id={`as-of-${item.id}`} type="date" value={reportAsOfDate} onChange={(event) => setReportAsOfDate(event.target.value)} disabled={busy} className="h-10 rounded-xl" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Use the date the reviewed information reflects, when known.</p>
        </div>

        <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium">Review basis and reconciliation</summary>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Enter one item per line for list fields. These are reviewer-authored report fields, not automated valuation output.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ReportListField id={`facts-${item.id}`} label="Approved property facts" value={approvedFacts} onChange={setApprovedFacts} disabled={busy} />
            <ReportListField id={`assumptions-${item.id}`} label="Assumptions" value={assumptions} onChange={setAssumptions} disabled={busy} />
            <ReportListField id={`unknowns-${item.id}`} label="Unknowns" value={unknowns} onChange={setUnknowns} disabled={busy} />
            <ReportListField id={`conflicts-${item.id}`} label="Conflicts" value={conflicts} onChange={setConflicts} disabled={busy} />
            <ReportListField id={`factors-${item.id}`} label="Value factors" value={valueFactors} onChange={setValueFactors} disabled={busy} />
            <div className="space-y-1.5"><Label htmlFor={`market-${item.id}`}>Local market context</Label><Textarea id={`market-${item.id}`} rows={3} value={marketContext} onChange={(event) => setMarketContext(event.target.value)} disabled={busy} className="rounded-xl" /></div>
          </div>
          <div className="mt-3 space-y-1.5"><Label htmlFor={`reconciliation-${item.id}`}>Reconciliation</Label><Textarea id={`reconciliation-${item.id}`} rows={3} value={reconciliation} onChange={(event) => setReconciliation(event.target.value)} disabled={busy} className="rounded-xl" /></div>
        </details>

        <div>
          <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => setShowEvidence((shown) => !shown)}>
            {showEvidence ? 'Hide evidence' : 'Manage evidence'}
          </Button>
          {showEvidence && <HomeValueEvidenceEditor requestId={item.id} disabled={busy} />}
        </div>

        {published && <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => void fetchHomeValueReportVersions(item.id).then(setVersions).catch((err: unknown) => setError(serverMessage(err, 'Could not load report history.')))}>View publication history</Button>
          {versions && <div className="mt-3 space-y-2">
            {versions.map((version) => <details key={version.id} className="rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-100">
                Version {version.version_number} · {new Date(version.published_at).toLocaleString()} · {version.report_outcome.replaceAll('_', ' ')}{version.value_low !== null && version.value_high !== null ? ` · ${version.value_low}–${version.value_high}` : ''}
              </summary>
              <dl className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
                <div><dt className="inline font-medium">Published by: </dt><dd className="inline">{version.publisher_display_name ?? 'Lucy Charms representative'}</dd></div>
                {version.report_as_of_date && <div><dt className="inline font-medium">As of: </dt><dd className="inline">{version.report_as_of_date}</dd></div>}
                {version.data_support && <div><dt className="inline font-medium">Data support: </dt><dd className="inline">{version.data_support}{version.data_support_explanation ? ` — ${version.data_support_explanation}` : ''}</dd></div>}
                {version.outcome_explanation && <div><dt className="inline font-medium">Outcome: </dt><dd className="inline">{version.outcome_explanation}</dd></div>}
                {version.report_summary && <div><dt className="font-medium">Summary</dt><dd>{version.report_summary}</dd></div>}
                {version.reconciliation && <div><dt className="font-medium">Reconciliation</dt><dd>{version.reconciliation}</dd></div>}
                {version.published_evidence.length > 0 && <div><dt className="font-medium">Published evidence</dt><dd>{version.published_evidence.map((evidence) => evidence.summary).join('; ')}</dd></div>}
                <div>{version.disclaimer}</div>
              </dl>
            </details>)}
          </div>}
        </div>}

        <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => void fetchHomeValueFollowUps(item.id).then(setFollowUps).catch((err: unknown) => setError(serverMessage(err, 'Could not load follow-ups.')))}>View homeowner follow-ups</Button>
          {followUps && <div className="mt-3 space-y-2 text-sm">
            {followUps.length === 0 && <p className="text-zinc-500">No homeowner follow-ups.</p>}
            {followUps.map((followUp) => <div key={followUp.id} className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-900">
              <p className="font-medium">{followUp.request_type.replaceAll('_', ' ')} · {followUp.status.replaceAll('_', ' ')}</p>
              <p className="mt-1 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{followUp.message}</p>
              {followUp.status !== 'resolved' && <Button type="button" variant="outline" className="mt-2 h-8 rounded-lg text-xs" onClick={() => void updateHomeValueFollowUp(item.id, followUp.id, 'resolved').then(() => fetchHomeValueFollowUps(item.id)).then(setFollowUps).catch((err: unknown) => setError(serverMessage(err, 'Could not update follow-up.')))}>Mark resolved</Button>}
            </div>)}
          </div>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`notes-${item.id}`}>Internal notes</Label>
          <Textarea
            id={`notes-${item.id}`}
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={busy}
            className="rounded-xl"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Never shown to the client — the client-facing schema does not carry
            this field at all.
          </p>
        </div>
      </fieldset>

      {notice && (
        <p role="status" className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                saveHomeValueDraft(item.id, {
                  ...reportFields(),
                  internal_notes: notes || null,
                }),
              'Draft saved. The client cannot see it.',
            )
          }
          className="h-10 rounded-xl"
        >
          Save draft
        </Button>

        {complianceCleared ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
            Compliance cleared{' '}
            {new Date(item.compliance_cleared_at as string).toLocaleDateString()}
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                () => clearHomeValueCompliance(item.id),
                'Compliance cleared. This report can now be published.',
              )
            }
            className="h-10 rounded-xl"
          >
            <span className="inline-flex items-center gap-1.5">
              <LockIcon className="size-3.5" aria-hidden="true" />
              Clear compliance
            </span>
          </Button>
        )}

        <Button
          type="button"
          disabled={!canPublish}
          onClick={() =>
            void run(
              () =>
                publishHomeValueReport(item.id, reportFields()),
              'Published. The client can see it in their account.',
            )
          }
          className="h-10 rounded-xl bg-primarycolor font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-60"
        >
          {published ? 'Republish' : 'Publish to client'}
        </Button>
      </div>

      {!complianceCleared && (
        /*
          Says which step is missing rather than leaving a disabled button to
          be puzzled over. The server refuses publication either way — that is
          where the control lives — but a button that looks available and then
          returns 403 teaches people the software is unreliable rather than
          that they missed a step.
        */
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Publishing is unavailable until compliance is cleared.
        </p>
      )}
      {role === 'agent' && !item.assigned_agent_id && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          An admin must assign this to you before you can draft or publish.
        </p>
      )}
    </li>
  );
}

function ReportListField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={3} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="rounded-xl" />
    </div>
  );
}

function AiSuggestion({ title, values, onUse }: { title: string; values: string[]; onUse?: () => void }) {
  if (values.length === 0) return null;
  return <div className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-900"><p className="font-medium">{title}</p><ul className="mt-1 list-disc pl-5 text-zinc-700 dark:text-zinc-300">{values.map((value) => <li key={value}>{value}</li>)}</ul>{onUse && <Button type="button" variant="outline" className="mt-2 h-8 rounded-lg text-xs" onClick={onUse}>Use suggestion</Button>}</div>;
}

function AiTextSuggestion({ title, value, onUse }: { title: string; value: string | null; onUse: () => void }) {
  if (!value) return null;
  return <div className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-900"><p className="font-medium">{title}</p><p className="mt-1 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{value}</p><Button type="button" variant="outline" className="mt-2 h-8 rounded-lg text-xs" onClick={onUse}>Use suggestion</Button></div>;
}

function blankEvidence(): HomeValueEvidenceBody {
  return {
    evidence_type: 'sold_comparable',
    reference: null,
    address: null,
    source_date: null,
    value: null,
    why_relevant: '',
    similarities: null,
    differences: null,
    adjustments: null,
    limitations: null,
    internal_source_notes: null,
    is_publishable: false,
    publishable_summary: null,
  };
}

function evidenceBody(evidence: HomeValueEvidence): HomeValueEvidenceBody {
  return {
    evidence_type: evidence.evidence_type,
    reference: evidence.reference,
    address: evidence.address,
    source_date: evidence.source_date,
    value: evidence.value,
    why_relevant: evidence.why_relevant,
    similarities: evidence.similarities,
    differences: evidence.differences,
    adjustments: evidence.adjustments,
    limitations: evidence.limitations,
    internal_source_notes: evidence.internal_source_notes,
    is_publishable: evidence.is_publishable,
    publishable_summary: evidence.publishable_summary,
  };
}

function HomeValueEvidenceEditor({ requestId, disabled }: { requestId: string; disabled: boolean }) {
  const [items, setItems] = useState<HomeValueEvidence[] | null>(null);
  const [form, setForm] = useState<HomeValueEvidenceBody>(blankEvidence);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setItems(await fetchHomeValueEvidence(requestId));
    } catch (err: unknown) {
      setError(serverMessage(err, 'Could not load evidence.'));
    }
  }

  useEffect(() => {
    let active = true;
    fetchHomeValueEvidence(requestId)
      .then((rows) => { if (active) setItems(rows); })
      .catch((err: unknown) => { if (active) setError(serverMessage(err, 'Could not load evidence.')); });
    return () => { active = false; };
  }, [requestId]);

  async function save() {
    setBusy(true); setError(null);
    try {
      if (editing) await updateHomeValueEvidence(requestId, editing, form);
      else await createHomeValueEvidence(requestId, form);
      setForm(blankEvidence()); setEditing(null); await reload();
    } catch (err: unknown) {
      setError(serverMessage(err, 'Could not save evidence.'));
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h4 className="text-sm font-semibold">Manual evidence</h4>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Research is staff-only. Use only sources you are authorized to use; raw source references stay internal, and only a safe summary can be published.</p>
      <div className="mt-2 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        Prefer recent, local, similar sold comparables where available. Compare type, approximate size, beds, baths, parking, lot relevance and condition; consider same-building evidence for condos. Active listings describe competition, not proof of value. Aim for roughly 3–6 strong sold comparables where available, identify or exclude weak/outlier evidence, and expand time or area only when stronger local/recent evidence is insufficient.
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor={`evidence-type-${requestId}`}>Type</Label><select id={`evidence-type-${requestId}`} value={form.evidence_type} onChange={(event) => setForm({ ...form, evidence_type: event.target.value as HomeValueEvidenceBody['evidence_type'] })} className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950" disabled={busy || disabled}><option value="sold_comparable">Sold comparable</option><option value="active_listing">Active listing</option><option value="other">Other evidence</option></select></div>
        <div className="space-y-1"><Label htmlFor={`evidence-reference-${requestId}`}>Reference (staff only)</Label><Input id={`evidence-reference-${requestId}`} value={form.reference ?? ''} onChange={(event) => setForm({ ...form, reference: event.target.value || null })} disabled={busy || disabled} className="h-10 rounded-xl" /></div>
        <div className="space-y-1"><Label htmlFor={`evidence-address-${requestId}`}>Address</Label><Input id={`evidence-address-${requestId}`} value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value || null })} disabled={busy || disabled} className="h-10 rounded-xl" /></div>
        <div className="space-y-1"><Label htmlFor={`evidence-date-${requestId}`}>Source date</Label><Input id={`evidence-date-${requestId}`} type="date" value={form.source_date?.slice(0, 10) ?? ''} onChange={(event) => setForm({ ...form, source_date: event.target.value ? `${event.target.value}T00:00:00Z` : null })} disabled={busy || disabled} className="h-10 rounded-xl" /></div>
        <div className="space-y-1"><Label htmlFor={`evidence-value-${requestId}`}>Value</Label><Input id={`evidence-value-${requestId}`} type="number" value={form.value ?? ''} onChange={(event) => setForm({ ...form, value: event.target.value ? Number(event.target.value) : null })} disabled={busy || disabled} className="h-10 rounded-xl" /></div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <EvidenceText id={`why-${requestId}`} label="Why relevant (recency, location, type and building where relevant) *" value={form.why_relevant} onChange={(value) => setForm({ ...form, why_relevant: value })} disabled={busy || disabled} />
        <EvidenceText id={`similarities-${requestId}`} label="Similarities" value={form.similarities ?? ''} onChange={(value) => setForm({ ...form, similarities: value || null })} disabled={busy || disabled} />
        <EvidenceText id={`differences-${requestId}`} label="Differences" value={form.differences ?? ''} onChange={(value) => setForm({ ...form, differences: value || null })} disabled={busy || disabled} />
        <EvidenceText id={`adjustments-${requestId}`} label="Adjustments" value={form.adjustments ?? ''} onChange={(value) => setForm({ ...form, adjustments: value || null })} disabled={busy || disabled} />
        <EvidenceText id={`evidence-limitations-${requestId}`} label="Evidence limitations" value={form.limitations ?? ''} onChange={(value) => setForm({ ...form, limitations: value || null })} disabled={busy || disabled} />
        <EvidenceText id={`source-notes-${requestId}`} label="Internal source notes" value={form.internal_source_notes ?? ''} onChange={(value) => setForm({ ...form, internal_source_notes: value || null })} disabled={busy || disabled} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_publishable} onChange={(event) => setForm({ ...form, is_publishable: event.target.checked })} disabled={busy || disabled} />Publish a safe summary with the report</label>
      {form.is_publishable && <div className="mt-3"><EvidenceText id={`safe-summary-${requestId}`} label="Safe requester-facing summary *" value={form.publishable_summary ?? ''} onChange={(value) => setForm({ ...form, publishable_summary: value || null })} disabled={busy || disabled} /></div>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><Button type="button" disabled={busy || disabled || !form.why_relevant.trim() || (form.is_publishable && !(form.publishable_summary ?? '').trim())} onClick={() => void save()} className="h-9 rounded-xl">{editing ? 'Update evidence' : 'Add evidence'}</Button>{editing && <Button type="button" variant="outline" disabled={busy || disabled} onClick={() => { setEditing(null); setForm(blankEvidence()); }} className="h-9 rounded-xl">Cancel edit</Button>}</div>
      {items && items.length > 0 && <ul className="mt-3 space-y-2">{items.map((evidence) => <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900"><span>{evidence.evidence_type.replace('_', ' ')} — {evidence.why_relevant}</span><span className="flex gap-2"><Button type="button" variant="outline" className="h-7" disabled={busy || disabled} onClick={() => { setEditing(evidence.id); setForm(evidenceBody(evidence)); }}>Edit</Button><Button type="button" variant="outline" className="h-7 text-red-700" disabled={busy || disabled} onClick={() => void (async () => { setBusy(true); try { await deleteHomeValueEvidence(requestId, evidence.id); await reload(); } catch (err: unknown) { setError(serverMessage(err, 'Could not remove evidence.')); } finally { setBusy(false); } })()}>Remove</Button></span></li>)}</ul>}
    </section>
  );
}

function EvidenceText({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Textarea id={id} rows={2} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="rounded-xl" /></div>;
}
