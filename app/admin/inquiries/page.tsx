'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import LeadStageSelect from '@/components/common/LeadStageSelect';
import { fetchAgentsAdmin, fetchLeadsAdmin } from '@/services/superadminService';
import type { AgentProfile, ApiPaginated, LeadRead } from '@/types/api';

const PAGE_SIZE = 25;

type LeadFilter = 'all' | 'unassigned';

export default function AdminInquiriesPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<LeadFilter>('all');
  const [data, setData] = useState<ApiPaginated<LeadRead> | null>(null);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number, f: LeadFilter) => {
    setLoading(true);
    try {
      const res = await fetchLeadsAdmin(p, PAGE_SIZE, f === 'unassigned');
      setData(res);
      setError(null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not load leads.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, filter);
  }, [load, page, filter]);

  useEffect(() => {
    let active = true;
    fetchAgentsAdmin()
      .then((list) => {
        if (active) setAgents(list);
      })
      .catch(() => {
        // Agent names are a nicety on this list; the id fallback still renders.
      });
    return () => {
      active = false;
    };
  }, []);

  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

  const totalPages =
    data && data.total > 0 ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  if (loading && !data) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading inquiries…</p>;
  }
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

  const rows = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            All inquiries (leads)
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Brokerage-wide canonical leads with capture-time contact fields.
          </p>
        </div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {data?.total ?? 0} total
        </p>
      </div>

      {/* All vs Unassigned — unassigned leads have no listing agent and need a manual owner. */}
      <div className="flex items-center gap-2" role="tablist" aria-label="Lead filter">
        {(
          [
            { key: 'all', label: 'All leads' },
            { key: 'unassigned', label: 'Unassigned' },
          ] as { key: LeadFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filter === tab.key}
            onClick={() => {
              setFilter(tab.key);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${
              filter === tab.key
                ? 'bg-primarycolor text-primarycolor-foreground shadow-sm'
                : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Previous
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          Next
          <ChevronRightIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No leads yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Contact
                </th>
                <th scope="col" className="px-4 py-3">
                  Stage
                </th>
                <th scope="col" className="px-4 py-3">
                  Agent
                </th>
                <th scope="col" className="px-4 py-3">
                  Source
                </th>
                <th scope="col" className="px-4 py-3">
                  Listing
                </th>
                <th scope="col" className="px-4 py-3">
                  Created
                </th>
                <th scope="col" className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className="bg-white dark:bg-zinc-950/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                    </p>
                    {r.email && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.email}</p>
                    )}
                    {r.phone && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStageSelect lead={r} />
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {r.assigned_agent_id ? (
                      (agentNameById.get(r.assigned_agent_id) ??
                        `${r.assigned_agent_id.slice(0, 8)}…`)
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {r.source ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {r.listing_id ? (
                      <Link
                        href={`/admin/listings/${r.listing_id}`}
                        className="text-primarycolor-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                      >
                        {r.listing_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/inquiries/${r.id}`}
                      className="font-semibold text-primarycolor-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
