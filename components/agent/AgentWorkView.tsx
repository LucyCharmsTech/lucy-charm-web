'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchMyWorkPage,
  type WorkItem,
  type WorkItemFilters,
} from '@/services/workItemService';

const STORAGE_KEY = 'lucy-agent-work-filters';
const PAGE_SIZE = 25;
const KNOWN_QUEUES = ['leads', 'showings', 'home_value', 'property_review', 'ai_handoffs', 'documents'];
type WorkFilters = Required<WorkItemFilters>;

function defaultFilters(): WorkFilters {
  return { status: 'open', queue: 'all', priority: 'all', overdue: false };
}

function contextHref(item: WorkItem): string {
  const id = encodeURIComponent(item.source_id);
  switch (item.source_type) {
    case 'lead': return `/agent/leads?lead_id=${id}`;
    case 'showing_request': return `/agent/showings?showing_request_id=${id}`;
    case 'home_value_request': return `/agent/home-value?request_id=${id}`;
    case 'property_review_request': return `/agent/property-reviews?request_id=${id}`;
    case 'ai_escalation': return `/agent?ai_escalation_id=${id}`;
    case 'document': return `/agent?document_id=${id}`;
    default: return '/agent';
  }
}

export default function AgentWorkView() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [filters, setFilters] = useState<WorkFilters>(() => {
    if (typeof window === 'undefined') return defaultFilters();
    try { return { ...defaultFilters(), ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') }; }
    catch { return defaultFilters(); }
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    let active = true;
    const requestFilters: WorkItemFilters = {
      ...(filters.status !== 'all' ? { status: filters.status } : {}),
      ...(filters.queue !== 'all' ? { queue: filters.queue } : {}),
      ...(filters.priority !== 'all' ? { priority: filters.priority } : {}),
      ...(filters.overdue ? { overdue: true } : {}),
    };
    fetchMyWorkPage(page, PAGE_SIZE, requestFilters)
      .then((result) => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
        if (page > lastPage) { setPage(lastPage); return; }
        setItems(result.items);
        setTotal(result.total);
        setPageSize(result.page_size);
        setError(null);
      })
      .catch(() => { if (active) setError('Could not load your work.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page]);

  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters)); }, [filters]);

  const queues = useMemo(
    () => Array.from(new Set([...KNOWN_QUEUES, ...(filters.queue === 'all' ? [] : [filters.queue])])),
    [filters.queue],
  );
  function updateFilters(patch: Partial<WorkFilters>) {
    setLoading(true);
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-extrabold">My work</h1><p className="text-sm text-zinc-600 dark:text-zinc-400">Actionable work assigned to you. Opening an item does not count as action.</p></div>
    <div className="flex flex-wrap gap-2"><select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })} className="rounded border p-2 text-sm"><option value="all">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select><select value={filters.queue} onChange={(event) => updateFilters({ queue: event.target.value })} className="rounded border p-2 text-sm"><option value="all">All queues</option>{queues.map((value) => <option key={value} value={value}>{value}</option>)}</select><select value={filters.priority} onChange={(event) => updateFilters({ priority: event.target.value })} className="rounded border p-2 text-sm"><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.overdue} onChange={(event) => updateFilters({ overdue: event.target.checked })} />Overdue</label></div>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Work</th><th className="p-3">Priority</th><th className="p-3">Due</th><th className="p-3">Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><p className="font-medium">{item.title}</p><Link className="text-primarycolor-text hover:underline" href={contextHref(item)}>Open context</Link></td><td className="p-3 capitalize">{item.priority}</td><td className="p-3">{item.due_at ? new Date(item.due_at).toLocaleString() : 'Not scheduled'}{item.is_overdue && <span className="ml-2 text-red-600">Overdue</span>}</td><td className="p-3 capitalize">{item.status.replace('_', ' ')}</td></tr>)}</tbody></table>{!loading && items.length === 0 && <p className="p-6 text-sm text-zinc-500">No matching work items.</p>}</div>
    {totalPages > 1 && <nav className="flex items-center justify-center gap-4" aria-label="My Work pagination"><button type="button" disabled={page === 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700">Previous</button><span className="text-xs font-semibold text-zinc-500">Page {page} of {totalPages} · {total} items</span><button type="button" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700">Next</button></nav>}
  </div>;
}
