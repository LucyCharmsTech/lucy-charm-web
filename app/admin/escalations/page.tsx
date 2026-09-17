'use client';

import { useEffect, useState } from 'react';
import { AlertTriangleIcon, LoaderIcon, RefreshCwIcon } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  ESCALATION_STATUSES,
  ESCALATION_STATUS_LABELS,
  escalationReasonLabel,
  fetchEscalationConversation,
  fetchEscalations,
  updateEscalationStatus,
} from '@/services/escalationService';
import type { AiEscalation, AiMessage, EscalationStatus } from '@/types/api';

/**
 * Staff AI escalation queue — control 4.17.
 *
 * *"Authorized staff can review flagged conversations, feedback,
 * source/version context and failed actions without exposing internal content
 * to clients."*
 *
 * The backend for this was complete: seven endpoints, and the chat service has
 * been **raising escalations all along**. There was simply no screen, so they
 * accumulated unread — every one of them a moment where Lucy handed a
 * regulated question to a human who never saw it.
 *
 * Open ones first, because an unread escalation is the failure this fixes.
 */

const PAGE_SIZE = 20;

/** Still needing someone. Resolved and closed are done. */
const OPEN_STATUSES: EscalationStatus[] = ['pending', 'assigned', 'in_progress'];

const STATUS_TONE: Record<EscalationStatus, string> = {
  pending: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  assigned: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function EscalationsPage() {
  const [rows, setRows] = useState<AiEscalation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<AiEscalation | null>(null);

  // `reloadKey` rather than calling `load()` from a handler: the effect owns
  // the fetch, so Refresh and a page change take the same path and there is
  // no synchronous setState inside an effect.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    // No synchronous setState here — `loading` starts true and the handlers
    // below set it when they trigger a refetch, so the effect only ever
    // resolves it.
    fetchEscalations(page, PAGE_SIZE)
      .then((data) => {
        if (!active) return;
        setRows(data.items);
        setTotal(data.total);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(getApiErrorMessage(err, 'Could not load the escalation queue.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, reloadKey]);

  const visible = showResolved
    ? rows
    : rows.filter((row) => OPEN_STATUSES.includes(row.status));
  const openCount = rows.filter((row) => OPEN_STATUSES.includes(row.status)).length;

  async function changeStatus(row: AiEscalation, status: EscalationStatus) {
    try {
      const updated = await updateEscalationStatus(row.id, status);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      if (selected?.id === row.id) setSelected(updated);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not update that escalation.'));
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
            AI escalations
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Conversations Lucy handed to a person. Every one is a question a
            licensed representative has to answer.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            Show resolved and closed
          </label>
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
      </div>

      {openCount > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangleIcon className="size-4" aria-hidden="true" />
          {openCount} still open on this page
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
      ) : visible.length === 0 ? (
        <p className="mt-8 rounded-xl bg-zinc-50 p-6 text-sm text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300">
          {showResolved
            ? 'No escalations yet.'
            : 'Nothing open. Tick "Show resolved and closed" to see the history.'}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3">Raised</th>
                <th scope="col" className="px-4 py-3">Why</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Assigned</th>
                <th scope="col" className="px-4 py-3">Conversation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatWhen(row.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {escalationReasonLabel(row.reason)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        void changeStatus(row, e.target.value as EscalationStatus)
                      }
                      aria-label={`Status for the ${escalationReasonLabel(row.reason)} escalation`}
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_TONE[row.status]}`}
                    >
                      {ESCALATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ESCALATION_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.assigned_agent_id ? (
                      `${row.assigned_agent_id.slice(0, 8)}…`
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="font-semibold text-primarycolor-text hover:underline"
                    >
                      Read
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            type="button"
            disabled={page === 1 || loading}
            onClick={() => {
              setLoading(true);
              setPage((p) => p - 1);
            }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-50 dark:border-zinc-700"
          >
            Previous
          </button>
          <span className="text-zinc-600 dark:text-zinc-400">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
            onClick={() => {
              setLoading(true);
              setPage((p) => p + 1);
            }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-50 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
      )}

      {selected && (
        <ConversationPanel
          escalation={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

/**
 * The flagged conversation, with 4.17's "source/version context" — which
 * instruction set and responder produced each reply, so a staff member
 * reviewing a bad answer can tell whether it came from the model or from a
 * deterministic backend responder.
 */
function ConversationPanel({
  escalation,
  onClose,
}: {
  escalation: AiEscalation;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AiMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchEscalationConversation(escalation.session_id)
      .then((rows) => {
        if (active) setMessages(rows);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(getApiErrorMessage(err, 'Could not load that conversation.'));
        }
      });
    return () => {
      active = false;
    };
  }, [escalation.session_id]);

  return (
    <section
      className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40"
      aria-label="Escalated conversation"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {escalationReasonLabel(escalation.reason)}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Raised {formatWhen(escalation.created_at)} · session{' '}
            <span className="font-mono">{escalation.session_id.slice(0, 8)}…</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Close
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {messages === null && !error ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-500">
          <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          Loading the conversation…
        </p>
      ) : null}

      {messages && messages.length === 0 && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          This session has no stored messages.
        </p>
      )}

      {messages && messages.length > 0 && (
        <ol className="mt-5 space-y-4">
          {messages.map((message) => (
            <li
              key={message.id}
              className={
                message.role === 'assistant'
                  ? 'rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/40'
                  : 'rounded-xl border border-zinc-200 p-4 dark:border-zinc-700'
              }
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {message.role === 'assistant' ? 'Lucy' : 'Client'}
                {message.escalation_flag && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    flagged
                  </span>
                )}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {message.message_text}
              </p>
              {/* 4.17's source/version context. */}
              {message.role === 'assistant' && (
                <p className="mt-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  {message.model_version ?? 'model unrecorded'}
                  {message.prompt_version ? ` · prompt ${message.prompt_version}` : ''}
                  {message.confidence_score !== null
                    ? ` · confidence ${message.confidence_score.toFixed(2)}`
                    : ''}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
