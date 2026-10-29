'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listPublishedShowingFeedback, showingFeedbackError,
  type PublishedShowingFeedback,
} from '@/services/sellerShowingFeedbackService';

function dateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function SellerShowingFeedback({ transactionId }: { transactionId: string }) {
  const [items, setItems] = useState<PublishedShowingFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const mounted = useRef(false);

  const refresh = useCallback(async (initial = false) => {
    const request = ++sequence.current;
    if (initial) setLoading(true);
    try {
      const rows = await listPublishedShowingFeedback(transactionId);
      if (!mounted.current || request !== sequence.current) return;
      setItems(rows);
      setError(null);
    } catch (failure) {
      if (!mounted.current || request !== sequence.current) return;
      // Fail closed: a lost account permission or withdrawn publication must
      // never leave an old summary in this in-app list.
      setItems([]);
      setError(showingFeedbackError(failure));
    } finally {
      if (mounted.current && request === sequence.current) setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void refresh(true), 0);
    const revalidate = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      mounted.current = false;
      sequence.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [refresh]);

  return <section aria-label="Approved showing feedback" className="mt-5 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Showing feedback</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Summaries appear after brokerage approval.</p></div>
      <button type="button" onClick={() => void refresh()} className="min-h-10 text-sm font-semibold text-primarycolor-text underline">Refresh feedback</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <p role="status" className="text-sm text-zinc-600">Loading showing feedback…</p>
      : items.length === 0 ? <p className="text-sm text-zinc-600">No approved showing feedback is available yet.</p>
        : <div className="space-y-3">{items.map((item) => <article key={item.id} id={`feedback-${item.id}`} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">Showing · {dateTime(item.showing_at)}</h4>
            <span className="rounded-full bg-primarycolor/10 px-2.5 py-1 text-xs font-semibold text-primarycolor-text">Approved summary</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">{item.summary}</p>
          <p className="mt-2 text-xs text-zinc-500">Published {dateTime(item.published_at)}</p>
        </article>)}</div>}
  </section>;
}
