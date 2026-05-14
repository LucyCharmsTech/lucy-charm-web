'use client';

import { useEffect, useState } from 'react';
import SuperadminDashboardView from '@/components/admin/SuperadminDashboardView';
import { fetchSuperadminDashboard } from '@/services/superadminService';
import type { SuperadminDashboardSummary } from '@/types/api';

export default function AdminInsightsPage() {
  const [data, setData] = useState<SuperadminDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSuperadminDashboard()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load dashboard metrics.';
        if (!cancelled) setError(String(msg));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading insights…</p>;
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
      <SuperadminDashboardView data={data} />
    </div>
  );
}
