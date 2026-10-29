'use client';

import { useEffect, useState } from 'react';
import { buyerShowingError, getShowingAccessPolicy, updateShowingAccessPolicy,
  type ShowingAccessPolicy } from '@/services/sellerBuyerShowingService';

export default function StaffShowingAccessPolicy({ transactionId }: { transactionId: string }) {
  const [current, setCurrent] = useState<ShowingAccessPolicy | null>(null);
  const [selected, setSelected] = useState<ShowingAccessPolicy['policy']>('unset');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getShowingAccessPolicy(transactionId).then((value) => {
      if (active) { setCurrent(value); setSelected(value.policy); }
    }).catch((failure) => { if (active) setError(buyerShowingError(failure)); });
    return () => { active = false; };
  }, [transactionId]);

  async function save() {
    if (!current || busy || !reason.trim() || selected === current.policy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const value = await updateShowingAccessPolicy(transactionId, {
        policy: selected, expected_revision: current.revision, reason: reason.trim(),
      });
      setCurrent(value); setReason('');
      setNotice('Access policy saved. Existing confirmed buyer visits were not changed.');
      window.dispatchEvent(new Event('seller-showings-changed'));
    } catch (failure) {
      setError(buyerShowingError(failure));
      const fresh = await getShowingAccessPolicy(transactionId).catch(() => null);
      if (fresh) { setCurrent(fresh); setSelected(fresh.policy); }
    } finally { setBusy(false); }
  }

  return <section aria-label="Seller property access policy" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
    <h3 className="font-semibold">Seller property access policy</h3>
    <p className="mt-1 text-sm text-zinc-600">Super Admin sets whether the seller must approve access to buyer-origin visits for this represented property. Sharing a showing is not approval.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-2 text-sm text-emerald-700">{notice}</p>}
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="text-sm font-medium">Access approval
        <select value={selected} onChange={(event) => setSelected(event.target.value as ShowingAccessPolicy['policy'])}
          className="mt-1 block rounded-lg border border-zinc-300 bg-white p-2 dark:bg-zinc-900">
          <option value="unset">Unset — blocks new represented confirmations</option>
          <option value="required">Required — seller must approve exact time</option>
          <option value="not_required">Not required</option>
        </select>
      </label>
      <label className="min-w-0 flex-1 text-sm font-medium">Audit reason
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000}
          className="mt-1 w-full rounded-lg border border-zinc-300 p-2" />
      </label>
      <button type="button" onClick={() => void save()} disabled={busy || !current || !reason.trim() || selected === current.policy}
        className="rounded-lg bg-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">
        Save policy
      </button>
    </div>
    {current && <p className="mt-2 text-xs text-zinc-500">Current: {current.policy.replace('_', ' ')} · revision {current.revision}</p>}
  </section>;
}
