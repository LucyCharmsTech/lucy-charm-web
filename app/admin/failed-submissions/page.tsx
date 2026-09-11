'use client';

import { useEffect, useState } from 'react';
import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  dismissLog,
  fetchFailedContactSubmissions,
} from '@/services/systemLogService';
import type { SystemLog } from '@/types/api';

/**
 * Contact submissions that failed to save — controls 2.10 and 5.10.
 *
 * *"Create an idempotent CRM request, return a reference/confirmation, retry
 * temporary delivery failures and **alert staff when recovery fails**."*
 *
 * The endpoint answers 503 and records the attempt so nothing is silently
 * lost. This is where a person sees it. Without the screen the record existed
 * and nobody knew — which is the same silent lead loss 2.10 is about, moved
 * one step later.
 *
 * Everything here is deliberately actionable: enough contact detail to honour
 * the enquiry by hand, and a way to mark it dealt with.
 */

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** `log_data` is a free-shaped JSON column; read it defensively. */
function field(log: SystemLog, key: string): string | null {
  const value = log.log_data?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export default function FailedSubmissionsPage() {
  const [rows, setRows] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFailedContactSubmissions()
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          getApiErrorMessage(err, 'Could not load the failed-submission queue.'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function dismiss(log: SystemLog) {
    setDismissing(log.id);
    try {
      await dismissLog(log.id);
      setRows((prev) => prev.filter((r) => r.id !== log.id));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not dismiss that record.'));
    } finally {
      setDismissing(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
            Failed contact submissions
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Enquiries that could not be saved. The sender was told to try again,
            so each of these is someone who tried to reach us and may not have
            come back.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <RefreshCwIcon className="size-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {rows.length > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangleIcon className="size-4" aria-hidden="true" />
          {rows.length} {rows.length === 1 ? 'enquiry needs' : 'enquiries need'} following up by hand
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-xl bg-emerald-50 p-6 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Nothing to follow up. Every contact submission has saved successfully.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((log) => {
            const name = [field(log, 'first_name'), field(log, 'last_name')]
              .filter(Boolean)
              .join(' ');
            const email = field(log, 'email');
            const phone = field(log, 'phone');
            const topic = field(log, 'topic');
            return (
              <li
                key={log.id}
                className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {name || 'Name not recorded'}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="text-primarycolor-text hover:underline"
                        >
                          {email}
                        </a>
                      ) : (
                        'No email recorded'
                      )}
                      {phone ? ` · ${phone}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {topic ? `${topic} · ` : ''}
                      failed {formatWhen(log.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void dismiss(log)}
                    disabled={dismissing === log.id}
                    className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    {dismissing === log.id ? 'Dismissing…' : 'Mark handled'}
                  </button>
                </div>
                {/*
                  The message body is deliberately not stored — only its length,
                  to keep free-text out of the log store. Staff have to ask.
                */}
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  The message itself was not kept. Contact them and ask what
                  they needed.
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
