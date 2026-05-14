'use client';

import Link from 'next/link';
import type {
  SuperadminDashboardSummary,
  SuperadminFunnelStage,
  SuperadminNamedCount,
} from '@/types/api';

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = seconds / 60;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)} min`;
}

function BarRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="truncate font-medium text-zinc-800 dark:text-zinc-200" title={label}>
          {label}
        </span>
        <span className="shrink-0 tabular-nums">{count}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-primarycolor transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function funnelDropLabel(stages: SuperadminFunnelStage[], index: number): string {
  if (index <= 0) return '';
  const prev = stages[index - 1]?.count ?? 0;
  const cur = stages[index]?.count ?? 0;
  if (prev <= 0) return '';
  const drop = Math.round((1 - cur / prev) * 100);
  return `−${drop}% vs prior`;
}

export default function SuperadminDashboardView({ data }: { data: SuperadminDashboardSummary }) {
  const funnel = data.lead_funnel_by_stage;
  const maxFunnel = Math.max(...funnel.map((s) => s.count), 1);
  const maxIntent = Math.max(...data.top_intent_types.map((s) => s.count), 1);
  const maxCta = Math.max(...data.cta_event_counts.map((s) => s.count), 1);
  const h = data.handoff_timing;

  return (
    <div className="space-y-10">
      <section aria-labelledby="handoff-heading">
        <h2
          id="handoff-heading"
          className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Agent handoff (escalations)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Sample size
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {h.sample_size}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Rows with <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">assigned_at</code>
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Avg time to assign
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDurationSeconds(h.avg_seconds_to_assign)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Min</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDurationSeconds(h.min_seconds_to_assign)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Max</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDurationSeconds(h.max_seconds_to_assign)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="intents-heading">
          <h2
            id="intents-heading"
            className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Top user intents (from AI intent events)
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            {data.top_intent_types.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No intent events yet.</p>
            ) : (
              <ul className="space-y-3" role="list">
                {data.top_intent_types.map((row: SuperadminNamedCount) => (
                  <li key={row.key}>
                    <BarRow label={row.key} count={row.count} max={maxIntent} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="funnel-heading">
          <h2
            id="funnel-heading"
            className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Lead funnel (immutable events)
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <ul className="space-y-3" role="list">
              {funnel.map((row, i) => {
                const drop = funnelDropLabel(funnel, i);
                return (
                  <li key={row.event_type} className="space-y-0.5">
                    <BarRow label={row.event_type} count={row.count} max={maxFunnel} />
                    {drop ? (
                      <p className="pl-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{drop}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Drop-off labels compare each stage to the prior stage in this ordered funnel.
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="cta-heading">
          <h2
            id="cta-heading"
            className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            CTA volume (key lead events)
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            {data.cta_event_counts.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No CTA events recorded.</p>
            ) : (
              <ul className="space-y-3" role="list">
                {data.cta_event_counts.map((row: SuperadminNamedCount) => (
                  <li key={row.key}>
                    <BarRow label={row.key} count={row.count} max={maxCta} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="listings-heading">
          <h2
            id="listings-heading"
            className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Top listings by engagement
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            {data.top_listings_by_engagement.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No listing-tied engagement yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" role="list">
                {data.top_listings_by_engagement.map((row) => (
                  <li
                    key={row.listing_id}
                    className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <Link
                      href={`/admin/listings/${row.listing_id}`}
                      className="truncate font-mono text-xs text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                    >
                      {row.listing_id}
                    </Link>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                      {row.engagement_events}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
