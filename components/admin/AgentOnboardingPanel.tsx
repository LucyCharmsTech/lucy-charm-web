'use client';

import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  activateAgent,
  createAgentInvitation,
  fetchAgentOnboarding,
  fetchAgentProfileOptions,
  resendAgentInvitation,
  type AgentInvitationPayload,
} from '@/services/agentOnboardingService';
import type { AgentOnboarding } from '@/types/api';

const initial: AgentInvitationPayload = {
  legal_name: '', email: '', phone: '', registration_category: '',
  registration_title: '', reco_registration_id: '', system_role: 'agent',
};
const PAGE_SIZE = 50;

export function AgentOnboardingPanel() {
  const [rows, setRows] = useState<AgentOnboarding[]>([]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [options, setOptions] = useState({
    registration_categories: [] as string[],
    registration_titles: [] as string[],
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function refresh() { setLoading(true); setReloadKey((key) => key + 1); }
  // Existing action handlers call this after a mutation; retain their page.
  function load() { refresh(); }
  useEffect(() => {
    let active = true;
    fetchAgentOnboarding(page, PAGE_SIZE)
      .then((data) => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
        if (page > lastPage) { setPage(lastPage); return; }
        setRows(data.items);
        setTotal(data.total); setError(null);
      })
      .catch((err: unknown) => {
        if (active) setError(getApiErrorMessage(err, 'Could not load agent onboarding.'));
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, reloadKey]);
  useEffect(() => {
    fetchAgentProfileOptions().then(setOptions)
      .catch((err: unknown) => setError(getApiErrorMessage(err, 'Could not load agent onboarding.')));
  }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setNotice(null);
    try {
      await createAgentInvitation(form);
      setForm(initial); setNotice('Invitation sent.'); refresh();
    } catch (err: unknown) { setError(getApiErrorMessage(err, 'Could not send invitation.')); }
    finally { setBusy(false); }
  }

  const fields = [
    ['legal_name', 'Legal name'], ['email', 'Email'], ['phone', 'Phone'],
    ['reco_registration_id', 'RECO registration ID'],
  ] as const;

  return <div className="space-y-8">
    <form onSubmit={invite} className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="md:col-span-2 font-semibold">Add agent</h2>
      {fields.map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input required type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950" /></label>)}
      <label className="text-sm font-medium">Registration category
        <select required value={form.registration_category} onChange={(e) => setForm((current) => ({ ...current, registration_category: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950">
          <option value="">Select category</option>
          {options.registration_categories.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Registration title
        <select required value={form.registration_title} onChange={(e) => setForm((current) => ({ ...current, registration_title: e.target.value }))} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-950">
          <option value="">Select title</option>
          {options.registration_titles.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <button disabled={busy} className="w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send invitation'}</button>
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {error && <p role="alert" className="md:col-span-2 text-sm text-red-600">{error}</p>}
    </form>
    <section className="space-y-3">
      <h2 className="font-semibold">Agent onboarding</h2>
      {rows.length === 0 ? <p className="text-sm text-zinc-500">No invited agents yet.</p> : rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div><p className="font-medium">{row.legal_name}</p><p className="text-sm text-zinc-500">{row.email} · {row.registration_title} · {row.status}</p></div><div className="flex gap-2">{row.status !== 'active' && row.status !== 'profile_complete' && <button onClick={() => void resendAgentInvitation(row.id).then(load).catch((err: unknown) => setError(getApiErrorMessage(err, 'Could not resend invitation.')))} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-700">Resend</button>}{row.status === 'profile_complete' && <button onClick={() => void activateAgent(row.id).then(load).catch((err: unknown) => setError(getApiErrorMessage(err, 'Could not activate this agent.')))} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Activate</button>}</div></div>)}
      {loading && <p className="text-sm text-zinc-500">Loadingâ€¦</p>}
      {total > PAGE_SIZE && <nav aria-label="Agent onboarding pages" className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={page === 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }} className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-50 dark:border-zinc-700">Previous</button><span className="text-zinc-600 dark:text-zinc-400">Page {page} of {totalPages} · {total} agents</span><button type="button" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-50 dark:border-zinc-700">Next</button></nav>}
    </section>
  </div>;
}
