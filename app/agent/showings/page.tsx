'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  RefreshCcwIcon,
} from 'lucide-react';
import { fetchMyAgentProfile } from '@/services/portalService';
import { fetchShowingRequestsByAgent, updateShowingRequest } from '@/services/showingService';
import type { AgentProfile, ShowingRequest, ShowingRequestStatus } from '@/types/api';

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

export default function AgentShowingsPage() {
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [requests, setRequests] = useState<ShowingRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

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

  async function changeStatus(id: string, status: ShowingRequestStatus) {
    setUpdating(id);
    try {
      const updated = await updateShowingRequest(id, {
        status,
        confirmed_at: status === 'confirmed' ? new Date().toISOString() : undefined,
      });
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
          <ShowingTable rows={pending} updating={updating} onChangeStatus={changeStatus} agentId={agent?.id} />
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="all-heading">
          <h2 id="all-heading" className="mb-3 text-base font-bold text-zinc-700 dark:text-zinc-300">
            All other requests
          </h2>
          <ShowingTable rows={rest} updating={updating} onChangeStatus={changeStatus} agentId={agent?.id} />
        </section>
      )}
    </div>
  );
}

function ShowingTable({
  rows,
  updating,
  onChangeStatus,
}: {
  rows: ShowingRequest[];
  updating: string | null;
  onChangeStatus: (id: string, status: ShowingRequestStatus) => void;
  agentId?: string;
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
            <th scope="col" className="px-4 py-3">Pre-approved</th>
            <th scope="col" className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((r) => (
            <tr key={r.id} className="bg-white dark:bg-zinc-950/40">
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
                  {new Date(r.preferred_date).toLocaleString()}
                </span>
                {r.alternate_date && (
                  <span className="mt-0.5 block text-xs text-zinc-400">
                    Alt: {new Date(r.alternate_date).toLocaleString()}
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
                <span className={`text-xs font-semibold ${r.is_pre_approved ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                  {r.is_pre_approved ? 'Yes' : 'No'}
                </span>
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
                        onClick={() => onChangeStatus(r.id, 'rescheduled')}
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
                  {r.status === 'confirmed' && (
                    <ActionButton
                      label="Mark complete"
                      busy={updating === r.id}
                      onClick={() => onChangeStatus(r.id, 'completed')}
                      className="bg-violet-600 text-white hover:bg-violet-700"
                    />
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
