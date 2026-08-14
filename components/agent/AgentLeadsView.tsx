'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import LeadStageSelect from '@/components/common/LeadStageSelect';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  fetchLeadsByAgent,
  fetchLeadTags,
  addLeadTag,
  removeLeadTag,
} from '@/services/leadService';
import { fetchMyAgentProfile } from '@/services/portalService';
import type { LeadRead, LeadTagRead } from '@/types/api';

const TEMPERATURE_STYLES: Record<string, string> = {
  hot: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  warm: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  cold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

function temperatureTone(temperature: string): string {
  return (
    TEMPERATURE_STYLES[temperature] ??
    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  );
}

/** Tag chips with inline add/remove. Tags are universal (admin sees the same). */
function LeadTagsCell({ leadId, onError }: { leadId: string; onError: (m: string) => void }) {
  const [tags, setTags] = useState<LeadTagRead[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLeadTags(leadId)
      .then((rows) => {
        if (active) setTags(rows.filter((t) => !t.deleted_at));
      })
      .catch(() => {
        // Tag load failure is non-fatal for the row; adding still surfaces errors.
      });
    return () => {
      active = false;
    };
  }, [leadId]);

  async function handleAdd() {
    const label = draft.trim();
    if (!label || busy) return;
    setBusy(true);
    try {
      const created = await addLeadTag(leadId, label);
      setTags((prev) => [...prev, created]);
      setDraft('');
    } catch (err: unknown) {
      onError(getApiErrorMessage(err, 'Could not add the tag.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(tagId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await removeLeadTag(leadId, tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err: unknown) {
      onError(getApiErrorMessage(err, 'Could not remove the tag.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xs flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {tag.tag_label}
          <button
            type="button"
            onClick={() => void handleRemove(tag.id)}
            disabled={busy}
            aria-label={`Remove tag ${tag.tag_label}`}
            className="rounded-full text-zinc-400 transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:text-red-400"
          >
            <XIcon className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAdd();
            }
          }}
          placeholder="Add tag"
          aria-label="New tag"
          className="w-20 rounded-lg border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={busy || !draft.trim()}
          aria-label="Add tag"
          className="rounded-full border border-zinc-200 p-0.5 text-zinc-500 transition hover:border-primarycolor/40 hover:text-primarycolor disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:text-zinc-400"
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

export default function AgentLeadsView() {
  const [leads, setLeads] = useState<LeadRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const me = await fetchMyAgentProfile();
        const rows = await fetchLeadsByAgent(me.id);
        if (!active) return;
        setLeads(rows);
        setError(null);
      } catch {
        if (!active) return;
        setError('Could not load your leads.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading your leads…</p>;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          My leads
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Leads assigned to you. Update the stage as you work them; tags are shared with admin.
        </p>
      </div>

      {actionError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {actionError}
        </p>
      )}

      {leads.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No leads assigned to you yet. New inquiries on your listings will appear here
          automatically.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Contact
                </th>
                <th scope="col" className="px-4 py-3">
                  Stage
                </th>
                <th scope="col" className="px-4 py-3">
                  Temperature
                </th>
                <th scope="col" className="px-4 py-3">
                  Score
                </th>
                <th scope="col" className="px-4 py-3">
                  Source
                </th>
                <th scope="col" className="px-4 py-3">
                  Listing
                </th>
                <th scope="col" className="px-4 py-3">
                  Summary
                </th>
                <th scope="col" className="px-4 py-3">
                  Tags
                </th>
                <th scope="col" className="px-4 py-3">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {leads.map((lead) => (
                <tr key={lead.id} className="bg-white dark:bg-zinc-950/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}
                    </p>
                    {lead.email && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{lead.email}</p>
                    )}
                    {lead.phone && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{lead.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStageSelect lead={lead} onError={setActionError} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${temperatureTone(lead.lead_temperature)}`}
                    >
                      {lead.lead_temperature}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {lead.lead_score}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.source ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {lead.listing_id ? (
                      <Link
                        href={`/listings/${lead.listing_id}`}
                        className="text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                      >
                        {lead.listing_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {lead.latest_summary ? (
                      <p
                        className="max-w-xs text-xs leading-relaxed text-zinc-600 line-clamp-3 dark:text-zinc-400"
                        title={lead.latest_summary}
                      >
                        {lead.latest_summary}
                      </p>
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LeadTagsCell leadId={lead.id} onError={setActionError} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(lead.created_at).toLocaleString()}
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
