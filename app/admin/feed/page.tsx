'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PlayIcon,
  RefreshCwIcon,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  IDX_SYNC_JOBS,
  fetchIdxFailures,
  fetchIdxHealth,
  fetchIdxJobs,
  fetchIdxScheduler,
  triggerIdxReconcile,
  triggerIdxSync,
} from '@/services/feedOperationsService';
import type {
  IdxFailuresReport,
  IdxHealthReport,
  IdxJobsStatus,
  IdxSchedulerStatus,
} from '@/types/api';

/**
 * IDX/PropTx feed operations — control 3.4.
 *
 * *"There are fifteen functions for running a sync, checking job history,
 * reviewing failed records and reading reconciliation reports. Only one has a
 * screen. The reports your checklist asks for are being produced and nobody
 * can read them."*
 *
 * Four panels, in the order someone actually needs them when the feed is
 * misbehaving: **is it healthy**, **what failed**, **what is running**, and
 * **run something**.
 *
 * Health leads because 3.4 is about safe degradation — the question is never
 * "did the last run finish" but "is the feed still moving".
 */

function ageLabel(hours: number | null): string {
  if (hours === null) return 'never';
  if (hours < 1) return 'under an hour ago';
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function toneFor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'ok' || s === 'healthy' || s === 'completed') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (s === 'critical' || s === 'failed') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  }
  if (s === 'unavailable' || s === 'never_run') {
    return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function FeedOperationsPage() {
  const [health, setHealth] = useState<IdxHealthReport | null>(null);
  const [jobs, setJobs] = useState<IdxJobsStatus | null>(null);
  const [scheduler, setScheduler] = useState<IdxSchedulerStatus | null>(null);
  const [failures, setFailures] = useState<IdxFailuresReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Each panel resolves on its own: one unavailable endpoint must not blank
    // the whole screen, which is the moment this page is most needed.
    Promise.allSettled([
      fetchIdxHealth(),
      fetchIdxJobs(),
      fetchIdxScheduler(),
      fetchIdxFailures(true, 50),
    ]).then((results) => {
      if (!active) return;
      const [h, j, s, f] = results;
      if (h.status === 'fulfilled') setHealth(h.value);
      if (j.status === 'fulfilled') setJobs(j.value);
      if (s.status === 'fulfilled') setScheduler(s.value);
      if (f.status === 'fulfilled') setFailures(f.value);

      const failed = results.filter((r) => r.status === 'rejected');
      setError(
        failed.length === results.length
          ? getApiErrorMessage(
              (failed[0] as PromiseRejectedResult).reason,
              'Could not reach the feed service.',
            )
          : failed.length > 0
            ? 'Some feed information could not be loaded. What is shown is current.'
            : null,
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  function refresh() {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
      // The API answers 202 and works in the background, so say that rather
      // than implying it has finished.
      setNotice(`${label} started. It runs in the background — refresh to see progress.`);
      refresh();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, `Could not start ${label}.`));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
            Property feed
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Health, failures, running work, and manual syncs for the PropTx/IDX
            feed.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <RefreshCwIcon className="size-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* ── Health ──────────────────────────────────────────────────────── */}
        <Panel
          title="Feed health"
          subtitle="Whether the feed is actually moving, not just whether the last run finished."
        >
          {!health ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? 'Loading…' : 'Health is unavailable.'}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${toneFor(health.status)}`}
                >
                  {health.status === 'ok' ? (
                    <CheckCircle2Icon className="size-4" aria-hidden="true" />
                  ) : (
                    <AlertTriangleIcon className="size-4" aria-hidden="true" />
                  )}
                  {health.status}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {health.source_system} · checked{' '}
                  {new Date(health.checked_at).toLocaleTimeString()}
                </span>
              </div>

              {(health.unresolved_failures > 0 || health.quarantined_failures > 0) && (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
                  {health.unresolved_failures} unresolved
                  {health.quarantined_failures > 0 && (
                    <>
                      , <strong>{health.quarantined_failures} quarantined</strong> —
                      nothing will retry those
                    </>
                  )}
                </p>
              )}

              <ul className="mt-4 space-y-2">
                {health.resources.map((r) => (
                  <li
                    key={r.resource_name}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {r.resource_name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        last run {ageLabel(r.last_run_age_hours)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneFor(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        {/* ── Scheduler ───────────────────────────────────────────────────── */}
        <Panel title="Scheduler" subtitle="The automatic sync, and when it next runs.">
          {!scheduler ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? 'Loading…' : 'Scheduler state is unavailable.'}
            </p>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600 dark:text-zinc-400">Enabled</dt>
                <dd
                  className={
                    scheduler.enabled
                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                      : 'font-semibold text-amber-700 dark:text-amber-400'
                  }
                >
                  {scheduler.enabled ? 'Yes' : 'No — nothing syncs on its own'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600 dark:text-zinc-400">Currently running</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {scheduler.running ? 'Yes' : 'No'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600 dark:text-zinc-400">Checks every</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {scheduler.interval_minutes} min
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600 dark:text-zinc-400">Last finished</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {scheduler.last_finished_at
                    ? new Date(scheduler.last_finished_at).toLocaleString()
                    : 'never'}
                </dd>
              </div>
            </dl>
          )}
        </Panel>
      </div>

      {/* ── Failures ───────────────────────────────────────────────────────── */}
      <div className="mt-5">
        <Panel
          title="Failed records"
          subtitle="Records the feed could not write. Quarantined ones are no longer retried by anything."
        >
          {!failures ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? 'Loading…' : 'Failure records are unavailable.'}
            </p>
          ) : failures.records.length === 0 ? (
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Nothing outstanding. Every record the feed sent has been written.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {failures.unresolved_total} unresolved · quarantined after{' '}
                {failures.quarantine_after_attempts} attempts
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    <tr>
                      <th scope="col" className="py-2 pr-4">Record</th>
                      <th scope="col" className="py-2 pr-4">Resource</th>
                      <th scope="col" className="py-2 pr-4">Stage</th>
                      <th scope="col" className="py-2 pr-4">Error</th>
                      <th scope="col" className="py-2 pr-4">Tries</th>
                      <th scope="col" className="py-2">Last failed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {failures.records.map((r) => (
                      <tr key={`${r.resource_name}-${r.source_key}`}>
                        <td className="py-2 pr-4 font-mono text-xs">{r.source_key}</td>
                        <td className="py-2 pr-4">{r.resource_name}</td>
                        <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                          {r.stage}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className="block max-w-[18rem] truncate text-zinc-700 dark:text-zinc-300"
                            title={r.error_message}
                          >
                            {r.error_type}: {r.error_message}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          {r.attempts}
                          {r.quarantined && (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
                              quarantined
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {new Date(r.last_failed_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ── Jobs + manual runs ─────────────────────────────────────────────── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Recent jobs" subtitle="What has run, and how it ended.">
          {!jobs ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {loading ? 'Loading…' : 'Job history is unavailable.'}
            </p>
          ) : jobs.jobs.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nothing has run since the service last started.
            </p>
          ) : (
            <ul className="space-y-2">
              {jobs.jobs.map((job) => (
                <li
                  key={job.job}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {job.job}
                  </span>
                  <span className="flex items-center gap-2">
                    {job.error && (
                      <span
                        className="max-w-[14rem] truncate text-xs text-red-600 dark:text-red-400"
                        title={job.error}
                      >
                        {job.error}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {job.finished_at
                        ? new Date(job.finished_at).toLocaleTimeString()
                        : job.started_at
                          ? `started ${new Date(job.started_at).toLocaleTimeString()}`
                          : ''}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneFor(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Run a sync"
          subtitle="Each starts in the background. Starting one that is already running is refused, not duplicated."
        >
          <div className="flex flex-wrap gap-2">
            {IDX_SYNC_JOBS.map((job) => (
              <button
                key={job.label}
                type="button"
                title={job.hint}
                disabled={busy !== null}
                onClick={() => void run(job.label, () => triggerIdxSync(job.path))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <PlayIcon className="size-3.5" aria-hidden="true" />
                {job.label}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Reconciliation retires listings the board no longer carries. Run it
              when the catalogue looks stale rather than on a whim — it removes
              records.
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('Reconciliation', triggerIdxReconcile)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/20"
            >
              <ClockIcon className="size-3.5" aria-hidden="true" />
              Run reconciliation
            </button>
          </div>
        </Panel>
      </div>
    </main>
  );
}
