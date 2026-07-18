'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  RefreshCcwIcon,
} from 'lucide-react';
import { fetchAllShowingRequestsAdmin, updateShowingRequest } from '@/services/showingService';
import type { ApiPaginated, ShowingRequest, ShowingRequestStatus } from '@/types/api';

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

export default function AdminShowingsPage() {
  const [data, setData] = useState<ApiPaginated<ShowingRequest> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchAllShowingRequestsAdmin(1, 100);
      setData(result);
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

  async function changeVerification(id: string) {
    setUpdating(id);
    try {
      const updated = await updateShowingRequest(id, {
        id_verification_status: 'verified',
        id_verification_notes: `Verified by admin on ${new Date().toISOString()}`,
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
    <div className="space-y-6">
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
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3">Buyer</th>
                <th scope="col" className="px-4 py-3">Listing</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Preferred date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">ID verification</th>
                <th scope="col" className="px-4 py-3">Pre-approved</th>
                <th scope="col" className="px-4 py-3">Feedback</th>
                <th scope="col" className="px-4 py-3">Submitted</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {r.listing_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">
                    {r.showing_type.replace('_', ' ')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="size-3.5 shrink-0 text-zinc-400" aria-hidden="true" />
                      {new Date(r.preferred_date).toLocaleString()}
                    </span>
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
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={updating === r.id}
                            onClick={() => changeStatus(r.id, 'confirmed')}
                            className="inline-flex h-7 items-center rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={updating === r.id}
                            onClick={() => changeStatus(r.id, 'cancelled')}
                            className="inline-flex h-7 items-center rounded-full bg-zinc-200 px-3 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:bg-zinc-700 dark:text-zinc-100"
                          >
                            Cancel
                          </button>
                          {r.id_verification_status === 'pending' && (
                            <button
                              type="button"
                              disabled={updating === r.id}
                              onClick={() => changeVerification(r.id)}
                              className="inline-flex h-7 items-center rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                            >
                              Verify ID
                            </button>
                          )}
                        </>
                      )}
                      {r.message && (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-zinc-400" title={r.message}>
                          &ldquo;{r.message}&rdquo;
                        </p>
                      )}
                    </div>
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
