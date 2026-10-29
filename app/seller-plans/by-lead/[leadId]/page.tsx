'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { listStaffSellerPlansForLead, type SellerPlanStaff } from '@/services/sellerService';

export default function SellerPlansForLeadPage() {
  const leadId = useParams<{ leadId: string }>().leadId;
  const [plans, setPlans] = useState<SellerPlanStaff[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    listStaffSellerPlansForLead(leadId)
      .then((result) => { if (active) { setPlans(result); setError(false); } })
      .catch(() => { if (active) { setPlans(null); setError(true); } });
    return () => { active = false; };
  }, [leadId]);

  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <h1 className="text-2xl font-bold">Seller Plans for this lead</h1>
    <p className="text-sm text-zinc-600">Ownership follows the canonical lead. Separate property journeys can have separate Plan requests.</p>
    {error && <p role="alert">These Plan requests are not available to your account.</p>}
    {plans === null && !error && <p role="status">Loading Plan requests…</p>}
    {plans?.length === 0 && <p>No Seller Plan requests are linked to this lead.</p>}
    {plans?.map((plan, index) => <div key={plan.seller_lead_id} className="rounded-xl border p-4">
      <p className="font-semibold">Plan request {index + 1}</p>
      <p className="text-sm">Status: {plan.status.replaceAll('_', ' ')}</p>
      <Link className="text-sm font-semibold text-primarycolor-text underline" href={`/seller-plans/${plan.seller_lead_id}`}>Open Plan progress</Link>
    </div>)}
  </main>;
}
