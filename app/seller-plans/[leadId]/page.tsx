'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SellerPlanPdfManager from '@/components/seller/SellerPlanPdfManager';
import JourneyDocumentManager from '@/components/seller/JourneyDocumentManager';
import StaffSellerAppointments from '@/components/seller/StaffSellerAppointments';
import { useAuthStore } from '@/stores/authStore';
import {
  fetchStaffSellerPlan, updateStaffSellerPlan,
  type SellerPlanStaff, type SellerPlanUpdate,
} from '@/services/sellerService';

const CHECKS = [
  ['property_details_reviewed', 'Property and details reviewed'],
  ['reco_preparation_recorded', 'RECO/compliance preparation tracked (not approval)'],
  ['recommendations_prepared', 'Recommendations and next steps prepared'],
] as const;

function message(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 409) return 'Plan progress changed. Reload it before saving again.';
  if (status === 403 || status === 404) return 'This Plan is not available to your account.';
  return 'Could not update Seller Plan progress. Please try again.';
}

export default function StaffSellerPlanPage() {
  const identity = useAuthStore((state) => `${state.user?.user_id ?? ''}:${state.accessToken ?? ''}`);
  const role = useAuthStore((state) => state.user?.role);
  return <StaffSellerPlanContent key={identity} role={role} />;
}

function StaffSellerPlanContent({ role }: { role: string | undefined }) {
  const leadId = useParams<{ leadId: string }>().leadId;
  const [plan, setPlan] = useState<SellerPlanStaff | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchStaffSellerPlan(leadId);
      setPlan(result);
      setQuestion(result.information_request ?? '');
      setError(null);
    } catch (failure) {
      setPlan(null);
      setError(message(failure));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(changes: Omit<SellerPlanUpdate, 'expected_revision'>) {
    if (!plan || saving) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const updated = await updateStaffSellerPlan(leadId, {
        ...changes, expected_revision: plan.revision,
      });
      setPlan(updated);
      setQuestion(updated.information_request ?? '');
      setNotice('Plan progress saved.');
    } catch (failure) {
      setError(message(failure));
    } finally {
      setSaving(false);
    }
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <div><h1 className="text-2xl font-bold">Seller Plan progress</h1>
      <p className="text-sm text-zinc-600">Track preparation, then manage private PDF versions, approval and publication below.</p></div>
    {loading && <p role="status">Loading Plan progress…</p>}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error} <button type="button" onClick={() => void load()} className="underline">Reload</button></div>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900">{notice}</p>}
    {plan && <>
      {plan.canonical_lead_id ? (
        <p className="text-sm">Assignment follows the canonical lead. <Link className="font-semibold text-primarycolor-text underline" href={role === 'superadmin' ? `/admin/inquiries/${plan.canonical_lead_id}` : `/agent/leads?lead_id=${plan.canonical_lead_id}`}>View lead</Link></p>
      ) : (
        <p className="text-sm">Legacy request without a verified canonical lead. Only a Super Admin can manage Plan progress; reconcile the lead relationship before assigning agent work.</p>
      )}
      <section className="space-y-3 rounded-xl border p-4" aria-label="Plan preparation checklist">
        <h2 className="font-semibold">Preparation checklist</h2>
        {CHECKS.map(([field, label]) => <label key={field} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={plan[field]} disabled={saving || plan.status === 'ready'} onChange={(event) => void save({ [field]: event.target.checked })} />{label}</label>)}
        <p className="text-sm">Canonical lead assignment: <strong>{plan.canonical_lead_id && plan.assigned_agent_id ? 'Assigned to current lead agent' : 'Admin queue — unassigned'}</strong>. Change ownership on the lead only.</p>
        <label className="block text-sm">Manual valuation needed?
          <select className="mt-1 block rounded border p-2" value={plan.manual_valuation_needed === null ? '' : String(plan.manual_valuation_needed)} disabled={saving || plan.status === 'ready'} onChange={(event) => void save({ manual_valuation_needed: event.target.value === '' ? null : event.target.value === 'true' })}>
            <option value="">Not decided</option><option value="true">Yes</option><option value="false">No</option>
          </select>
        </label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={plan.additional_information_requested} disabled={saving || plan.status === 'ready'} onChange={(event) => void save({ additional_information_requested: event.target.checked })} />Additional information/photos needed (optional)</label>
      </section>
      <section className="space-y-3 rounded-xl border p-4" aria-label="Plan status">
        <h2 className="font-semibold">Status: {plan.status.replaceAll('_', ' ')}</h2>
        {plan.status === 'requested' && <button type="button" disabled={saving} onClick={() => void save({ status: 'in_preparation' })} className="rounded bg-primarycolor px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Start preparation</button>}
        {plan.status === 'needs_information' && <button type="button" disabled={saving || !plan.information_response} onClick={() => void save({ status: 'in_preparation' })} className="rounded bg-primarycolor px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Resume preparation</button>}
        <p className="text-sm text-zinc-600">The seller sees this progress. Ready is set only after an approved PDF is published and accessible.</p>
      </section>
      <section className="space-y-3 rounded-xl border p-4" aria-label="Request seller information">
        <h2 className="font-semibold">Request information from seller</h2>
        <label className="block text-sm">Specific question
          <textarea className="mt-1 w-full rounded border p-2" value={question} maxLength={1000} disabled={plan.status === 'ready'} onChange={(event) => setQuestion(event.target.value)} rows={3} />
        </label>
        <button type="button" disabled={saving || plan.status === 'ready' || !question.trim()} onClick={() => void save({ information_request: question.trim(), status: 'needs_information' })} className="rounded bg-primarycolor px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send question</button>
        {plan.information_response && <p className="rounded bg-zinc-50 p-3 text-sm">Seller response: {plan.information_response}</p>}
      </section>
      {plan.seller_lead_id === leadId && <SellerPlanPdfManager key={leadId} leadId={leadId} plan={plan} role={role} onPlanReload={load} />}
      {plan.seller_lead_id === leadId && <JourneyDocumentManager key={plan.seller_journey_id} journeyId={plan.seller_journey_id} role={role} />}
      {plan.seller_lead_id === leadId && <StaffSellerAppointments scope={{ journeyId: plan.seller_journey_id }} role={role} />}
    </>}
  </main>;
}
