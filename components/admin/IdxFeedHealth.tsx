'use client';

import { useEffect, useState } from 'react';

import api from '@/lib/axios';

type ResourceHealth = {
  resource_name: string;
  status: 'ok' | 'warn' | 'critical' | 'unavailable';
  reason: string | null;
  last_run_age_hours: number | null;
  cursor_lag_hours: number | null;
  reconciled_age_hours?: number | null;
  open_runs: number;
};

type HealthReport = {
  status: 'ok' | 'warn' | 'critical' | 'unavailable';
  checked_at: string;
  unresolved_failures: number;
  quarantined_failures: number;
  resources: ResourceHealth[];
};

const TONE: Record<ResourceHealth['status'], string> = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50',
  warn: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50',
  critical: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50',
  unavailable: 'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-400 dark:border-zinc-700',
};

const HEADLINE: Record<HealthReport['status'], string> = {
  ok: 'Listing feed is up to date',
  warn: 'Listing feed is falling behind',
  critical: 'Listing feed is stale',
  unavailable: 'Listing feed status unknown',
};

/**
 * Whether the feed is actually moving.
 *
 * The API has graded this since the thirteen-day outage — cursor lag scored
 * separately from run age, because a run that completes cleanly while the
 * cursor sits days behind is exactly the failure that went unnoticed — and
 * nothing rendered it. An endpoint that only answers when asked needs someone
 * to ask.
 */
export default function IdxFeedHealth() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<HealthReport>('/admin/idx/health', {
        // 503 is the answer, not an error: the endpoint uses the status code so
        // ordinary uptime monitoring catches a stale feed without reading JSON.
        validateStatus: (status) => status === 200 || status === 503,
      })
      .then((res) => {
        if (!cancelled) setReport(res.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !report) return null;

  const stale = report.resources.filter(
    (resource) => resource.status === 'warn' || resource.status === 'critical',
  );

  return (
    <section
      className={`mb-6 rounded-xl border px-4 py-3 ${TONE[report.status]}`}
      aria-label="Listing feed health"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold">{HEADLINE[report.status]}</p>
        <p className="text-xs opacity-80">
          checked {new Date(report.checked_at).toLocaleTimeString()}
        </p>
      </div>

      {stale.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {stale.map((resource) => (
            <li key={resource.resource_name}>
              <span className="font-semibold">{resource.resource_name}</span>
              {resource.reason ? ` — ${resource.reason}` : null}
            </li>
          ))}
        </ul>
      )}

      {report.quarantined_failures > 0 && (
        <p className="mt-2 text-xs">
          <span className="font-semibold">{report.quarantined_failures}</span> record
          {report.quarantined_failures === 1 ? '' : 's'} quarantined — nothing will retry
          {report.quarantined_failures === 1 ? ' it' : ' them'} without someone looking.
        </p>
      )}
    </section>
  );
}
