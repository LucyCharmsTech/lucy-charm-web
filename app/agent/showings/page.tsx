'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  RefreshCcwIcon,
} from 'lucide-react';
import ShowingIdentityReviewDialog from '@/components/agent/ShowingIdentityReviewDialog';
import ShowingRescheduleDialog from '@/components/agent/ShowingRescheduleDialog';
import { useLiveShowingRequests } from '@/lib/useLiveShowingRequests';
import { showingAnchorId, useShowingDeepLink } from '@/lib/useShowingDeepLink';
import { fetchMyAgentProfile } from '@/services/portalService';
import { fetchShowingRequestsByAgent, updateShowingRequest } from '@/services/showingService';
import type {
  AgentProfile,
  ShowingRequest,
  ShowingRequestStatus,
} from '@/types/api';

function isActiveBookedStatus(status: ShowingRequestStatus): boolean {
  return status === 'confirmed' || status === 'rescheduled';
}

const STATUS_STYLES: Record<ShowingRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  rescheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  cancelled: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  completed: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
};

const STATUS_ICON: Record<ShowingRequestStatus, React.ReactNode> = {
  pending: <ClockIcon className="size-3.5" aria-hidden="true" />,
  confirmed: <CheckCircleIcon className="size-3.5" aria-hidden="true" />,
  rescheduled: <RefreshCcwIcon className="size-3.5" aria-hidden="true" />,
  cancelled: <XCircleIcon className="size-3.5" aria-hidden="true" />,
  completed: <CheckCircleIcon className="size-3.5" aria-hidden="true" />,
};

function StatusBadge({ status }: { status: ShowingRequestStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}
    >
      {STATUS_ICON[status]}
      {status}
    </span>
  );
}

function AgentShowingsPageContent() {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [requests, setRequests] = useState<ShowingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [rescheduleRequest, setRescheduleRequest] = useState<ShowingRequest | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const [reviewRequest, setReviewRequest] = useState<ShowingRequest | null>(null);
  const highlightedShowingId = useShowingDeepLink(!loading);

  const load = useCallback(async () => {
    try {
      const a = await fetchMyAgentProfile();
      setAgent(a);
      const items = await fetchShowingRequestsByAgent(a.id);
      items.sort(
        (x, y) => new Date(x.preferred_date).getTime() - new Date(y.preferred_date).getTime(),
      );
      setRequests(items);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not load showing requests.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Buyer actions (new request, ID upload, feedback, withdrawal) land here
  // live via the auto-granted user channel. `load()` never flips `loading`
  // after the first paint, so realtime refetches are flicker-free.
  useLiveShowingRequests({
    patch: (id, patch) =>
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    remove: (id) => setRequests((prev) => prev.filter((r) => r.id !== id)),
    refetch: () => void load(),
  });

  async function changeStatus(id: string, status: ShowingRequestStatus) {
    await patchShowingRequest(id, {
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : undefined,
    });
  }

  function openReschedule(request: ShowingRequest) {
    const date = new Date(request.scheduled_at ?? request.preferred_date);
    setRescheduleValue(new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    setRescheduleRequest(request);
  }

  async function submitReschedule() {
    if (!rescheduleRequest || !rescheduleValue) return;
    await patchShowingRequest(rescheduleRequest.id, {
      scheduled_at: new Date(rescheduleValue).toISOString(),
    });
    setRescheduleRequest(null);
  }

  async function patchShowingRequest(
    id: string,
    payload: Parameters<typeof updateShowingRequest>[1],
  ) {
    setUpdating(id);
    try {
      const updated = await updateShowingRequest(id, payload);
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      /* surface error inline if needed */
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

  const pending = requests.filter((r) => r.status === 'pending');
  const rest = requests.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Showing requests
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tour requests sent to you for your listings. Confirm or reschedule within your SLA.
        </p>
      </div>

      {requests.length === 0 && (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          No showing requests yet.
        </p>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="mb-3 text-base font-bold text-amber-700 dark:text-amber-400">
            Needs action ({pending.length})
          </h2>
          <ShowingTable
            rows={pending}
            updating={updating}
            onChangeStatus={changeStatus}
            onReschedule={openReschedule}
            onReviewDocuments={setReviewRequest}
            agentId={agent?.id}
            highlightId={highlightedShowingId}
          />
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="all-heading">
          <h2 id="all-heading" className="mb-3 text-base font-bold text-zinc-700 dark:text-zinc-300">
            All other requests
          </h2>
          <ShowingTable
            rows={rest}
            updating={updating}
            onChangeStatus={changeStatus}
            onReschedule={openReschedule}
            onReviewDocuments={setReviewRequest}
            agentId={agent?.id}
            highlightId={highlightedShowingId}
          />
        </section>
      )}
      <ShowingRescheduleDialog
        open={Boolean(rescheduleRequest)}
        value={rescheduleValue}
        busy={Boolean(rescheduleRequest && updating === rescheduleRequest.id)}
        onChange={setRescheduleValue}
        onCancel={() => setRescheduleRequest(null)}
        onSave={() => void submitReschedule()}
      />
      <ShowingIdentityReviewDialog
        open={Boolean(reviewRequest)}
        request={reviewRequest}
        onClose={() => setReviewRequest(null)}
        onReviewed={() => void load()}
      />
    </div>
  );
}

function ShowingTable({
  rows,
  updating,
  onChangeStatus,
  onReschedule,
  onReviewDocuments,
  highlightId,
}: {
  rows: ShowingRequest[];
  updating: string | null;
  onChangeStatus: (id: string, status: ShowingRequestStatus) => void;
  onReschedule: (request: ShowingRequest) => void;
  onReviewDocuments: (request: ShowingRequest) => void;
  agentId?: string;
  /** Row a notification deep link points at, tinted so it is findable in a long queue. */
  highlightId?: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-3">Buyer</th>
            <th scope="col" className="px-4 py-3">Type</th>
            <th scope="col" className="px-4 py-3">Preferred date</th>
            <th scope="col" className="px-4 py-3">Duration</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">ID verification</th>
            <th scope="col" className="px-4 py-3">Pre-approved</th>
            <th scope="col" className="px-4 py-3">Feedback</th>
            <th scope="col" className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => (
            <tr
              key={r.id}
              id={showingAnchorId(r.id)}
              className={
                r.id === highlightId
                  ? 'bg-primarycolor/10 dark:bg-primarycolor/20'
                  : 'bg-white dark:bg-zinc-950/40'
              }
            >
              <td className="px-4 py-3">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {r.first_name} {r.last_name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.email}</p>
                {r.phone && <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.phone}</p>}
              </td>
              <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                {r.showing_type.replace('_', ' ')}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                  {new Date(r.scheduled_at ?? r.preferred_date).toLocaleString()}
                </span>
                {r.rescheduled_at && (
                  <span className="mt-0.5 block text-xs text-zinc-400">
                    Originally requested: {new Date(r.preferred_date).toLocaleString()}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                {r.duration_minutes} min
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3">
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
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold ${r.is_pre_approved ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                  {r.is_pre_approved ? 'Yes' : 'No'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                {r.feedback_rating ? `${r.feedback_rating}/5` : '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {r.status === 'pending' && (
                    <>
                      <ActionButton
                        label="Confirm"
                        busy={updating === r.id}
                        onClick={() => onChangeStatus(r.id, 'confirmed')}
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                      />
                      <ActionButton
                        label="Reschedule"
                        busy={updating === r.id}
                        onClick={() => onReschedule(r)}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      />
                      <ActionButton
                        label="Cancel"
                        busy={updating === r.id}
                        onClick={() => onChangeStatus(r.id, 'cancelled')}
                        className="bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    </>
                  )}
                  {isActiveBookedStatus(r.status) && (
                    <>
                      <ActionButton
                        label="Reschedule"
                        busy={updating === r.id}
                        onClick={() => onReschedule(r)}
                        className="bg-blue-600 text-white hover:bg-blue-700"
                      />
                      <ActionButton
                        label="Mark complete"
                        busy={updating === r.id}
                        onClick={() => onChangeStatus(r.id, 'completed')}
                        className="bg-violet-600 text-white hover:bg-violet-700"
                      />
                      <ActionButton
                        label="Cancel"
                        busy={updating === r.id}
                        onClick={() => onChangeStatus(r.id, 'cancelled')}
                        className="bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100"
                      />
                    </>
                  )}
                  {r.id_verification_status === 'pending' && r.identity_document_uploaded && (
                    <ActionButton
                      label="Review ID"
                      busy={updating === r.id}
                      onClick={() => onReviewDocuments(r)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    />
                  )}
                  {r.id_verification_status === 'pending' && !r.identity_document_uploaded && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Waiting for buyer ID upload
                    </span>
                  )}
                </div>
                {r.message && (
                  <p className="mt-1.5 max-w-[200px] truncate text-xs text-zinc-500 dark:text-zinc-400" title={r.message}>
                    &ldquo;{r.message}&rdquo;
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionButton({
  label,
  busy,
  onClick,
  className,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor ${className}`}
    >
      {label}
    </button>
  );
}

export default function AgentShowingsPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}
    >
      <AgentShowingsPageContent />
    </Suspense>
  );
}
