'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listSellerAppointments,
  type SellerAppointment,
} from '@/services/sellerAppointmentService';
import { fetchAllShowingRequestsAdmin } from '@/services/showingService';
import { fetchShowingRequestsByAgent } from '@/services/showingService';
import { fetchMyAgentProfile } from '@/services/portalService';
import type { ApiPaginated, ShowingRequest } from '@/types/api';
import {
  associateBuyerShowing,
  buyerShowingError,
  decideBuyerShowing,
  listBuyerShowingAssociations,
  listBuyerShowingHistory,
  type BuyerShowingAssociation,
  type BuyerShowingAudit,
  adminShowingAccessException,
  getStaffShowingAccess,
  listShowingAccessHistory,
  type ShowingAccessResponse,
} from '@/services/sellerBuyerShowingService';

export default function StaffBuyerShowings({
  transactionId,
  role,
}: {
  transactionId: string;
  role: string | undefined;
}) {
  const admin = role === 'superadmin';
  const allowed = admin || role === 'agent';
  const [catalog, setCatalog] = useState<ApiPaginated<ShowingRequest> | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [associations, setAssociations] = useState<BuyerShowingAssociation[]>(
    [],
  );
  const [appointments, setAppointments] = useState<SellerAppointment[]>([]);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [sameVisit, setSameVisit] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');
  const [history, setHistory] = useState<BuyerShowingAudit[] | null>(null);
  const [access, setAccess] = useState<ShowingAccessResponse | null>(null);
  const [accessHistory, setAccessHistory] = useState<BuyerShowingAudit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const sequence = useRef(0);
  const selectedRef = useRef('');

  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const [requests, links, visits] = await Promise.all([
        admin
          ? fetchAllShowingRequestsAdmin(page, 25)
          : fetchMyAgentProfile().then(async (profile) => {
              const items = await fetchShowingRequestsByAgent(profile.id);
              return { items, page: 1, page_size: items.length || 1, total: items.length };
            }),
        listBuyerShowingAssociations(transactionId),
        listSellerAppointments({ transactionId }, true),
      ]);
      if (!mounted.current || request !== sequence.current) return;
      setCatalog(requests);
      const visibleRequestIds = new Set(requests.items.map((item) => item.id));
      setAssociations(links.filter((link) =>
        link.transaction_id === transactionId &&
        (admin || visibleRequestIds.has(link.showing_request_id)),
      ));
      const selectedId = selectedRef.current;
      const selectedLink = links.find((link) =>
        link.transaction_id === transactionId &&
        link.showing_request_id === selectedId &&
        link.seller_visible && (admin || visibleRequestIds.has(selectedId)),
      );
      if (selectedId) {
        if (selectedLink) {
          void getStaffShowingAccess(transactionId, selectedId).then((value) => {
            if (mounted.current && request === sequence.current && selectedRef.current === selectedId) setAccess(value);
          }).catch(() => {
            if (mounted.current && request === sequence.current && selectedRef.current === selectedId) setAccess(null);
          });
        } else {
          setAccess(null);
        }
      }
      setAppointments(
        visits.filter(
          (visit) =>
            visit.transaction_id === transactionId && visit.kind === 'showing',
        ),
      );
      setError(null);
    } catch (failure) {
      if (!mounted.current || request !== sequence.current) return;
      setCatalog(null);
      setAssociations([]);
      setAppointments([]);
      setError(buyerShowingError(failure));
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [admin, page, transactionId]);

  useEffect(() => {
    if (!allowed) return;
    mounted.current = true;
    const timer = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [allowed, refresh]);

  const current = associations.find(
    (item) => item.showing_request_id === selected,
  );
  const candidate = catalog?.items.find((item) => item.id === selected);
  const exactVisits = appointments.filter(
    (item) => item.status !== 'cancelled',
  );

  useEffect(() => {
    if (!selected || !current?.seller_visible) {
      const timer = window.setTimeout(() => setAccess(null), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    void getStaffShowingAccess(transactionId, selected).then((value) => {
      if (active) setAccess(value);
    }).catch(() => { if (active) setAccess(null); });
    return () => { active = false; };
  }, [transactionId, selected, current?.seller_visible, current?.revision]);

  async function overrideAccess() {
    if (!admin || !access || !current || !selected || !reason.trim() || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try {
      await adminShowingAccessException(transactionId, selected, {
        expected_revision: access.response_revision,
        expected_association_revision: access.association_revision,
        expected_policy_revision: access.policy_revision,
        expected_schedule_revision: access.schedule_revision,
        proposed_time: access.proposed_time,
        explanation: reason.trim(),
      });
      setNotice('Administrative access exception recorded. Agent still makes the final booking decision.');
      setReason('');
      setAccess(await getStaffShowingAccess(transactionId, selected));
      window.dispatchEvent(new Event('seller-showings-changed'));
    } catch (failure) { setError(buyerShowingError(failure)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function perform(
    action: 'associate' | 'share' | 'withdraw' | 'unlink',
  ) {
    if (!allowed || (action === 'unlink' && !admin) || busyRef.current || !selected || !reason.trim()) {
      setError('Select an exact showing request and enter an audit reason.');
      return;
    }
    if (
      action === 'associate' &&
      (!candidate || (sameVisit && !appointmentId))
    ) {
      setError(
        'Select a request on this catalog page and, for a verified same visit, its exact S5 appointment.',
      );
      return;
    }
    if (action !== 'associate' && !current) {
      setError('Refresh the current association before acting.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (action === 'associate') {
        await associateBuyerShowing(transactionId, selected, {
          expected_revision: 0,
          reason: reason.trim(),
          same_as_appointment_id: sameVisit ? appointmentId : null,
        });
      } else {
        await decideBuyerShowing(transactionId, selected, action, {
          expected_revision: current!.revision,
          reason: reason.trim(),
        });
      }
      if (!mounted.current) return;
      setReason('');
      setHistory(null);
      setNotice(
        action === 'associate'
          ? 'Association saved privately. Share it separately after review.'
          : action === 'share'
            ? 'Showing shared with the seller. Feedback still requires separate approval.'
            : action === 'withdraw'
              ? 'Seller sharing withdrawn.'
              : 'Association unlinked.',
      );
      await refresh();
      window.dispatchEvent(new Event('seller-showings-changed'));
    } catch (failure) {
      if (!mounted.current) return;
      await refresh();
      setError(buyerShowingError(failure));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function readHistory() {
    if (!selected) return;
    const requestId = selected;
    try {
      const events = await listBuyerShowingHistory(transactionId, requestId);
      if (!mounted.current || selectedRef.current !== requestId) return;
      setHistory(events);
      setError(null);
    } catch (failure) {
      if (!mounted.current || selectedRef.current !== requestId) return;
      setHistory(null);
      setError(buyerShowingError(failure));
    }
  }

  if (!allowed) return null;
  return (
    <section
      aria-label="Buyer showing association management"
      className="mt-5 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Buyer showing associations</h3>
          <p className="text-sm text-zinc-600">
            {admin
              ? 'Super Admin: select an exact request from the authorized catalog.'
              : 'Agent: select an exact request from your own buyer showing queue.'}{' '}
            Association and seller sharing are separate decisions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="min-h-10 text-sm font-semibold text-primarycolor-text underline"
        >
          Refresh associations
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-primarycolor/5 p-3 text-sm">
          {notice}
        </p>
      )}
      {loading ? (
        <p className="text-sm">Loading authorized showing requests...</p>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Buyer showing request
            <select
              value={selected}
              disabled={busy}
              onChange={(event) => {
                selectedRef.current = event.target.value;
                setSelected(event.target.value);
                setHistory(null);
                setAccessHistory(null);
                setSameVisit(false);
                setAppointmentId('');
              }}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900"
            >
              <option value="">Select exact request ID</option>
              {admin && associations
                .filter(
                  (item) =>
                    !catalog?.items.some(
                      (request) => request.id === item.showing_request_id,
                    ),
                )
                .map((item) => (
                  <option
                    key={item.showing_request_id}
                    value={item.showing_request_id}
                  >
                    {item.showing_request_id} · linked to this transaction
                  </option>
                ))}
              {catalog?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · listing {item.listing_id} · {item.status}
                </option>
              ))}
            </select>
          </label>
          {admin && <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              className="underline disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              type="button"
              disabled={!catalog || page * catalog.page_size >= catalog.total}
              onClick={() => setPage((value) => value + 1)}
              className="underline disabled:opacity-50"
            >
              Next
            </button>
          </div>}
          {selected && (
            <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800">
              <p className="break-all">
                Request ID: <strong>{selected}</strong>
              </p>
              {candidate && (
                <p>
                  Listing ID: {candidate.listing_id} · Status:{' '}
                  {candidate.status} ·{' '}
                  {candidate.scheduled_at ? 'Scheduled' : 'No confirmed time'}
                </p>
              )}
              <p>
                {current
                  ? `Linked · revision ${current.revision} · ${current.seller_visible ? 'Seller-visible' : current.shared_at ? 'Sharing no longer eligible' : 'Private'}`
                  : 'No current association with this transaction on the authorized list.'}
              </p>
              {current?.same_as_appointment_id && (
                <p>
                  Verified same visit as S5 appointment{' '}
                  {current.same_as_appointment_id}.
                </p>
              )}
              {current?.seller_visible && <div className="space-y-1 rounded-lg border border-zinc-200 bg-white p-3">
                <p className="font-semibold">Seller property access: {access?.state.replaceAll('_', ' ') ?? 'Loading'}</p>
                {access?.change_explanation && <p>Seller requested a different time: {access.change_explanation}</p>}
                {access?.requested_time && <p>Suggested time: {new Date(access.requested_time).toLocaleString()}</p>}
                {access?.state === 'approved' && <p>Seller approved the exact proposed time. Agent still confirms the buyer booking.</p>}
                {admin && access?.policy === 'required' && access.state !== 'approved' && access.state !== 'admin_exception' &&
                  <button type="button" disabled={busy || !reason.trim()} onClick={() => void overrideAccess()}
                    className="rounded-lg border border-amber-500 px-3 py-2 font-semibold disabled:opacity-50">
                    Record administrative access exception
                  </button>}
                <button type="button" onClick={() => void listShowingAccessHistory(transactionId, selected).then(setAccessHistory).catch((failure) => setError(buyerShowingError(failure)))}
                  className="block font-semibold text-primarycolor-text underline">Review access response history</button>
                {accessHistory && <ol className="space-y-1 text-xs">
                  {accessHistory.map((event, index) => <li key={`${event.occurred_at}-${index}`}>{event.action} · {new Date(event.occurred_at).toLocaleString()}</li>)}
                </ol>}
              </div>}
              {!current && candidate && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sameVisit}
                      onChange={(event) => {
                        setSameVisit(event.target.checked);
                        setAppointmentId('');
                      }}
                    />
                    I independently verified this is the same physical visit as
                    an S5 appointment
                  </label>
                  {sameVisit && (
                    <label className="block font-medium">
                      Exact S5 showing appointment
                      <select
                        value={appointmentId}
                        onChange={(event) =>
                          setAppointmentId(event.target.value)
                        }
                        className="mt-1 block w-full rounded-lg border p-2"
                      >
                        <option value="">Select appointment ID</option>
                        {exactVisits.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.id} · {item.status}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              <label className="block font-medium">
                Audit reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {!current && candidate && (
                  <button
                    type="button"
                    disabled={
                      busy || !reason.trim() || (sameVisit && !appointmentId)
                    }
                    onClick={() => void perform('associate')}
                    className="min-h-10 rounded-full border border-primarycolor px-4 py-2 font-semibold text-primarycolor-text disabled:opacity-50"
                  >
                    Associate privately
                  </button>
                )}
                {current && !current.shared_at && (
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => void perform('share')}
                    className="min-h-10 rounded-full bg-primarycolor px-4 py-2 font-semibold text-primarycolor-foreground disabled:opacity-50"
                  >
                    Share with seller
                  </button>
                )}
                {current?.shared_at && (
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => void perform('withdraw')}
                    className="min-h-10 rounded-full border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:opacity-50"
                  >
                    Withdraw sharing
                  </button>
                )}
                {admin && current && (
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => void perform('unlink')}
                    className="min-h-10 rounded-full border border-zinc-300 px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    Unlink association
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void readHistory()}
                  className="min-h-10 font-semibold text-primarycolor-text underline"
                >
                  Review audit history
                </button>
              </div>
              {history && (
                <ol className="space-y-2 border-t border-zinc-200 pt-2">
                  {history.map((event, index) => (
                    <li key={`${event.occurred_at}-${index}`}>
                      <strong>{event.action}</strong> ·{' '}
                      {new Date(event.occurred_at).toLocaleString()} ·{' '}
                      {String(
                        event.event_metadata?.reason ?? 'No reason recorded',
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
