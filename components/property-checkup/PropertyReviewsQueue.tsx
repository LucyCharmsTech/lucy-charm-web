'use client';

/**
 * Staff queue for Deeper Property Review requests (spec C4: Assign reviewer
 * / Review / Publish / Follow-up). Admin sees every request and can (re)assign
 * an agent; an agent sees only requests assigned to them. Both can record the
 * RECO/relationship compliance check and publish the client-visible response
 * (Clarifications Part 1 §6).
 */

import { useCallback, useEffect, useState } from 'react';

import { track } from '@/lib/analytics';
import { fetchAllAgents } from '@/services/portalService';
import { fetchListingById } from '@/services/listingsService';
import {
  assignReviewRequest,
  clearReviewRequestCompliance,
  draftReviewRequestResponse,
  fetchStaffReviewRequests,
  respondToReviewRequest,
} from '@/services/propertyCheckupService';
import type { AgentProfile, PropertyReviewRequestStaff, PropertyReviewRequestStatus } from '@/types/api';

const STATUS_LABEL: Record<PropertyReviewRequestStatus, string> = {
  requested: 'Requested',
  under_review: 'Under review',
  response_ready: 'Response ready',
};

const STATUS_TONE: Record<PropertyReviewRequestStatus, string> = {
  requested: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  response_ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

type Props = {
  role: 'admin' | 'agent';
};

export default function PropertyReviewsQueue({ role }: Props) {
  const [items, setItems] = useState<PropertyReviewRequestStaff[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [listingTitlesById, setListingTitlesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, agentResult] = await Promise.all([
        fetchStaffReviewRequests(),
        role === 'admin' ? fetchAllAgents(1, 100) : Promise.resolve(null),
      ]);
      setItems(rows);
      if (agentResult) setAgents(agentResult.items);

      const uniqueListingIds = Array.from(new Set(rows.map((row) => row.listing_id)));
      const titlePairs = await Promise.all(
        uniqueListingIds.map(async (listingId) => {
          try {
            const listing = await fetchListingById(listingId);
            return [listingId, listing.title] as const;
          } catch {
            return [listingId, `Listing ${listingId.slice(0, 8)}...`] as const;
          }
        }),
      );
      setListingTitlesById(Object.fromEntries(titlePairs));
    } catch {
      setError('Could not load Property Review requests.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(id: string, updated: PropertyReviewRequestStaff) {
    setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
  }

  if (loading) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No Deeper Property Review requests right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <RequestRow
          key={item.id}
          item={item}
          role={role}
          agents={agents}
          listingTitle={listingTitlesById[item.listing_id] ?? `Listing ${item.listing_id.slice(0, 8)}...`}
          onUpdated={(updated) => patch(item.id, updated)}
        />
      ))}
    </div>
  );
}

function RequestRow({
  item,
  role,
  agents,
  listingTitle,
  onUpdated,
}: {
  item: PropertyReviewRequestStaff;
  role: 'admin' | 'agent';
  agents: AgentProfile[];
  listingTitle: string;
  onUpdated: (updated: PropertyReviewRequestStaff) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [responding, setResponding] = useState(false);
  const [responseText, setResponseText] = useState(item.response_summary ?? '');
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAssign(agentId: string) {
    if (!agentId || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await assignReviewRequest(item.id, { assigned_agent_id: agentId });
      onUpdated(updated);
      if (updated.status !== item.status) {
        track('property_review_status_changed', {
          request_id: item.id,
          listing_id: item.listing_id,
          status: updated.status,
        });
      }
    } catch {
      setActionError('Could not assign an agent.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClearCompliance() {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await clearReviewRequestCompliance(item.id);
      onUpdated(updated);
    } catch {
      setActionError('Could not record compliance.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (busy || !responseText.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await draftReviewRequestResponse(item.id, { response_summary: responseText.trim() });
      onUpdated(updated);
      setResponding(false);
    } catch {
      setActionError('Could not save the draft.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !responseText.trim() || !item.compliance_cleared_at) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await respondToReviewRequest(item.id, { response_summary: responseText.trim() });
      onUpdated(updated);
      setResponding(false);
      track('property_review_status_changed', {
        request_id: item.id,
        listing_id: item.listing_id,
        status: updated.status,
      });
    } catch {
      // Most commonly the backend's own compliance gate refusing (403) even
      // if this button were somehow enabled — the backend is the real gate,
      // not this disabled attribute.
      setActionError('Could not publish the response — compliance must be cleared first.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-zinc-200/80 p-4 dark:border-zinc-700/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={`/listings/${item.listing_id}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          {listingTitle}
        </a>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[item.status]}`}
        >
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Requested {new Date(item.created_at).toLocaleString()}
      </p>

      {item.questions && (
        <p className="mt-2 rounded-lg bg-zinc-50 p-2.5 text-sm text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
          {item.questions}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {role === 'admin' && (
          <select
            defaultValue={item.assigned_agent_id ?? ''}
            onChange={(e) => handleAssign(e.target.value)}
            disabled={busy}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="" disabled>
              Assign an agent…
            </option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        )}

        {item.compliance_cleared_at ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            Compliance cleared {new Date(item.compliance_cleared_at).toLocaleDateString()}
          </span>
        ) : (
          <button
            type="button"
            onClick={handleClearCompliance}
            disabled={busy}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Mark compliance cleared
          </button>
        )}

        {!responding && (
          <button
            type="button"
            onClick={() => setResponding(true)}
            disabled={busy}
            className="rounded-lg bg-primarycolor px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {item.response_summary ? 'Edit response' : 'Write response'}
          </button>
        )}
      </div>

      {actionError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{actionError}</p>}

      {item.response_summary && !responding && (
        <div className="mt-3 rounded-lg p-2.5 text-sm">
          {item.status === 'response_ready' ? (
            <p className="bg-emerald-50 rounded-lg p-2.5 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              {item.response_summary}
            </p>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Draft — not visible to the buyer yet
              </p>
              <p className="mt-1 bg-zinc-50 rounded-lg p-2.5 text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
                {item.response_summary}
              </p>
            </>
          )}
        </div>
      )}

      {responding && (
        <div className="mt-3 space-y-2">
          <textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Client-visible summary only — internal research stays out of this field."
            className="w-full rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {!item.compliance_cleared_at && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Compliance must be cleared before this can be published — you can still save it as a
              draft.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResponding(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={busy || !responseText.trim()}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {busy ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={busy || !responseText.trim() || !item.compliance_cleared_at}
              title={
                item.compliance_cleared_at
                  ? undefined
                  : 'Clear compliance first — the backend refuses to publish without it'
              }
              className="rounded-lg bg-primarycolor px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy ? 'Publishing…' : 'Publish response'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
