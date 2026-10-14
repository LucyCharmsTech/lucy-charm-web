'use client';

import { FormEvent, useEffect, useState } from 'react';
import SuperadminDashboardView from '@/components/admin/SuperadminDashboardView';
import {
  fetchSuperadminDashboard,
  type AnalyticsDashboardFilters,
} from '@/services/superadminService';
import type { SuperadminDashboardSummary } from '@/types/api';
import { localDateTimeToUtc } from '@/lib/analyticsDateRange';

export default function AdminInsightsPage() {
  const [data, setData] = useState<SuperadminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AnalyticsDashboardFilters>({});

  useEffect(() => {
    let cancelled = false;
    fetchSuperadminDashboard(filters)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load dashboard metrics.';
        if (!cancelled) {
          setError(String(msg));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const start = String(form.get('start') || '');
    const end = String(form.get('end') || '');
    const version = String(form.get('version') || '');
    setFilters({
      analytics_start: localDateTimeToUtc(start),
      analytics_end: localDateTimeToUtc(end),
      analytics_event_name: String(form.get('event_name') || '') || undefined,
      analytics_event_version: version ? Number(version) : undefined,
      analytics_producer: (String(form.get('producer') || '') || undefined) as
        | 'client'
        | 'server'
        | undefined,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Insights
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Funnel health, recurring intents, listing engagement, CTA volume, and escalation handoff
          timing.
        </p>
      </div>
      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5 dark:border-zinc-800 dark:bg-zinc-900/60"
        aria-label="Section 13 analytics filters"
      >
        <p className="text-xs text-zinc-600 sm:col-span-2 lg:col-span-5 dark:text-zinc-400">
          The date range applies only to Section 13 events and conversion reconciliation. Event,
          version, and producer filters narrow event counts only; legacy operational panels below
          retain their own time scopes.
        </p>
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          From (your local time)
          <input name="start" type="datetime-local" className="mt-1 block w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" />
        </label>
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          To (your local time, exclusive)
          <input name="end" type="datetime-local" className="mt-1 block w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" />
        </label>
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Event
          <select name="event_name" className="mt-1 block w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700">
            <option value="">All canonical events</option>
            {(data?.section13_analytics?.definitions ?? []).map((definition) => (
              <option key={definition.event_name} value={definition.event_name}>{definition.event_name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Version
          <input name="version" type="number" min="1" inputMode="numeric" className="mt-1 block w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700" />
        </label>
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Producer
            <select name="producer" className="mt-1 block w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700">
              <option value="">Browser + server</option>
              <option value="client">Browser</option>
              <option value="server">Server</option>
            </select>
          </label>
          <button type="submit" className="rounded bg-primarycolor px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
            Apply
          </button>
        </div>
      </form>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading insights…</p>}
      {data && !error && !loading && (
        <>
          {data.section13_analytics && (
            <p className="text-xs text-zinc-600 dark:text-zinc-400" aria-label="Selected analytics range">
              Section 13 selected range (your local time): {new Date(data.section13_analytics.range_start).toLocaleString()} to {new Date(data.section13_analytics.range_end).toLocaleString()} (end exclusive). API UTC: {data.section13_analytics.range_start} to {data.section13_analytics.range_end}.
            </p>
          )}
          <SuperadminDashboardView data={data} />
        </>
      )}
    </div>
  );
}
