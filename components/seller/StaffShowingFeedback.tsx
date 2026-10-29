'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { formatPropertyTime, listSellerAppointments, type SellerAppointment } from '@/services/sellerAppointmentService';
import { listBuyerShowingAssociations, listSellerShowings, type BuyerShowingAssociation, type SellerShowing } from '@/services/sellerBuyerShowingService';
import {
  actOnShowingFeedback, createShowingFeedback, editShowingFeedback,
  listShowingFeedbackHistory, listStaffShowingFeedback, showingFeedbackError,
  type ShowingFeedbackHistory, type StaffShowingFeedback,
} from '@/services/sellerShowingFeedbackService';

type Editor = { text: string; revision: number | null };
type Decision = { action: 'correct' | 'publish' | 'withdraw'; feedback: StaffShowingFeedback; text?: string };
type Source = { key: string; id: string; kind: 'appointment' | 'buyer'; label: string; eligible: boolean };

const statusLabels: Record<StaffShowingFeedback['status'], string> = {
  draft: 'Private draft', pending_review: 'Awaiting Super Admin review',
  published: 'Published to seller', withdrawn: 'Withdrawn',
};
const statusColors: Record<StaffShowingFeedback['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-700', pending_review: 'bg-amber-50 text-amber-900',
  published: 'bg-emerald-50 text-emerald-800', withdrawn: 'bg-red-50 text-red-800',
};

export default function StaffShowingFeedback({ transactionId, role }: {
  transactionId: string; role: string | undefined;
}) {
  const [appointments, setAppointments] = useState<SellerAppointment[]>([]);
  const [associations, setAssociations] = useState<BuyerShowingAssociation[]>([]);
  const [showings, setShowings] = useState<SellerShowing[]>([]);
  const [feedback, setFeedback] = useState<StaffShowingFeedback[]>([]);
  const [history, setHistory] = useState<Record<string, ShowingFeedbackHistory[]>>({});
  const [editors, setEditors] = useState<Record<string, Editor>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const sequence = useRef(0);
  const staff = role === 'agent' || role === 'superadmin';
  const admin = role === 'superadmin';

  const refresh = useCallback(async (initial = false) => {
    const request = ++sequence.current;
    if (initial) setLoading(true);
    try {
      const [rows, records, links, unified] = await Promise.all([
        listSellerAppointments({ transactionId }, true), listStaffShowingFeedback(transactionId),
        listBuyerShowingAssociations(transactionId), listSellerShowings(transactionId),
      ]);
      const showings = rows.filter((row) => row.transaction_id === transactionId && row.kind === 'showing');
      const matching = records.filter((row) => row.transaction_id === transactionId);
      const histories = await Promise.all(matching.map(async (row) =>
        [row.id, await listShowingFeedbackHistory(transactionId, row.id)] as const));
      if (!mounted.current || request !== sequence.current) return false;
      setAppointments(showings);
      setAssociations(links.filter((row) => row.transaction_id === transactionId));
      setShowings(unified);
      setFeedback(matching);
      setHistory(Object.fromEntries(histories));
      setEditors((current) => {
        const next = { ...current };
        const sourceKeys = [
          ...showings.map((row) => `appointment:${row.id}`),
          ...links.filter((row) => row.transaction_id === transactionId && !row.same_as_appointment_id)
            .map((row) => `buyer:${row.id}`),
        ];
        for (const key of sourceKeys) {
          if (next[key] === undefined) {
            const found = matching.find((record) => record.appointment_id
              ? key === `appointment:${record.appointment_id}`
              : key === `buyer:${record.buyer_showing_association_id}`);
            next[key] = { text: found?.summary ?? '', revision: found?.revision ?? null };
          }
        }
        return next;
      });
      setError(null);
      return true;
    } catch (failure) {
      if (!mounted.current || request !== sequence.current) return false;
      setAppointments([]); setAssociations([]); setShowings([]); setFeedback([]); setHistory({}); setEditors({}); setDecision(null);
      setError(showingFeedbackError(failure));
      return false;
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (!staff) return;
    mounted.current = true;
    const timer = window.setTimeout(() => void refresh(true), 0);
    const revalidate = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', revalidate);
    window.addEventListener('seller-showings-changed', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('seller-showings-changed', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [refresh, staff]);

  function resetEditor(sourceKey: string, record?: StaffShowingFeedback) {
    setEditors((current) => ({ ...current, [sourceKey]: {
      text: record?.summary ?? '', revision: record?.revision ?? null,
    } }));
  }

  async function execute(sourceKey: string, action: () => Promise<unknown>, message: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(null); setNotice(null);
    try {
      await action();
      if (!mounted.current) return;
      setDecision(null);
      setEditors((current) => { const next = { ...current }; delete next[sourceKey]; return next; });
      if (await refresh()) { setNotice(message); window.dispatchEvent(new Event('seller-showings-changed')); }
    } catch (failure) {
      if (!mounted.current) return;
      setDecision(null);
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if ([401, 403, 404, 409].includes(status ?? 0)) await refresh();
      setError(showingFeedbackError(failure));
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function save(source: Source, record?: StaffShowingFeedback) {
    if (busyRef.current) return;
    const editor = editors[source.key];
    const text = editor?.text.trim() ?? '';
    if (!text || text.length > 2000) { setError('Write a seller-safe summary of 1 to 2,000 characters.'); return; }
    if (editor?.revision !== (record?.revision ?? null)) {
      setError('Feedback changed. Reload this editor before saving.'); return;
    }
    if (!record) {
      void execute(source.key, () => createShowingFeedback(transactionId,
        source.kind === 'appointment' ? source.id : { buyer_showing_association_id: source.id }, text),
        'Private feedback draft saved. It is not visible to the seller.');
    } else if (record.status === 'published') {
      setDecision({ action: 'correct', feedback: record, text });
    } else {
      void execute(source.key,
        () => editShowingFeedback(transactionId, record.id, record.revision, text),
        record.status === 'withdrawn'
          ? 'Replacement draft saved. Super Admin approval is still required.'
          : 'Private feedback draft saved. It is not visible to the seller.');
    }
  }

  function confirmDecision() {
    if (!decision || busyRef.current) return;
    const { action, feedback: record, text } = decision;
    const sourceKey = record.appointment_id ? `appointment:${record.appointment_id}` : `buyer:${record.buyer_showing_association_id}`;
    if (action === 'correct') {
      void execute(sourceKey,
        () => editShowingFeedback(transactionId, record.id, record.revision, text ?? ''),
        'Correction saved as a private draft. The old summary is no longer visible to the seller.');
    } else {
      void execute(sourceKey,
        () => actOnShowingFeedback(transactionId, record.id, action, record.revision),
        action === 'publish'
          ? 'Reviewed revision published to the seller.'
          : 'Feedback withdrawn. New seller reads are revoked.');
    }
  }

  if (!staff) return null;
  const records = new Map(feedback.map((row) => [row.appointment_id
    ? `appointment:${row.appointment_id}` : `buyer:${row.buyer_showing_association_id}`, row]));
  const sources: Source[] = [
    ...appointments.map((row) => {
      const linked = associations.find((item) => item.same_as_appointment_id === row.id);
      const completedBuyer = showings.some((item) => item.id === `buyer:${linked?.id}` && item.status === 'completed');
      return { key: `appointment:${row.id}`, id: row.id, kind: 'appointment' as const,
        label: `S5 showing · ${formatPropertyTime(row.scheduled_at ?? row.proposed_at, row.property_timezone)}${linked ? ' · verified same visit' : ''}`,
        eligible: row.status === 'completed' && row.visible_to_seller && Boolean(row.scheduled_at) &&
          (!linked || linked.seller_visible && completedBuyer) };
    }),
    ...associations.filter((row) => !row.same_as_appointment_id).map((row) => {
      const visible = showings.find((item) => item.id === `buyer:${row.id}`);
      return { key: `buyer:${row.id}`, id: row.id, kind: 'buyer' as const,
        label: `Buyer-origin showing · ${visible?.starts_at ? new Date(visible.starts_at).toLocaleString() : row.showing_request_id}`,
        eligible: row.seller_visible && visible?.status === 'completed' };
    }),
  ];
  const sourceKeys = new Set(sources.map((source) => source.key));
  for (const record of feedback) {
    const key = record.appointment_id ? `appointment:${record.appointment_id}` : `buyer:${record.buyer_showing_association_id}`;
    if (sourceKeys.has(key)) continue;
    sources.push({ key, id: record.appointment_id ?? record.buyer_showing_association_id ?? record.id,
      kind: record.appointment_id ? 'appointment' : 'buyer',
      label: 'Historical feedback · source is no longer eligible', eligible: false });
    sourceKeys.add(key);
  }

  return <section aria-label="Staff showing feedback" className="mt-5 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
    <div className="flex flex-wrap items-start justify-between gap-2"><div>
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Showing feedback review</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Only completed, seller-visible showings can receive feedback. Summaries remain private until Super Admin approval.</p>
    </div><button type="button" onClick={() => void refresh()} className="min-h-10 text-sm font-semibold text-primarycolor-text underline">Refresh feedback</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-primarycolor/5 p-3 text-sm text-zinc-700">{notice}</p>}
    {loading ? <p role="status" className="text-sm text-zinc-600">Loading showing feedback…</p>
      : sources.length === 0 ? <p className="text-sm text-zinc-600">No eligible transaction showing sources are recorded yet.</p>
        : <div className="space-y-3">{sources.map((source) => {
          const record = records.get(source.key);
          const editor = editors[source.key] ?? { text: record?.summary ?? '', revision: record?.revision ?? null };
          const eligible = source.eligible;
          const stale = editor.revision !== (record?.revision ?? null);
          const changed = editor.text.trim() !== (record?.summary ?? '');
          const canSave = eligible && !stale && editor.text.trim().length > 0 && editor.text.trim().length <= 2000 && (!record || changed);
          return <article key={source.key} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-2"><div>
              <h4 className="font-semibold">{source.label}</h4>
              <p className="text-xs text-zinc-500">Exact source: {source.id} · Transaction {transactionId.slice(0, 8)}</p>
            </div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record ? statusColors[record.status] : 'bg-zinc-100 text-zinc-700'}`}>
              {record ? statusLabels[record.status] : 'No feedback draft'}
            </span></div>
            {!eligible ? <p className="text-sm text-zinc-600">Complete this exact seller-visible showing before preparing feedback. Buyer-origin showings also require current Super Admin sharing and A0 eligibility.</p> : <>
              {record?.status === 'published' && <p className="text-sm text-amber-900">Saving a correction immediately hides the current seller summary until a Super Admin approves the new revision.</p>}
              {record?.status === 'pending_review' && <p className="text-sm text-amber-900">Submitted for review. The seller cannot see this draft.</p>}
              {record?.status === 'withdrawn' && <p className="text-sm text-red-800">Withdrawn from seller access. A replacement needs a new draft and approval.</p>}
              <label className="block text-sm font-medium">Seller-safe summary
                <textarea value={editor.text} onChange={(event) => setEditors((current) => ({ ...current,
                  [source.key]: { text: event.target.value, revision: editor.revision },
                }))} rows={4} maxLength={2000} disabled={busy || stale} className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              <p className="text-xs text-zinc-500">Write a summary for the seller. Do not paste buyer names, contact details, raw comments, or internal notes. Human approval is required.</p>
              {stale && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-900">This feedback changed since the editor loaded.
                <button type="button" onClick={() => resetEditor(source.key, record)} className="min-h-10 font-semibold underline">Load latest summary</button></div>}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || !canSave} onClick={() => save(source, record)} className="min-h-10 rounded-full border border-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-text disabled:opacity-50">
                  {!record ? 'Save private draft' : record.status === 'published' ? 'Correct published summary' : record.status === 'withdrawn' ? 'Prepare replacement draft' : 'Save draft changes'}
                </button>
                {record?.status === 'draft' && <button type="button" disabled={busy || stale || changed} onClick={() => void execute(source.key,
                  () => actOnShowingFeedback(transactionId, record.id, 'submit', record.revision),
                  'Submitted for Super Admin review. The seller cannot see this draft.')} className="min-h-10 rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">Submit for review</button>}
                {admin && record?.status === 'pending_review' && <button type="button" disabled={busy || stale || changed} onClick={() => setDecision({ action: 'publish', feedback: record })} className="min-h-10 rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">Approve and publish</button>}
              </div>
            </>}
            {admin && record?.status === 'published' && <button type="button" disabled={busy || stale} onClick={() => setDecision({ action: 'withdraw', feedback: record })} className="min-h-10 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Withdraw feedback</button>}
            {record && <details className="border-t border-zinc-200 pt-3 text-sm dark:border-zinc-700"><summary className="cursor-pointer font-semibold text-primarycolor-text">Private feedback history</summary>
              <ol className="mt-2 space-y-3">{(history[record.id] ?? []).map((event) => <li key={`${event.revision}-${event.action}`} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                <p className="text-xs font-semibold capitalize text-zinc-600">Revision {event.revision} · {event.action.replaceAll('_', ' ')} · {event.status.replaceAll('_', ' ')}</p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{event.summary}</p>
              </li>)}</ol>
            </details>}
          </article>;
        })}</div>}
    <ConfirmDialog open={decision !== null} busy={busy} tone={decision?.action === 'withdraw' ? 'danger' : 'default'}
      title={decision?.action === 'correct' ? 'Hide the published summary and save a correction?'
        : decision?.action === 'withdraw' ? 'Withdraw this feedback from the seller?' : 'Approve this reviewed revision?'}
      description={decision?.action === 'correct' ? 'Saving immediately removes the current seller-visible summary. The corrected draft needs a new Super Admin approval.'
        : decision?.action === 'withdraw' ? 'New seller list and detail reads will no longer include this feedback.'
          : 'This exact submitted summary will become visible to the represented seller.'}
      confirmLabel={decision?.action === 'correct' ? 'Save correction' : decision?.action === 'withdraw' ? 'Withdraw feedback' : 'Approve and publish'}
      onCancel={() => { if (!busy) setDecision(null); }} onConfirm={confirmDecision} />
  </section>;
}
