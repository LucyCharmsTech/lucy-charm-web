'use client';

import { useEffect, useState } from 'react';
import { LoaderIcon, LockIcon, ShieldCheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { serverMessage } from '@/lib/formStates';
import {
  clearHomeValueCompliance,
  fetchStaffHomeValueRequests,
  publishHomeValueReport,
  saveHomeValueDraft,
} from '@/services/homeValueService';
import type { HomeValueRequestStaff } from '@/types/homeValue';

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

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <HomeValueQueueItem
          key={item.id}
          item={item}
          role={role}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
      ))}
    </ul>
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
  const [notes, setNotes] = useState(item.internal_notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const published = item.status === 'report_ready';
  const complianceCleared = Boolean(item.compliance_cleared_at);
  const canPublish =
    complianceCleared &&
    Number(low) > 0 &&
    Number(high) > 0 &&
    Number(low) <= Number(high) &&
    limitations.trim().length > 0 &&
    summary.trim().length > 0 &&
    !busy;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      onChanged();
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
          disabled={busy || published}
          onClick={() =>
            void run(
              () =>
                saveHomeValueDraft(item.id, {
                  value_low: low ? Number(low) : null,
                  value_high: high ? Number(high) : null,
                  limitations: limitations || null,
                  report_summary: summary || null,
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
                publishHomeValueReport(item.id, {
                  value_low: Number(low),
                  value_high: Number(high),
                  limitations: limitations.trim(),
                  report_summary: summary.trim(),
                }),
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
