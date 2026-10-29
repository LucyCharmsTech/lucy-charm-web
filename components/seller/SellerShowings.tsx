'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buyerShowingError,
  listSellerShowings,
  respondToShowingAccess,
  type SellerShowing,
} from '@/services/sellerBuyerShowingService';

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : date.toLocaleString('en-CA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

const statusLabel: Record<SellerShowing['status'], string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduling',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export default function SellerShowings({
  transactionId,
  isStaff = false,
}: {
  transactionId: string;
  isStaff?: boolean;
}) {
  const [items, setItems] = useState<SellerShowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [changeId, setChangeId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const sequence = useRef(0);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const rows = await listSellerShowings(transactionId);
      if (!mounted.current || request !== sequence.current) return;
      setItems(
        rows.filter(
          (row) =>
            (row.source === 'buyer_request' && row.id.startsWith('buyer:')) ||
            (row.source === 'seller_appointment' &&
              row.id.startsWith('appointment:')),
        ),
      );
      setNow(Date.now());
      setError(null);
    } catch (failure) {
      if (!mounted.current || request !== sequence.current) return;
      setItems([]);
      setError(buyerShowingError(failure));
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('seller-showings-changed', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('seller-showings-changed', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh]);

  const upcoming = items
    .filter(
      (row) =>
        !['completed', 'cancelled'].includes(row.status) &&
        Date.parse(row.starts_at) >= now,
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const upcomingIds = new Set(upcoming.map((row) => row.id));
  const past = items
    .filter((row) => !upcomingIds.has(row.id))
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));

  async function respond(row: SellerShowing, action: 'approve' | 'request-change') {
    if (busyId || !row.id.startsWith('buyer:') || !row.proposed_time ||
      row.access_revision == null || row.association_revision == null ||
      row.schedule_revision == null || row.policy_revision == null) return;
    if (action === 'request-change' && !explanation.trim()) {
      setError('Explain the different time you need.');
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      await respondToShowingAccess(transactionId, row.id.slice(6), action, {
        expected_revision: row.access_revision,
        expected_association_revision: row.association_revision,
        expected_policy_revision: row.policy_revision,
        expected_schedule_revision: row.schedule_revision,
        proposed_time: row.proposed_time,
        explanation: action === 'request-change' ? explanation.trim() : null,
        requested_time: action === 'request-change' && requestedTime ? new Date(requestedTime).toISOString() : null,
      });
      setChangeId(null);
      setExplanation('');
      setRequestedTime('');
      await refresh();
      window.dispatchEvent(new Event('seller-showings-changed'));
    } catch (failure) {
      setError(buyerShowingError(failure));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const render = (row: SellerShowing) => (
    <article
      key={row.id}
      data-showing-id={row.id}
      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-50">
            {row.label}
          </h4>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            {formatTime(row.starts_at)}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
          {statusLabel[row.status]}
        </span>
      </div>
      {['requested', 'rescheduled'].includes(row.status) && (
        <p className="mt-2 text-xs text-amber-800">
          {row.time_kind === 'proposed' ? 'Proposed time' : 'Requested time'}; the appointment is not confirmed.
        </p>
      )}
      {row.source === 'buyer_request' && row.access_state && (
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
          Property access: {row.access_state === 'not_required' ? 'Approval not required' :
            row.access_state === 'unset' ? 'Policy awaiting staff configuration' :
            row.access_state === 'approved' ? 'Access confirmed by seller' :
            row.access_state === 'admin_exception' ? 'Administrative access exception' :
            row.access_state === 'change_requested' ? 'Different time requested' :
            row.access_state === 'stale' ? 'Previous response needs renewal' : 'Awaiting seller response'}.
        </p>
      )}
      {!isStaff && row.source === 'buyer_request' && row.can_respond && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busyId !== null} onClick={() => void respond(row, 'approve')}
              className="rounded-lg bg-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">
              Confirm property access for this time
            </button>
            <button type="button" disabled={busyId !== null} onClick={() => setChangeId(changeId === row.id ? null : row.id)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">
              Request a different time
            </button>
          </div>
          {changeId === row.id && <div className="space-y-2 rounded-lg border border-zinc-200 p-3">
            <label className="block text-sm font-medium">Explain the access issue
              <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={1000}
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2" />
            </label>
            <label className="block text-sm font-medium">Suggested alternative time (optional)
              <input type="datetime-local" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)}
                className="mt-1 block rounded-lg border border-zinc-300 p-2" />
            </label>
            <p className="text-xs text-zinc-600">This sends a request to the Agent. It does not change the buyer appointment.</p>
            <button type="button" disabled={busyId !== null || !explanation.trim()} onClick={() => void respond(row, 'request-change')}
              className="rounded-lg border border-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-text disabled:opacity-50">
              Send time request
            </button>
          </div>}
        </div>
      )}
    </article>
  );

  return (
    <section aria-label="Transaction showings" className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Showings and open houses</h3>
        <button
          type="button"
          onClick={() => void refresh()}
          className="min-h-10 text-sm font-semibold text-primarycolor-text underline"
        >
          Refresh showings
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-zinc-600">
          Loading showings...
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No showings have been shared for this transaction yet.
        </p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-zinc-600">
                Upcoming and proposed
              </h4>
              {upcoming.map(render)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-zinc-600">
                Past and completed
              </h4>
              {past.map(render)}
            </div>
          )}
        </>
      )}
    </section>
  );
}
