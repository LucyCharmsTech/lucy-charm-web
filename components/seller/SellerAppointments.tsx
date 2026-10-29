'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  appointmentError, formatPropertyTime, listAppointmentChanges, listSellerAppointments,
  propertyLocalOptions, requestAppointmentChange,
  type AppointmentScope, type SellerAppointment, type SellerAppointmentChange,
} from '@/services/sellerAppointmentService';

const kindLabels: Record<SellerAppointment['kind'], string> = {
  consultation: 'Consultation', plan_discussion: 'Seller Plan discussion',
  preparation: 'Preparation appointment', photography: 'Photography',
  showing: 'Showing', sale_related: 'Sale appointment',
};

const statusStyle: Record<SellerAppointment['status'], string> = {
  requested: 'bg-amber-50 text-amber-900', confirmed: 'bg-emerald-50 text-emerald-900',
  cancelled: 'bg-zinc-100 text-zinc-700', completed: 'bg-zinc-100 text-zinc-700',
};

function newRequestKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}-${Math.random()}`;
}

export default function SellerAppointments({ scope, contactHref, onContact, excludeShowings = false }: {
  scope: AppointmentScope; contactHref: string; onContact?: () => void; excludeShowings?: boolean;
}) {
  const [items, setItems] = useState<SellerAppointment[]>([]);
  const [changes, setChanges] = useState<Record<string, SellerAppointmentChange[] | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [preferred, setPreferred] = useState('');
  const [offset, setOffset] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const busyRef = useRef(false);
  const sequence = useRef(0);
  const mounted = useRef(true);

  const journeyId = scope.journeyId;
  const transactionId = scope.transactionId;
  const refresh = useCallback(async (initial = false) => {
    const request = ++sequence.current;
    if (initial) setLoading(true);
    try {
      const currentScope: AppointmentScope = journeyId ? { journeyId } : { transactionId: transactionId! };
      const rows = (await listSellerAppointments(currentScope)).filter((row) =>
        row.visible_to_seller && (!excludeShowings || row.kind !== 'showing'));
      const pairs = await Promise.all(rows.map(async (row) => {
        try { return [row.id, await listAppointmentChanges(row.id)] as const; }
        catch { return [row.id, null] as const; }
      }));
      if (!mounted.current || request !== sequence.current) return;
      setItems(rows);
      setChanges(Object.fromEntries(pairs));
      setNow(Date.now());
      if (initial) setError(null);
      const linked = new URLSearchParams(window.location.search).get('appointment');
      if (linked && rows.some((row) => row.id === linked)) setOpenId(linked);
      setRequestId((current) => current && rows.some((row) => row.id === current &&
        ['requested', 'confirmed'].includes(row.status)) ? current : null);
    } catch (failure) {
      if (!mounted.current || request !== sequence.current) return;
      setItems([]); setChanges({}); setRequestId(null);
      setError(appointmentError(failure));
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [journeyId, transactionId, excludeShowings]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void refresh(true), 0);
    const revalidate = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      mounted.current = false; sequence.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [refresh]);

  function beginRequest(id: string) {
    setOpenId(id); setRequestId(id); setMessage(''); setPreferred(''); setOffset('');
    setKey(newRequestKey());
    setNotice(null); setError(null);
  }

  async function submit(item: SellerAppointment) {
    if (busyRef.current || requestId !== item.id) return;
    if (message.trim().length < 5) { setError('Describe the change in at least five characters.'); return; }
    const options = preferred ? propertyLocalOptions(preferred, item.property_timezone) : [];
    if (preferred && !options.length) { setError('That local time is invalid for the property timezone. Choose another time.'); return; }
    if (preferred && options.length > 1 && !offset) { setError('Choose the UTC offset for this repeated local time.'); return; }
    busyRef.current = true;
    setBusy(true); setError(null); setNotice(null);
    try {
      await requestAppointmentChange(item.id, {
        expected_revision: item.revision, message: message.trim(), idempotency_key: key,
        ...(preferred ? { preferred_local_at: offset || options[0] } : {}),
      });
      if (!mounted.current) return;
      setRequestId(null); setMessage(''); setPreferred(''); setOffset('');
      await refresh();
      setNotice('Change request saved. The existing booking stays in place until staff confirm a change.');
    } catch (failure) {
      if (!mounted.current) return;
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if ([401, 403, 404, 409].includes(status ?? 0)) { setRequestId(null); await refresh(); }
      setError(appointmentError(failure));
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }

  const upcoming = items.filter((item) => ['requested', 'confirmed'].includes(item.status) &&
    Number.isFinite(Date.parse(item.scheduled_at ?? item.proposed_at)) && Date.parse(item.scheduled_at ?? item.proposed_at) >= now);
  const upcomingIds = new Set(upcoming.map((item) => item.id));
  const history = items.filter((item) => !upcomingIds.has(item.id));
  const byTime = (a: SellerAppointment, b: SellerAppointment) =>
    Date.parse(a.scheduled_at ?? a.proposed_at) - Date.parse(b.scheduled_at ?? b.proposed_at);
  upcoming.sort(byTime); history.sort((a, b) => -byTime(a, b));

  const renderItem = (item: SellerAppointment, next = false) => {
    const pending = changes[item.id]?.find((change) => change.status === 'pending');
    const canRequest = ['requested', 'confirmed'].includes(item.status) && changes[item.id] !== null && !pending;
    const options = preferred && requestId === item.id ? propertyLocalOptions(preferred, item.property_timezone) : [];
    return <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primarycolor-text">{next ? 'Next appointment' : kindLabels[item.kind]}</p>
          <h3 className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">{next ? kindLabels[item.kind] : formatPropertyTime(item.scheduled_at ?? item.proposed_at, item.property_timezone)}</h3>
          {next && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{formatPropertyTime(item.scheduled_at ?? item.proposed_at, item.property_timezone)}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle[item.status]}`}>{item.status}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">Property timezone: {item.property_timezone}</p>
      {item.status === 'requested' && <p className="mt-2 text-sm text-zinc-600">Proposed time — staff has not confirmed this booking yet.</p>}
      <button type="button" aria-expanded={openId === item.id} onClick={() => setOpenId(openId === item.id ? null : item.id)} className="mt-3 min-h-10 text-sm font-semibold text-primarycolor-text underline">{openId === item.id ? 'Hide details' : 'Appointment details'}</button>
      {openId === item.id && <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
        {item.seller_details && <p className="text-zinc-700 dark:text-zinc-200">{item.seller_details}</p>}
        {pending && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-900">Change requested — awaiting staff review. Your {item.status === 'confirmed' ? 'confirmed booking' : 'proposed time'} remains unchanged.</p>}
        {changes[item.id] === null && <p role="alert" className="text-amber-800">Could not check change requests. Reload before sending another.</p>}
        {canRequest && requestId !== item.id && <button type="button" onClick={() => beginRequest(item.id)} className="min-h-10 rounded-full border border-primarycolor px-4 py-2 font-semibold text-primarycolor-text">Request a change</button>}
        {requestId === item.id && <form onSubmit={(event) => { event.preventDefault(); void submit(item); }} className="space-y-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
          <p className="text-zinc-700 dark:text-zinc-200">This sends a request. It does not change a confirmed booking.</p>
          <label className="block font-medium">What needs to change?
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={1000} required rows={3} className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900" />
          </label>
          <label className="block font-medium">Preferred local time (optional)
            <input type="datetime-local" value={preferred} onChange={(event) => { setPreferred(event.target.value); setOffset(''); }} className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900" />
          </label>
          {preferred && options.length === 0 && <p role="alert" className="text-red-700">This time is invalid in {item.property_timezone}.</p>}
          {options.length > 1 && <label className="block font-medium">Which occurrence of this repeated time?
            <select value={offset} onChange={(event) => setOffset(event.target.value)} required className="mt-1 block w-full rounded-lg border p-2">
              <option value="">Select UTC offset</option>{options.map((option) => <option key={option} value={option}>{option.slice(-6)}</option>)}
            </select>
          </label>}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy || message.trim().length < 5 || (preferred !== '' && (!options.length || options.length > 1 && !offset))} className="min-h-10 rounded-full bg-primarycolor px-4 py-2 font-semibold text-primarycolor-foreground disabled:opacity-50">{busy ? 'Sending…' : 'Send change request'}</button>
            <button type="button" disabled={busy} onClick={() => setRequestId(null)} className="min-h-10 px-3 font-semibold text-zinc-600">Cancel</button></div>
        </form>}
      </div>}
    </article>;
  };

  return <section aria-label="Seller appointments" id="appointments" className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Appointments</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Times are shown in each property’s timezone. Staff confirm booking changes.</p></div>
      <button type="button" onClick={() => void refresh()} className="min-h-10 text-sm font-semibold text-primarycolor-text underline">Refresh</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-primarycolor/5 p-3 text-sm text-zinc-700">{notice}</p>}
    {loading ? <p role="status" className="text-sm text-zinc-600">Loading appointments…</p> : items.length === 0 ? <p className="text-sm text-zinc-600">{excludeShowings ? 'No other appointments are scheduled for this home yet.' : 'No appointments are scheduled for this home yet.'}</p> : <>
      {upcoming.length > 0 && <div className="space-y-3">{upcoming.map((item, index) => renderItem(item, index === 0))}</div>}
      {history.length > 0 && <div className="space-y-3"><h3 className="text-sm font-semibold text-zinc-700">Past and other appointments</h3>{history.map((item) => renderItem(item))}</div>}
    </>}
    <p className="text-sm text-zinc-600">Need help? {onContact
      ? <button type="button" onClick={onContact} className="font-semibold text-primarycolor-text underline">Contact the team</button>
      : <Link href={contactHref} className="font-semibold text-primarycolor-text underline">Contact the team</Link>}.</p>
  </section>;
}
