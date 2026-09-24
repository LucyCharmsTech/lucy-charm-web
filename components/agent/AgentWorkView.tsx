'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchMyWork, type WorkItem } from '@/services/workItemService';

const STORAGE_KEY = 'lucy-agent-work-filters';
type WorkFilters = {
  status: string;
  queue: string;
  priority: string;
  overdue: boolean;
};
function contextHref(item: WorkItem): string {
  const id = encodeURIComponent(item.source_id);
  switch (item.source_type) {
    case 'lead': return `/agent/leads?lead_id=${id}`;
    case 'showing_request': return `/agent/showings?showing_request_id=${id}`;
    case 'home_value_request': return `/agent/home-value?request_id=${id}`;
    case 'property_review_request': return `/agent/property-reviews?request_id=${id}`;
    // There is no agent escalation screen yet. Keep agents in an authorized
    // workspace rather than linking an agent to the admin-only console.
    case 'ai_escalation': return `/agent?ai_escalation_id=${id}`;
    // A document may belong to a showing or a seller transaction. The current
    // work-item shape has only the document id, so retain it for the existing
    // agent workspace rather than guessing an unauthorized resource route.
    case 'document': return `/agent?document_id=${id}`;
    default: return '/agent';
  }
}

export default function AgentWorkView() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [filters, setFilters] = useState<WorkFilters>(() => {
    if (typeof window === 'undefined') return { status: 'open', queue: 'all', priority: 'all', overdue: false };
    try { return { status: 'open', queue: 'all', priority: 'all', overdue: false, ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') }; }
    catch { return { status: 'open', queue: 'all', priority: 'all', overdue: false }; }
  });
  const { status, queue, priority, overdue } = filters;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyWork().then(setItems).catch(() => setError('Could not load your work.'));
  }, []);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ status, queue, priority, overdue })); }, [status, queue, priority, overdue]);

  const rows = useMemo(() => items.filter((item) =>
    (status === 'all' || item.status === status) && (queue === 'all' || item.queue === queue) &&
    (priority === 'all' || item.priority === priority) && (!overdue || item.is_overdue),
  ), [items, status, queue, priority, overdue]);
  const queues = [...new Set(items.map((item) => item.queue))];

  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-extrabold">My work</h1><p className="text-sm text-zinc-600 dark:text-zinc-400">Actionable work assigned to you. Opening an item does not count as action.</p></div>
    <div className="flex flex-wrap gap-2"><select value={status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))} className="rounded border p-2 text-sm"><option value="all">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select><select value={queue} onChange={(e) => setFilters((current) => ({ ...current, queue: e.target.value }))} className="rounded border p-2 text-sm"><option value="all">All queues</option>{queues.map((value) => <option key={value}>{value}</option>)}</select><select value={priority} onChange={(e) => setFilters((current) => ({ ...current, priority: e.target.value }))} className="rounded border p-2 text-sm"><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option></select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overdue} onChange={(e) => setFilters((current) => ({ ...current, overdue: e.target.checked }))} />Overdue</label></div>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Work</th><th className="p-3">Priority</th><th className="p-3">Due</th><th className="p-3">Status</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><p className="font-medium">{item.title}</p><Link className="text-primarycolor-text hover:underline" href={contextHref(item)}>Open context</Link></td><td className="p-3 capitalize">{item.priority}</td><td className="p-3">{item.due_at ? new Date(item.due_at).toLocaleString() : 'Not scheduled'}{item.is_overdue && <span className="ml-2 text-red-600">Overdue</span>}</td><td className="p-3 capitalize">{item.status.replace('_', ' ')}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="p-6 text-sm text-zinc-500">No matching work items.</p>}</div></div>;
}
