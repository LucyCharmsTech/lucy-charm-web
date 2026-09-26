'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  RefreshCcwIcon,
} from 'lucide-react';
import ShowingDocumentsDialog from '@/components/documents/ShowingDocumentsDialog';
import ClientFlaggedQuestionsDialog from '@/components/showings/ClientFlaggedQuestionsDialog';
import ShowingDateTime from '@/components/showings/ShowingDateTime';
import { fetchAllShowingRequestsAdmin, updateShowingRequest } from '@/services/showingService';
import { fetchAllAgents } from '@/services/portalService';
import type { AgentProfile, ApiPaginated, ShowingRequest, ShowingRequestStatus } from '@/types/api';
import { showingStatusLabel } from '@/lib/showingPresentation';

const STATUS_STYLES: Record<ShowingRequestStatus, string> = {
  requested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  being_arranged: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  awaiting_confirmation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  reschedule_needed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  cancelled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  completed: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
};

const STATUS_ICON: Record<ShowingRequestStatus, React.ReactNode> = {
  requested: <ClockIcon className="size-3.5" aria-hidden="true" />,
  being_arranged: <RefreshCcwIcon className="size-3.5" aria-hidden="true" />,
  awaiting_confirmation: <ClockIcon className="size-3.5" aria-hidden="true" />,
  confirmed: <CheckCircleIcon className="size-3.5" aria-hidden="true" />,
  reschedule_needed: <RefreshCcwIcon className="size-3.5" aria-hidden="true" />,
  cancelled: <XCircleIcon className="size-3.5" aria-hidden="true" />,
  completed: <CheckCircleIcon className="size-3.5" aria-hidden="true" />,
};

function StatusBadge({ status }: { status: ShowingRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}
    >
      {STATUS_ICON[status]}
      {showingStatusLabel(status)}
    </span>
  );
}

export default function AdminShowingsPage() {
  const [data, setData] = useState<ApiPaginated<ShowingRequest> | null>(null);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = useState<ShowingRequest | null>(null);
  const [flaggedRequest, setFlaggedRequest] = useState<ShowingRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const [result, agentResult] = await Promise.all([
        fetchAllShowingRequestsAdmin(1, 100),
        fetchAllAgents(1, 100),
      ]);
      setData(result);
      setAgents(agentResult.items);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not load showing requests.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function changeStatus(id: string, status: ShowingRequestStatus) {
    setUpdating(id);
    try {
      const updated = await updateShowingRequest(id, {
        status,
      });
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((r) => (r.id === id ? updated : r)) }
          : prev,
      );
    } catch {
      /* noop */
    } finally {
      setUpdating(null);
    }
  }

  async function assignAgent(id: string, agentId: string) {
    setUpdating(id);
    try {
      const updated = await updateShowingRequest(id, {
        agent_id: agentId || null,
      });
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((r) => (r.id === id ? updated : r)) }
          : prev,
      );
    } catch {
      /* noop */
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>;
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
        {error}
      </div>
    );
  }

  const rows = data?.items ?? [];

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            All showing requests
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Brokerage-wide view of all buyer tour requests.
          </p>
        </div>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {data?.total ?? 0} total
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No showing requests yet.
        </p>
      ) : (
        <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="block w-full text-left text-sm lg:table lg:min-w-[1640px]">
            <thead className="hidden border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 lg:table-header-group dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="min-w-[220px] px-4 py-3">Buyer</th>
                <th scope="col" className="min-w-[105px] px-4 py-3">Listing</th>
                <th scope="col" className="min-w-[105px] px-4 py-3">Type</th>
                <th scope="col" className="min-w-[210px] px-4 py-3">Appointment / requested time</th>
                <th scope="col" className="min-w-[200px] px-4 py-3">Assigned agent</th>
                <th scope="col" className="min-w-[145px] px-4 py-3">Status</th>
                <th scope="col" className="min-w-[155px] px-4 py-3">ID verification</th>
                <th scope="col" className="min-w-[125px] px-4 py-3">Pre-approved</th>
                <th scope="col" className="min-w-[90px] px-4 py-3">Feedback</th>
                <th scope="col" className="min-w-[110px] px-4 py-3">Submitted</th>
                <th scope="col" className="min-w-[245px] px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="block divide-y divide-zinc-100 lg:table-row-group dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id} className="mb-3 block rounded-xl border border-zinc-200 bg-white lg:mb-0 lg:table-row lg:rounded-none lg:border-0 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <td data-label="Buyer" className="block px-4 py-3 lg:table-cell">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {r.first_name} {r.last_name}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={r.email}>{r.email}</p>
                    {r.phone && <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.phone}</p>}
                  </td>
                  <td data-label="Listing" className="block px-4 py-3 font-mono text-xs before:mr-2 before:font-sans before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none text-zinc-500 dark:text-zinc-400">
                    {r.listing_id.slice(0, 8)}…
                  </td>
                  <td data-label="Type" className="block px-4 py-3 capitalize before:mr-2 before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none text-zinc-700 dark:text-zinc-300">
                    {r.showing_type.replace('_', ' ')}
                  </td>
                <td data-label="Appointment / requested time" className="block px-4 py-3 before:mb-1 before:block before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none">
                    <ShowingDateTime value={r.scheduled_at ?? r.proposed_scheduled_at ?? r.preferred_date} />
                </td>
                <td data-label="Assigned agent" className="block px-4 py-3 before:mb-1 before:block before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none">
                  {['requested', 'being_arranged', 'awaiting_confirmation', 'reschedule_needed'].includes(r.status) ? (
                    <select
                      aria-label="Assign agent"
                      value={r.agent_id ?? ''}
                      disabled={updating === r.id}
                      onChange={(event) => void assignAgent(r.id, event.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="">Admin queue</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      {agents.find((agent) => agent.id === r.agent_id)?.name ?? '—'}
                    </span>
                  )}
                </td>
                <td data-label="Status" className="block px-4 py-3 before:mr-2 before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none">
                    <StatusBadge status={r.status} />
                  </td>
                  <td data-label="ID verification" className="block px-4 py-3 before:mr-2 before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        r.id_verification_status === 'verified'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : r.id_verification_status === 'pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {r.id_verification_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td data-label="Pre-approved" className="block px-4 py-3 before:mr-2 before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none">
                    <span className={`text-xs font-semibold ${r.is_pre_approved ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {r.is_pre_approved ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td data-label="Feedback" className="block px-4 py-3 text-xs before:mr-2 before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none text-zinc-600 dark:text-zinc-300">
                    {r.feedback_rating ? `${r.feedback_rating}/5` : '—'}
                  </td>
                  <td data-label="Submitted" className="block px-4 py-3 text-xs before:mr-2 before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none text-zinc-500 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td data-label="Actions" className="block px-4 py-3 before:mb-2 before:block before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-zinc-500 before:content-[attr(data-label)] lg:table-cell lg:before:content-none">
                    <div className="flex flex-col items-stretch gap-1.5">
                      {['requested', 'being_arranged', 'awaiting_confirmation', 'reschedule_needed'].includes(r.status) && (
                        <>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {r.agent_id ? 'Awaiting agent acceptance' : 'Select an agent'}
                          </span>
                          <button
                            type="button"
                            disabled={updating === r.id}
                            onClick={() => changeStatus(r.id, 'cancelled')}
                            className="inline-flex h-7 w-full items-center justify-center rounded-full bg-zinc-200 px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:bg-zinc-700 dark:text-zinc-100"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={updating === r.id}
                        onClick={() => setReviewRequest(r)}
                        className={`inline-flex h-7 w-full items-center justify-center rounded-full px-3 text-xs font-semibold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${
                          r.id_verification_status === 'pending'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100'
                        }`}
                      >
                        {r.id_verification_status === 'pending' ? 'Review documents' : 'Documents'}
                      </button>
                      {r.message && (
                        <p className="mt-1 break-words text-xs text-zinc-500 dark:text-zinc-400">
                          &ldquo;{r.message}&rdquo;
                        </p>
                      )}
                      {r.checkup_questions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFlaggedRequest(r)}
                          className="mt-1 inline-flex w-fit items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 hover:underline dark:text-amber-400"
                        >
                          Client flagged {r.checkup_questions.length === 1 ? 'this' : `${r.checkup_questions.length} things`}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ShowingDocumentsDialog
        open={Boolean(reviewRequest)}
        request={reviewRequest}
        onClose={() => setReviewRequest(null)}
        onChanged={() => void load()}
      />
      <ClientFlaggedQuestionsDialog
        open={Boolean(flaggedRequest)}
        buyerName={flaggedRequest ? `${flaggedRequest.first_name} ${flaggedRequest.last_name}` : ''}
        questions={flaggedRequest?.checkup_questions ?? []}
        onClose={() => setFlaggedRequest(null)}
      />
    </div>
  );
}
