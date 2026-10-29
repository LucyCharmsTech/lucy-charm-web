'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchAssignedSellerTransactions,
  type AssignedSellerTransaction,
} from '@/services/sellerService';
import type { ApiPaginated } from '@/types/api';
import { useAuthStore } from '@/stores/authStore';

const PAGE_SIZE = 20;

type Result = {
  scope: string;
  data?: ApiPaginated<AssignedSellerTransaction>;
  error?: 'forbidden' | 'unavailable' | 'failed';
};

function requestError(error: unknown): Result['error'] {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404 || (typeof status === 'number' && status >= 500)) return 'unavailable';
  return 'failed';
}

function propertyLabel(row: AssignedSellerTransaction): string {
  return `${row.property_address}${row.property_unit ? `, Unit ${row.property_unit}` : ''}`;
}

export default function AgentRepresentedSellersPage() {
  const userId = useAuthStore((state) => state.user?.user_id);
  const role = useAuthStore((state) => state.user?.role);
  const accessToken = useAuthStore((state) => state.accessToken);
  const accountKey = accessToken && role === 'agent' && userId ? userId : '';
  const [pageState, setPageState] = useState({ accountKey: '', page: 1 });
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const page = pageState.accountKey === accountKey ? pageState.page : 1;
  const scope = `${accountKey}:${accessToken ?? ''}:${page}:${refresh}`;
  const current = result?.scope === scope ? result : null;

  useEffect(() => {
    if (!accountKey) return;
    let active = true;
    fetchAssignedSellerTransactions(page, PAGE_SIZE)
      .then((data) => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
        if (page > lastPage) {
          setPageState({ accountKey, page: lastPage });
          return;
        }
        setResult({ scope, data });
      })
      .catch((error: unknown) => {
        if (active) setResult({ scope, error: requestError(error) });
      });
    return () => { active = false; };
  }, [accountKey, page, scope]);

  useEffect(() => {
    if (!accountKey) return;
    const revalidate = () => setRefresh((value) => value + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') revalidate();
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [accountKey]);

  if (!accountKey) {
    return <p role="status" className="text-sm text-zinc-600">Sign in with an Agent account to view represented sellers.</p>;
  }

  const data = current?.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  return <main className="mx-auto max-w-5xl space-y-6">
    <header>
      <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">Represented Sellers</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Active seller portals currently assigned to you.</p>
    </header>
    {!current && <p role="status" className="text-sm text-zinc-600">Loading represented sellers…</p>}
    {current?.error === 'forbidden' && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your Agent account is no longer authorized to view represented sellers.</p>}
    {current?.error === 'unavailable' && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Represented sellers are temporarily unavailable. Please retry.</p>}
    {current?.error === 'failed' && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not load represented sellers. Please retry.</p>}
    {current?.error && <button type="button" onClick={() => setRefresh((value) => value + 1)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primarycolor">Retry</button>}
    {data && <>
      {data.items.length === 0 ? <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">No active represented-seller transactions are assigned to you.</p>
        : <div className="grid gap-3 sm:grid-cols-2">{data.items.map((row) => <Link
          key={row.transaction_id}
          href={`/seller-portal/${encodeURIComponent(row.transaction_id)}`}
          className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-primarycolor/50 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900"
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">{propertyLabel(row)}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{row.property_city}, {row.property_region}</p>
          <p className="mt-2 text-xs text-zinc-500">Current stage: {row.current_stage.replaceAll('_', ' ')}</p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-500">Transaction {row.transaction_id}</p>
        </Link>)}</div>}
      <nav aria-label="Represented Sellers pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPageState({ accountKey, page: page - 1 })} className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 font-semibold disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primarycolor">Previous</button>
        <span>Page {page} of {totalPages} · {data.total} total</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPageState({ accountKey, page: page + 1 })} className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 font-semibold disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primarycolor">Next</button>
      </nav>
    </>}
  </main>;
}
