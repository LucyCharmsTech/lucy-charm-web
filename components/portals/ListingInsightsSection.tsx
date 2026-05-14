'use client';

import { useCallback, useEffect, useState } from 'react';
import ChatSummaryModal from '@/components/portals/ChatSummaryModal';
import { fetchClientIntentsForListing } from '@/services/portalService';
import type { ClientIntentListResponse } from '@/types/api';

type Props = {
  listingId: string;
};

/**
 * Client-side panel: loads `/agents/me/listings/{id}/client_intents` for agents
 * and superadmins (backend authorises both).
 */
export default function ListingInsightsSection({ listingId }: Props) {
  const [data, setData] = useState<ClientIntentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryModal, setSummaryModal] = useState<{
    clientDisplayName: string;
    summaryText: string;
  } | null>(null);

  const closeSummaryModal = useCallback(() => setSummaryModal(null), []);

  useEffect(() => {
    let cancelled = false;
    setSummaryModal(null);
    setLoading(true);
    fetchClientIntentsForListing(listingId)
      .then((res) => {
        if (!cancelled) {
          setError(null);
          setData(res);
        }
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Could not load client intents.';
        if (!cancelled) setError(String(msg));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
        Loading client activity…
      </p>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No recorded client intents for this listing yet. Activity appears when buyers chat while
        logged in.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Clients and detected intents for this listing</caption>
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-4 py-3">
              Client
            </th>
            <th scope="col" className="px-4 py-3">
              Intent
            </th>
            <th scope="col" className="px-4 py-3">
              Confidence
            </th>
            <th scope="col" className="px-4 py-3">
              Last update
            </th>
            <th scope="col" className="px-4 py-3">
              Chat summary
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {data.items.map((row) => (
            <tr key={`${row.session_id}-${row.user_id}`} className="bg-white dark:bg-zinc-950/40">
              <td className="px-4 py-3">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {row.first_name} {row.last_name}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{row.email}</div>
              </td>
              <td className="px-4 py-3 font-medium capitalize text-primarycolor">{row.current_intent}</td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                {(row.confidence * 100).toFixed(0)}%
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-300">
                {new Date(row.intent_last_seen).toLocaleString()}
              </td>
              <td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-300">
                {row.latest_summary ? (
                  <button
                    type="button"
                    className="w-full rounded-lg p-1 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:bg-zinc-950/80"
                    onClick={() =>
                      setSummaryModal({
                        clientDisplayName: `${row.first_name} ${row.last_name}`.trim(),
                        summaryText: row.latest_summary!,
                      })
                    }
                    aria-label={`View full chat summary for ${row.first_name} ${row.last_name}`}
                  >
                    <span className="line-clamp-4">{row.latest_summary}</span>
                    <span className="mt-1.5 block text-xs font-semibold text-primarycolor">
                      View full summary
                    </span>
                  </button>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Chat summaries come from the buyer&apos;s saved thread with the assistant. If you see a dash,
        that session may not have stored a summary yet (for example, older chats before summaries were
        enabled); another message in the thread usually creates one.
      </p>
      </div>
      <ChatSummaryModal
      open={summaryModal !== null}
      clientDisplayName={summaryModal?.clientDisplayName ?? ''}
      summaryText={summaryModal?.summaryText ?? ''}
        onClose={closeSummaryModal}
      />
    </>
  );
}
