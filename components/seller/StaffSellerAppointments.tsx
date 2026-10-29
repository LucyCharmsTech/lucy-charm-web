'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import {
  actOnSellerAppointment, appointmentError, createSellerAppointment, formatPropertyTime,
  listAppointmentChanges, listAppointmentHistory, listSellerAppointments, propertyLocalOptions,
  resolveAppointmentChange,
  type AppointmentScope, type SellerAppointment, type SellerAppointmentChange,
  type SellerAppointmentHistory, type SellerAppointmentKind,
} from '@/services/sellerAppointmentService';

type Pending = {
  appointment: SellerAppointment;
  action: 'confirm' | 'cancel' | 'complete' | 'accept' | 'reject';
  change?: SellerAppointmentChange;
  confirmedLocalAt?: string;
  note?: string;
};

const labels: Record<SellerAppointmentKind, string> = {
  consultation: 'Consultation', plan_discussion: 'Seller Plan discussion',
  preparation: 'Preparation', photography: 'Photography', showing: 'Showing',
  sale_related: 'Sale related',
};

export default function StaffSellerAppointments({ scope, role, showingOnly = false, excludeShowings = false }: {
  scope: AppointmentScope; role: string | undefined; showingOnly?: boolean; excludeShowings?: boolean;
}) {
  const [items, setItems] = useState<SellerAppointment[]>([]);
  const [changes, setChanges] = useState<Record<string, SellerAppointmentChange[]>>({});
  const [history, setHistory] = useState<Record<string, SellerAppointmentHistory[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [kind, setKind] = useState<SellerAppointmentKind>('consultation');
  const [zone, setZone] = useState('');
  const [localTime, setLocalTime] = useState('');
  const [offset, setOffset] = useState('');
  const [details, setDetails] = useState('');
  const [visible, setVisible] = useState(true);
  const [replacement, setReplacement] = useState<Record<string, string>>({});
  const [replacementOffset, setReplacementOffset] = useState<Record<string, string>>({});
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});
  const mounted = useRef(true);
  const sequence = useRef(0);
  const journeyId = scope.journeyId;
  const transactionId = scope.transactionId;
  const staff = role === 'agent' || role === 'superadmin';
  const allKinds: SellerAppointmentKind[] = scope.journeyId
    ? ['consultation', 'plan_discussion', 'preparation']
    : ['consultation', 'plan_discussion', 'preparation', 'photography', 'showing', 'sale_related'];
  const kinds = showingOnly ? allKinds.filter((value) => value === 'showing')
    : excludeShowings ? allKinds.filter((value) => value !== 'showing') : allKinds;

  const refresh = useCallback(async (initial = false) => {
    const request = ++sequence.current;
    if (initial) setLoading(true);
    try {
      const currentScope: AppointmentScope = journeyId ? { journeyId } : { transactionId: transactionId! };
      const rows = (await listSellerAppointments(currentScope, true)).filter((item) =>
        (!showingOnly || item.kind === 'showing') && (!excludeShowings || item.kind !== 'showing'));
      const details = await Promise.all(rows.map(async (item) => [item.id,
        await Promise.all([listAppointmentChanges(item.id, true), listAppointmentHistory(item.id)]),
      ] as const));
      if (!mounted.current || request !== sequence.current) return;
      setItems(rows);
      setChanges(Object.fromEntries(details.map(([id, [requests]]) => [id, requests])));
      setHistory(Object.fromEntries(details.map(([id, [, events]]) => [id, events])));
      if (initial) setError(null);
    } catch (failure) {
      if (!mounted.current || request !== sequence.current) return;
      setItems([]); setChanges({}); setHistory({}); setPending(null);
      setError(appointmentError(failure));
    } finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, [journeyId, transactionId, showingOnly, excludeShowings]);

  useEffect(() => {
    if (!staff) return;
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
  }, [refresh, staff]);

  async function execute(change: () => Promise<unknown>, success: string): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true); setError(null); setNotice(null);
    try {
      await change();
      if (!mounted.current) return false;
      setPending(null);
      await refresh();
      if (transactionId) window.dispatchEvent(new Event('seller-showings-changed'));
      setNotice(success);
      return true;
    } catch (failure) {
      if (!mounted.current) return false;
      const status = (failure as { response?: { status?: number } })?.response?.status;
      setPending(null);
      if ([401, 403, 404, 409].includes(status ?? 0)) await refresh();
      setError(appointmentError(failure));
      return false;
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  }

  const creationOptions = localTime && zone ? propertyLocalOptions(localTime, zone) : [];
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    if (!creationOptions.length || creationOptions.length > 1 && !offset) {
      setError('Choose a valid property-local time and its UTC offset when repeated.'); return;
    }
    const saved = await execute(() => createSellerAppointment(scope, {
      kind: showingOnly ? 'showing' : kind, seller_details: details.trim() || null, visible_to_seller: visible,
      property_timezone: zone.trim(), proposed_local_at: offset || creationOptions[0],
    }), 'Appointment request saved. The proposed time is not yet confirmed.');
    if (saved && mounted.current) { setLocalTime(''); setOffset(''); setDetails(''); }
  }

  function queueResolution(item: SellerAppointment, change: SellerAppointmentChange, action: 'accept' | 'reject') {
    if (busyRef.current) return;
    let confirmedLocalAt: string | undefined;
    if (action === 'accept') {
      const chosen = replacement[change.id] ?? '';
      const options = propertyLocalOptions(chosen, item.property_timezone);
      if (!options.length || options.length > 1 && !replacementOffset[change.id]) {
        setError('Choose a valid replacement time and its UTC offset before accepting.'); return;
      }
      confirmedLocalAt = replacementOffset[change.id] || options[0];
    }
    setError(null);
    setPending({ appointment: item, action, change, confirmedLocalAt,
      note: resolutionNote[change.id]?.trim() || undefined });
  }

  async function confirmPending() {
    if (!pending || busyRef.current) return;
    const { appointment, action, change, confirmedLocalAt, note } = pending;
    if (action === 'accept' || action === 'reject') {
      if (!change) return;
      await execute(() => resolveAppointmentChange(appointment.id, change.id, {
        expected_revision: appointment.revision, decision: action === 'accept' ? 'accepted' : 'rejected',
        ...(confirmedLocalAt ? { confirmed_local_at: confirmedLocalAt } : {}),
        ...(note ? { note } : {}),
      }), action === 'accept' ? 'Change approved and new booking confirmed.' : 'Change request rejected; the booking was not changed.');
    } else {
      await execute(() => actOnSellerAppointment(appointment.id, action, appointment.revision),
        action === 'confirm' ? 'Appointment confirmed.' : action === 'cancel' ? 'Appointment cancelled.' : 'Appointment marked completed.');
    }
  }

  if (!staff) return null;
  return <section aria-label="Staff seller appointments" className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-bold">{showingOnly ? 'S5 showing appointments' : 'Appointments'}</h2>
      <p className="mt-1 text-sm text-zinc-600">Manage this {scope.journeyId ? 'seller exploration' : 'represented transaction'} only. Internal appointments are not visible to the seller.</p></div>
      <button type="button" onClick={() => void refresh()} className="min-h-10 text-sm font-semibold text-primarycolor-text underline">Refresh</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-primarycolor/5 p-3 text-sm text-zinc-700">{notice}</p>}
    <form onSubmit={(event) => void create(event)} className="space-y-3 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
      <h3 className="font-semibold">New appointment</h3>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">Type
        <select value={showingOnly ? 'showing' : kind} onChange={(event) => setKind(event.target.value as SellerAppointmentKind)} className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900">
          {kinds.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select></label>
        <label className="block text-sm font-medium">Property timezone (IANA)
          <input list="seller-timezones" required value={zone} onChange={(event) => { setZone(event.target.value); setOffset(''); }} placeholder="America/Toronto" className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900" />
          <datalist id="seller-timezones"><option value="America/Toronto" /><option value="America/Vancouver" /><option value="America/Edmonton" /><option value="America/Winnipeg" /><option value="America/Halifax" /><option value="America/St_Johns" /></datalist>
        </label></div>
      <label className="block text-sm font-medium">Proposed property-local date and time
        <input type="datetime-local" required value={localTime} onChange={(event) => { setLocalTime(event.target.value); setOffset(''); }} className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900" />
      </label>
      {localTime && zone && !creationOptions.length && <p role="alert" className="text-sm text-red-700">This time or timezone is invalid. Check for a daylight saving time gap.</p>}
      {creationOptions.length > 1 && <label className="block text-sm font-medium">Which occurrence of this repeated time?
        <select value={offset} onChange={(event) => setOffset(event.target.value)} required className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2"><option value="">Select UTC offset</option>{creationOptions.map((option) => <option key={option} value={option}>{option.slice(-6)}</option>)}</select>
      </label>}
      <label className="block text-sm font-medium">Seller-facing details (optional)
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={2} placeholder="Only include information the seller may read" className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900" />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /> Visible to seller</label>
      <button type="submit" disabled={busy || !zone || !localTime || !creationOptions.length || creationOptions.length > 1 && !offset} className="min-h-10 rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Save appointment request'}</button>
      <p className="text-xs text-zinc-500">Saving a request does not confirm the booking. Staff must confirm it separately.</p>
    </form>
    {loading ? <p role="status" className="text-sm text-zinc-600">Loading appointments…</p> : items.length === 0 ? <p className="text-sm text-zinc-600">{showingOnly ? 'No S5 showing appointments yet.' : excludeShowings ? 'No other appointments for this record yet.' : 'No appointments for this record yet.'}</p> : <div className="space-y-3">{items.map((item) => <article key={item.id} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{labels[item.kind]}</h3>
        <p className="text-sm text-zinc-700 dark:text-zinc-200">{formatPropertyTime(item.scheduled_at ?? item.proposed_at, item.property_timezone)}</p>
        <p className="text-xs text-zinc-500">Property timezone: {item.property_timezone} · {item.status === 'requested' ? 'Proposed, not confirmed' : item.status}</p></div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold capitalize text-zinc-700">{item.visible_to_seller ? 'Seller visible' : 'Internal only'}</span></div>
      {item.seller_details && <p className="text-sm text-zinc-700 dark:text-zinc-200">{item.seller_details}</p>}
      <div className="flex flex-wrap gap-2">
        {item.status === 'requested' && <button type="button" disabled={busy} onClick={() => setPending({ appointment: item, action: 'confirm' })} className="min-h-10 rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">Confirm proposed time</button>}
        {['requested', 'confirmed'].includes(item.status) && <button type="button" disabled={busy} onClick={() => setPending({ appointment: item, action: 'cancel' })} className="min-h-10 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel appointment</button>}
        {item.status === 'confirmed' && <button type="button" disabled={busy} onClick={() => setPending({ appointment: item, action: 'complete' })} className="min-h-10 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Mark completed</button>}
      </div>
      {(changes[item.id] ?? []).map((change) => <div key={change.id} className="space-y-2 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-700">
        <p className="font-semibold">Change request · {change.status}</p><p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{change.message}</p>
        {change.preferred_at && <p className="text-zinc-600">Preferred: {formatPropertyTime(change.preferred_at, item.property_timezone)}</p>}
        {change.status === 'pending' && <><label className="block font-medium">New confirmed property-local time (required to accept)
          <input type="datetime-local" value={replacement[change.id] ?? ''} onChange={(event) => { setReplacement((current) => ({ ...current, [change.id]: event.target.value })); setReplacementOffset((current) => ({ ...current, [change.id]: '' })); }} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2" />
        </label>
          {replacement[change.id] && propertyLocalOptions(replacement[change.id], item.property_timezone).length > 1 && <label className="block font-medium">Repeated local time: select UTC offset
            <select value={replacementOffset[change.id] ?? ''} onChange={(event) => setReplacementOffset((current) => ({ ...current, [change.id]: event.target.value }))} className="mt-1 block w-full rounded-lg border p-2"><option value="">Select UTC offset</option>{propertyLocalOptions(replacement[change.id], item.property_timezone).map((option) => <option key={option} value={option}>{option.slice(-6)}</option>)}</select>
          </label>}
          <label className="block font-medium">Resolution note (optional)
            <input value={resolutionNote[change.id] ?? ''} onChange={(event) => setResolutionNote((current) => ({ ...current, [change.id]: event.target.value }))} maxLength={1000} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2" />
          </label>
          <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => queueResolution(item, change, 'accept')} className="min-h-10 rounded-full bg-primarycolor px-4 py-2 font-semibold text-primarycolor-foreground disabled:opacity-50">Accept and confirm new time</button>
            <button type="button" disabled={busy} onClick={() => queueResolution(item, change, 'reject')} className="min-h-10 rounded-full border border-zinc-300 px-4 py-2 font-semibold disabled:opacity-50">Reject request</button></div></>}
        {change.resolution_note && <p className="text-zinc-600">Resolution: {change.resolution_note}</p>}
      </div>)}
      {(history[item.id] ?? []).length > 0 && <details className="border-t border-zinc-200 pt-3 text-sm dark:border-zinc-700"><summary className="cursor-pointer font-semibold text-primarycolor-text">Appointment history</summary>
        <ol className="mt-2 space-y-1 text-zinc-600">{history[item.id].map((event) => <li key={event.id}>{event.event.replaceAll('_', ' ')} · {formatPropertyTime(event.created_at, item.property_timezone)}</li>)}</ol>
      </details>}
    </article>)}</div>}
    <ConfirmDialog open={pending !== null} title={pending?.action === 'accept' ? 'Confirm the new booking time?' : pending?.action === 'reject' ? 'Reject this change request?' : pending?.action === 'complete' ? 'Mark this appointment completed?' : pending?.action === 'cancel' ? 'Cancel this appointment?' : 'Confirm this appointment?'}
      description={pending ? pending.action === 'accept' ? `The new confirmed time will be ${formatPropertyTime(pending.confirmedLocalAt ?? null, pending.appointment.property_timezone)}. The current booking changes only after saving.` : pending.action === 'reject' ? 'The original booking will remain unchanged.' : `Current appointment: ${formatPropertyTime(pending.appointment.scheduled_at ?? pending.appointment.proposed_at, pending.appointment.property_timezone)}.` : undefined}
      confirmLabel="Save decision" tone={pending?.action === 'cancel' ? 'danger' : 'default'} busy={busy}
      onCancel={() => { if (!busy) setPending(null); }} onConfirm={() => void confirmPending()} />
  </section>;
}
