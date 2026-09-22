'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  fetchMyWork,
  fetchWorkItemHistory,
  updateWorkItem,
  type WorkItem,
  type WorkItemHistory,
} from '@/services/workItemService';
import { fetchAgentsAdmin } from '@/services/superadminService';
import type { AgentProfile } from '@/types/api';

function errorMessage(error: unknown, fallback: string) {
  return String(
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback,
  );
}

export default function AdminWorkPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [history, setHistory] = useState<Record<string, WorkItemHistory[]>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [owner, setOwner] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [work, staff] = await Promise.all([fetchMyWork(), fetchAgentsAdmin()]);
      setItems(work);
      setAgents(staff.filter((agent) => agent.status === 'active'));
    } catch (loadError) {
      setError(errorMessage(loadError, 'Could not load the work queue.'));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const agentName = (userId: string | null) =>
    agents.find((agent) => agent.user_id === userId)?.name ?? (userId ? 'Staff user' : 'Unassigned');

  async function apply(item: WorkItem, payload: { owner_user_id?: string; due_at?: string }) {
    const note = reason[item.id]?.trim();
    if (!note) {
      setError('A reason is required for reassignment and deadline changes.');
      return;
    }
    setBusy(item.id);
    setError(null);
    try {
      const updated = await updateWorkItem(item.id, { ...payload, reason: note });
      setItems((current) => current.map((value) => (value.id === updated.id ? updated : value)));
      setHistory((current) => ({ ...current, [item.id]: [] }));
      const updatedHistory = await fetchWorkItemHistory(item.id);
      setHistory((current) => ({ ...current, [item.id]: updatedHistory }));
      setReason((current) => ({ ...current, [item.id]: '' }));
    } catch (updateError) {
      setError(errorMessage(updateError, 'Could not update this work item.'));
    } finally {
      setBusy(null);
    }
  }

  async function toggleHistory(item: WorkItem) {
    if (history[item.id]) {
      setHistory((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      return;
    }
    try {
      const entries = await fetchWorkItemHistory(item.id);
      setHistory((current) => ({ ...current, [item.id]: entries }));
    } catch (historyError) {
      setError(errorMessage(historyError, 'Could not load work-item history.'));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">Daily work queue</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Assign staff ownership and adjust deadlines with an auditable reason.</p>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <tr><th className="px-4 py-3">Work</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {items.map((item) => (
              <Fragment key={item.id}>
                <tr key={item.id}>
                  <td className="px-4 py-3"><p className="font-medium text-zinc-900 dark:text-zinc-50">{item.title}</p><p className="text-xs capitalize text-zinc-500">{item.queue} · {item.priority}</p></td>
                  <td className="px-4 py-3 capitalize">{item.status.replace('_', ' ')}</td>
                  <td className="px-4 py-3"><p className="mb-1 text-xs text-zinc-500">{agentName(item.owner_user_id)}</p><select value={owner[item.id] ?? ''} onChange={(event) => setOwner((current) => ({ ...current, [item.id]: event.target.value }))} className="w-44 rounded border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="">Choose staff…</option>{agents.map((agent) => <option key={agent.user_id} value={agent.user_id}>{agent.name}</option>)}</select></td>
                  <td className="px-4 py-3"><p className="mb-1 text-xs text-zinc-500">{item.due_at ? new Date(item.due_at).toLocaleString() : 'Not scheduled'}</p><input type="datetime-local" value={deadline[item.id] ?? ''} onChange={(event) => setDeadline((current) => ({ ...current, [item.id]: event.target.value }))} className="rounded border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></td>
                  <td className="px-4 py-3"><input value={reason[item.id] ?? ''} onChange={(event) => setReason((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Required reason" className="w-52 rounded border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></td>
                  <td className="space-x-2 px-4 py-3"><button type="button" disabled={busy === item.id || !owner[item.id]} onClick={() => void apply(item, { owner_user_id: owner[item.id] })} className="rounded bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">Reassign</button><button type="button" disabled={busy === item.id || !deadline[item.id]} onClick={() => void apply(item, { due_at: new Date(deadline[item.id]).toISOString() })} className="rounded border border-zinc-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-zinc-700">Set deadline</button><button type="button" onClick={() => void toggleHistory(item)} className="text-xs font-semibold text-primarycolor-text hover:underline">{history[item.id] ? 'Hide history' : 'History'}</button></td>
                </tr>
                {history[item.id] && <tr><td colSpan={6} className="bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50"><ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">{history[item.id].length ? history[item.id].map((entry) => <li key={entry.id}>{new Date(entry.created_at).toLocaleString()} — {entry.action.replaceAll('_', ' ')}{entry.reason ? `: ${entry.reason}` : ''}</li>) : <li>No recorded changes.</li>}</ul></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="p-6 text-center text-sm text-zinc-500">No work items yet.</p>}
      </div>
    </div>
  );
}
