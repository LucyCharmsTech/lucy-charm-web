'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon } from 'lucide-react';
import LeadNotesTagsPanel from '@/components/admin/LeadNotesTagsPanel';
import LeadStageSelect from '@/components/common/LeadStageSelect';
import {
  assignLeadAgent,
  fetchAgentsAdmin,
  fetchLeadById,
} from '@/services/superadminService';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import type { AgentProfile, LeadRead } from '@/types/api';

export default function AdminLeadDetailPage() {
  const params = useParams();
  const leadId = typeof params.leadId === 'string' ? params.leadId : '';
  const [lead, setLead] = useState<LeadRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAgentsAdmin()
      .then((list) => {
        if (active) setAgents(list);
      })
      .catch(() => {
        // Picker degrades to "no agents loaded"; the page still works.
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleAssign(agentId: string) {
    if (!lead || !agentId) return;
    setAssigning(true);
    setActionError(null);
    try {
      const updated = await assignLeadAgent(lead.id, agentId);
      setLead(updated);
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Could not assign the agent.'));
    } finally {
      setAssigning(false);
    }
  }

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    (async () => {
      try {
        const found = await fetchLeadById(leadId);
        if (!cancelled) {
          setLead(found);
          setError(null);
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load lead.';
        if (!cancelled) {
          setLead(null);
          setError(String(msg));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (!leadId) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Invalid lead.</p>;
  }

  if (error && !lead) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!lead) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading lead…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/inquiries"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primarycolor-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Back to inquiries
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Lead'}
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">{lead.id}</p>
      </div>

      <section
        aria-labelledby="lead-pipeline-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        <h2
          id="lead-pipeline-heading"
          className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400"
        >
          Pipeline
        </h2>
        {actionError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {actionError}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-6">
          <div>
            <label
              htmlFor="lead-stage"
              className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Stage
            </label>
            <LeadStageSelect
              key={lead.status}
              lead={lead}
              onChanged={setLead}
              onError={setActionError}
            />
          </div>
          <div>
            <label
              htmlFor="lead-agent"
              className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400"
            >
              Assigned agent
            </label>
            <select
              id="lead-agent"
              value={lead.assigned_agent_id ?? ''}
              disabled={assigning || agents.length === 0}
              onChange={(e) => void handleAssign(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
            >
              <option value="" disabled>
                {agents.length === 0 ? 'No agents loaded' : 'Unassigned — pick an agent'}
              </option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="lead-summary-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        <h2 id="lead-summary-heading" className="sr-only">
          Lead summary
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{lead.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Phone</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{lead.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Source</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{lead.source ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Listing</dt>
            <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
              {lead.listing_id ? (
                <Link
                  href={`/admin/listings/${lead.listing_id}`}
                  className="font-mono text-xs text-primarycolor-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                >
                  {lead.listing_id}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          {lead.latest_summary && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Latest summary
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {lead.latest_summary}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <LeadNotesTagsPanel leadId={leadId} />
    </div>
  );
}
