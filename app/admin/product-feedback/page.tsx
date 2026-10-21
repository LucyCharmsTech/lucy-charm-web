'use client';

import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import { fetchProductFeedback, type InternalFeedback } from '@/services/productFeedbackService';

export default function AdminProductFeedbackPage() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<InternalFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchProductFeedback(page)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(getApiErrorMessage(reason, 'Could not load product feedback.'));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);

  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <main className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Product feedback</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Restricted first-party responses. Descriptions are not product analytics or support tickets.</p>
      </div>
      {loading && <p role="status">Loading feedback…</p>}
      {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No feedback on this page.</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <strong>{item.feedback_type === 'helpful' ? (item.helpful ? 'Helpful' : 'Not helpful') : 'Problem reported'}</strong>
              <span>{item.context}</span>
              {item.category && <span>{item.category}</span>}
              <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
            </div>
            {item.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm">{item.description}</p>}
          </article>
        ))}
      </div>
      <nav aria-label="Product feedback pages" className="flex items-center gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setPage((n) => n - 1); }} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button>
        <span>Page {page} of {pages} · {total} records</span>
        <button type="button" disabled={page >= pages} onClick={() => { setLoading(true); setPage((n) => n + 1); }} className="rounded border px-3 py-2 disabled:opacity-40">Next</button>
      </nav>
    </main>
  );
}
