'use client';

import Link from 'next/link';
import { leadStageLabel } from '@/components/common/LeadStageSelect';
import type {
  SuperadminDashboardSummary,
  SuperadminNamedCount,
} from '@/types/api';

function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = seconds / 60;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)} min`;
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
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

export default function SuperadminDashboardView({ data }: { data: SuperadminDashboardSummary }) {
  const funnel = data.lead_funnel_by_stage;
  const maxFunnel = Math.max(...funnel.map((s) => s.count), 1);
  const maxIntent = Math.max(...data.top_intent_types.map((s) => s.count), 1);
  const maxCta = Math.max(...data.cta_event_counts.map((s) => s.count), 1);
  const h = data.handoff_timing;
  const pipeline = data.pipeline;
  const maxPipeline = Math.max(...pipeline.by_stage.map((s) => s.count), 1);
  const analytics = data.section13_analytics;

  return (
    <div className="space-y-10">
      {analytics ? (
        <section aria-labelledby="analytics-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 id="analytics-heading" className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Section 13 first-party analytics
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Selected date range. Browser signals, server events, and authoritative conversions remain distinct.
              </p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${analytics.reconciliation_status === 'exact' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300'}`}>
              Reconciliation: {analytics.reconciliation_status}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Events in selected range</h3>
              {analytics.event_metrics.length === 0 ? <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No matching first-party events.</p> : (
                <ul className="mt-3 space-y-2" role="list">
                  {analytics.event_metrics.map((metric) => (
                    <li key={`${metric.event_name}:${metric.event_version}:${metric.producer}`} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-200" title={metric.event_name}>
                        {metric.event_name} v{metric.event_version}{' '}
                        <span className="text-xs text-zinc-500">{metric.producer === 'client' ? 'browser signal' : metric.authoritative_conversion ? 'authoritative conversion' : 'server event'}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums">{metric.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Authoritative conversion reconciliation (selected date range)</h3>
              <div className="mt-3 space-y-3">
                {analytics.reconciliation.map((row) => (
                  <div key={row.conversion_type} className="rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-800/60">
                    <div className="flex justify-between gap-2 font-semibold text-zinc-800 dark:text-zinc-100"><span>{row.conversion_type.replaceAll('_', ' ')}</span><span>{row.status}</span></div>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-300">{row.authoritative_records} authoritative · {row.matching_analytics_conversions} matched · {row.missing_analytics_conversions} missing · {row.orphan_analytics_conversions} orphan · {row.duplicate_conversion_anomalies} duplicate · {row.definition_mismatch_anomalies} definition mismatch</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <details className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <summary className="cursor-pointer font-semibold text-zinc-800 dark:text-zinc-100">Metric definitions</summary>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{analytics.range_semantics}</p>
            <ul className="mt-3 grid gap-2 md:grid-cols-2" role="list">
              {analytics.definitions.map((definition) => (
                <li key={definition.event_name} className="rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-800/60">
                  <strong>{definition.event_name} v{definition.version}</strong> — {definition.description}{' '}
                  <span className="text-zinc-500">({definition.category}; {definition.producers.join('/')}; {definition.essential ? 'essential' : 'non-essential'}{definition.authoritative_conversion ? '; authoritative conversion' : ''})</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : null}
      {/* Current pipeline position of every lead — distinct from the event
          funnel below, which counts things that happened. */}
      <section aria-labelledby="pipeline-heading">
        <h2
          id="pipeline-heading"
          className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Lead pipeline (current snapshot)
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="space-y-3">
              {pipeline.by_stage.map((stage) => (
                <BarRow
                  key={stage.status}
                  label={leadStageLabel(stage.status)}
                  count={stage.count}
                  max={maxPipeline}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Where each lead sits right now. Stages are set by hand in Inquiries or by the assigned
              agent.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Total leads
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                {pipeline.total_leads}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Unassigned
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                {pipeline.unassigned_leads}
              </p>
              {pipeline.unassigned_leads > 0 ? (
                <Link
                  href="/admin/inquiries"
                  className="mt-2 inline-flex text-xs font-semibold text-primarycolor-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                >
                  Assign them →
                </Link>
              ) : (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Every lead has an owner.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="handoff-heading">
        <h2
          id="handoff-heading"
          className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Agent handoff (escalations)
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          All retained assigned escalations; deleted records are excluded.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Sample size
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {h.sample_size}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Rows with{' '}
              <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">assigned_at</code>
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
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            All retained non-deleted AI intent events.
          </p>
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
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            All retained lead events, counted independently rather than as a linked cohort.
          </p>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <ul className="space-y-3" role="list">
              {funnel.map((row) => (
                <li key={row.event_type}>
                  <BarRow label={row.event_type} count={row.count} max={maxFunnel} />
                </li>
              ))}
            </ul>
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
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            All retained qualifying lead events.
          </p>
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
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            All retained qualifying lead events linked to currently non-deleted leads.
          </p>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            {data.top_listings_by_engagement.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No listing-tied engagement yet.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" role="list">
                {data.top_listings_by_engagement.map((row) => (
                  <li
                    key={row.listing_id}
                    className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <Link
                      href={`/admin/listings/${row.listing_id}`}
                      className="truncate font-mono text-xs text-primarycolor-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
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
