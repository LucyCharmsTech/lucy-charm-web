'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  MessageCircleIcon,
} from 'lucide-react';
import {
  downloadChatLogsCsv,
  fetchAiMessagesAdmin,
  fetchAiMessagesBySession,
  fetchAiSessionsAdmin,
} from '@/services/superadminService';
import type { AiMessageRecord, AiSession, ApiPaginated } from '@/types/api';

const SESSION_PAGE_SIZE = 20;
const MESSAGE_PAGE_SIZE = 35;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SourceDataPanel({ msg }: { msg: AiMessageRecord }) {
  const src = msg.source_data;
  if (!src) return null;

  const fields: string[] | undefined = Array.isArray(src.listing_fields_used)
    ? (src.listing_fields_used as string[])
    : undefined;
  const provider = typeof src.provider === 'string' ? src.provider : null;
  const model = typeof src.model === 'string' ? src.model : null;

  if (!fields && !provider && !model) return null;

  return (
    <div className="mt-2 space-y-1 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-900/60">
      {fields && (
        <p className="text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">MLS fields used: </span>
          {fields.join(', ')}
        </p>
      )}
      {(provider || model) && (
        <p className="text-zinc-500 dark:text-zinc-500">
          {provider && <span>{provider}</span>}
          {provider && model && <span> · </span>}
          {model && <span>{model}</span>}
        </p>
      )}
    </div>
  );
}

function EscalationBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      <AlertTriangleIcon className="size-3" aria-hidden="true" />
      Escalation
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminChatLogsPage() {
  const [sessions, setSessions] = useState<ApiPaginated<AiSession> | null>(null);
  const [sessionPage, setSessionPage] = useState(1);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [thread, setThread] = useState<AiMessageRecord[] | null>(null);
  const [flatMessages, setFlatMessages] = useState<ApiPaginated<AiMessageRecord> | null>(null);
  const [flatPage, setFlatPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingFlat, setLoadingFlat] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadSessions = useCallback(async (p: number) => {
    setLoadingSessions(true);
    try {
      const res = await fetchAiSessionsAdmin(p, SESSION_PAGE_SIZE);
      setSessions(res);
      setError(null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not load chat sessions.';
      setError(String(msg));
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const loadFlat = useCallback(async (p: number) => {
    setLoadingFlat(true);
    try {
      const res = await fetchAiMessagesAdmin(p, MESSAGE_PAGE_SIZE);
      setFlatMessages(res);
      setError(null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not load messages.';
      setError(String(msg));
    } finally {
      setLoadingFlat(false);
    }
  }, []);

  useEffect(() => { loadSessions(sessionPage); }, [loadSessions, sessionPage]);
  useEffect(() => { loadFlat(flatPage); }, [loadFlat, flatPage]);

  useEffect(() => {
    if (!selectedSessionId) { setThread(null); return; }
    let cancelled = false;
    setLoadingThread(true);
    fetchAiMessagesBySession(selectedSessionId)
      .then((msgs) => {
        if (!cancelled) {
          setThread(
            msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
          );
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const msg =
            (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
            'Could not load messages for this session.';
          setError(String(msg));
        }
      })
      .finally(() => { if (!cancelled) setLoadingThread(false); });
    return () => { cancelled = true; };
  }, [selectedSessionId]);

  async function handleExport(sessionId?: string) {
    setExporting(true);
    setError(null);
    try {
      await downloadChatLogsCsv(sessionId);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  const sessionTotalPages =
    sessions && sessions.total > 0 ? Math.max(1, Math.ceil(sessions.total / sessions.page_size)) : 1;
  const flatTotalPages =
    flatMessages && flatMessages.total > 0 ? Math.max(1, Math.ceil(flatMessages.total / flatMessages.page_size)) : 1;

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            AI chat logs
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Browse sessions, inspect threads, and export logs as CSV.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={() => handleExport()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          aria-label="Export all chat logs as CSV"
        >
          <DownloadIcon className="size-4" aria-hidden="true" />
          {exporting ? 'Exporting…' : 'Export all (CSV)'}
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {/* ── Sessions + Thread ── */}
      <section aria-labelledby="sessions-heading" className="space-y-4">
        <h2 id="sessions-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Sessions
        </h2>
        {loadingSessions && !sessions ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading sessions…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Session list */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  {sessions?.total ?? 0} sessions
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={sessionPage <= 1}
                    onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg p-1 text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                    aria-label="Previous sessions page"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={sessionPage >= sessionTotalPages}
                    onClick={() => setSessionPage((p) => p + 1)}
                    className="rounded-lg p-1 text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                    aria-label="Next sessions page"
                  >
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>
              </div>
              <ul
                className="max-h-[480px] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800"
                role="list"
              >
                {(sessions?.items ?? []).map((s) => {
                  const active = s.id === selectedSessionId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSessionId(s.id)}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primarycolor ${
                          active
                            ? 'bg-primarycolor/10 text-zinc-900 dark:bg-primarycolor/20 dark:text-zinc-50'
                            : 'bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900'
                        }`}
                      >
                        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {s.id.slice(0, 8)}…
                        </span>
                        <span className="text-xs text-zinc-600 dark:text-zinc-300">
                          {s.user_id ? `User ${s.user_id.slice(0, 8)}…` : 'Anonymous session'}
                        </span>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {new Date(s.created_at).toLocaleString()}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Thread panel */}
            <div
              className="flex min-h-[280px] flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40"
              aria-live="polite"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Thread
                  {selectedSessionId && (
                    <span className="ml-2 font-mono font-normal normal-case">
                      {selectedSessionId.slice(0, 8)}…
                    </span>
                  )}
                </h3>
                {selectedSessionId && (
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExport(selectedSessionId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                    aria-label="Export this session as CSV"
                  >
                    <DownloadIcon className="size-3.5" aria-hidden="true" />
                    {exporting ? 'Exporting…' : 'Export CSV'}
                  </button>
                )}
              </div>

              {!selectedSessionId ? (
                <p className="flex flex-1 items-center justify-center p-6 text-sm text-zinc-500 dark:text-zinc-400">
                  Select a session to load messages.
                </p>
              ) : loadingThread ? (
                <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">Loading messages…</p>
              ) : !thread || thread.length === 0 ? (
                <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                  No messages in this session.
                </p>
              ) : (
                <ul className="max-h-[480px] space-y-3 overflow-y-auto p-3" role="list">
                  {thread.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-xl border px-3 py-2.5 text-sm ${
                        m.role === 'user'
                          ? 'ml-4 border-primarycolor/30 bg-primarycolor/5 dark:bg-primarycolor/10'
                          : 'mr-4 border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80'
                      }`}
                    >
                      {/* Row: role + badges */}
                      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <MessageCircleIcon className="size-3.5" aria-hidden="true" />
                        {m.role}
                        {m.escalation_flag && <EscalationBadge />}
                      </div>

                      {/* Metadata strip: timestamp, listing_id */}
                      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString()}</time>
                        {m.listing_id && (
                          <span>
                            Listing:{' '}
                            <Link
                              href={`/admin/listings/${m.listing_id}`}
                              className="font-mono text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primarycolor"
                            >
                              {m.listing_id.slice(0, 8)}…
                            </Link>
                          </span>
                        )}
                      </div>

                      {/* Message body */}
                      <p className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                        {m.message_text}
                      </p>

                      {/* MLS fields + model info (assistant messages only) */}
                      {m.role === 'assistant' && <SourceDataPanel msg={m} />}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Flat message table ── */}
      <section aria-labelledby="recent-messages-heading" className="space-y-4">
        <h2
          id="recent-messages-heading"
          className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
        >
          Recent messages (all sessions)
        </h2>
        {loadingFlat && !flatMessages ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {flatMessages?.total ?? 0} messages
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={flatPage <= 1}
                  onClick={() => setFlatPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                >
                  <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
                  Prev
                </button>
                <span className="text-xs text-zinc-500">
                  {flatPage} / {flatTotalPages}
                </span>
                <button
                  type="button"
                  disabled={flatPage >= flatTotalPages}
                  onClick={() => setFlatPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                >
                  Next
                  <ChevronRightIcon className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th scope="col" className="px-3 py-2">Time</th>
                    <th scope="col" className="px-3 py-2">Role</th>
                    <th scope="col" className="px-3 py-2">Session</th>
                    <th scope="col" className="px-3 py-2">Listing</th>
                    <th scope="col" className="px-3 py-2">Escalation</th>
                    <th scope="col" className="px-3 py-2">MLS fields used</th>
                    <th scope="col" className="px-3 py-2">Text</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(flatMessages?.items ?? []).map((m) => {
                    const srcFields = m.source_data?.listing_fields_used;
                    const fieldsLabel = Array.isArray(srcFields)
                      ? (srcFields as string[]).join(', ')
                      : null;
                    return (
                      <tr key={m.id} className="bg-white dark:bg-zinc-950/40">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <time dateTime={m.created_at}>
                            {new Date(m.created_at).toLocaleString()}
                          </time>
                        </td>
                        <td className="px-3 py-2 capitalize text-zinc-700 dark:text-zinc-300">
                          {m.role}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSessionId(m.session_id);
                              setSessionPage(1);
                            }}
                            className="text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                          >
                            {m.session_id.slice(0, 8)}…
                          </button>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {m.listing_id ? (
                            <Link
                              href={`/admin/listings/${m.listing_id}`}
                              className="text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                            >
                              {m.listing_id.slice(0, 8)}…
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {m.escalation_flag ? <EscalationBadge /> : (
                            <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {fieldsLabel ?? '—'}
                        </td>
                        <td className="max-w-xs px-3 py-2 text-zinc-800 dark:text-zinc-200">
                          <span className="block truncate" title={m.message_text}>
                            {m.message_text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
