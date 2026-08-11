'use client';

import { useEffect, useState } from 'react';
import { TimerIcon } from 'lucide-react';
import { fetchMyAgentInsights } from '@/services/portalService';
import type { AgentInsightsResponse } from '@/types/api';

/** "2d 4h" / "3h 12m" / "8m" — coarse on purpose; seconds are noise here. */
function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Task 17 (reduced scope): the agent's own response-time metrics.
 * Data comes from our database, never PostHog — it is per-agent and
 * role-scoped on the server.
 */
export default function AgentResponseTimeCard() {
  const [insights, setInsights] = useState<AgentInsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMyAgentInsights()
      .then((data) => {
        if (!active) return;
        setInsights(data);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load your response times.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = insights?.showings;

  return (
    <section
      aria-labelledby="response-times-heading"
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
    >
      <div className="flex items-start gap-3">
        <TimerIcon className="mt-0.5 size-5 text-primarycolor" aria-hidden="true" />
        <div>
          <h2
            id="response-times-heading"
            className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
          >
            Response times
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            How quickly you confirm showing requests.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : !stats || stats.confirmed_count === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No confirmed showings yet. Your average confirmation time appears here after your first
          one.
        </p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Average
            </dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDuration(stats.avg_seconds_to_confirm ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Fastest
            </dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDuration(stats.min_seconds_to_confirm ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Slowest
            </dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDuration(stats.max_seconds_to_confirm ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Confirmed
            </dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
              {stats.confirmed_count}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
