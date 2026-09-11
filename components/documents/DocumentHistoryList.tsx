'use client';

import { useEffect, useState } from 'react';
import { DownloadIcon } from 'lucide-react';

import DocumentStatusBadge from '@/components/documents/DocumentStatusBadge';
import {
  DocumentError,
  documentErrorMessage,
  downloadDocumentFile,
  fetchDocumentHistory,
} from '@/services/documentService';
import type { DocumentHistory } from '@/types/api';

/**
 * The version chain for one document, newest first. The client was promised
 * sight of the file that was rejected and the reason — both stay reachable
 * here. `history.audit` is populated for staff and empty for clients.
 */
export default function DocumentHistoryList({
  documentId,
  staff = false,
}: {
  documentId: string;
  staff?: boolean;
}) {
  const [history, setHistory] = useState<DocumentHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setHistory(null);
    setError(null);
    fetchDocumentHistory(documentId)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof DocumentError ? documentErrorMessage(err) : 'Could not load the history.',
        );
      });
    return () => {
      active = false;
    };
  }, [documentId]);

  async function handleDownload(id: string) {
    setError(null);
    try {
      await downloadDocumentFile(id);
    } catch (err: unknown) {
      setError(
        err instanceof DocumentError ? documentErrorMessage(err) : 'Download failed. Try again.',
      );
    }
  }

  if (error) {
    return (
      <p className="text-xs text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    );
  }
  if (!history) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading history…</p>;
  }

  const versions = [...history.versions].reverse(); // API is oldest-first

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {versions.map((version) => (
          <li
            key={version.id}
            className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-700/80"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Version {version.version}
                {version.original_filename ? ` · ${version.original_filename}` : ''}
              </p>
              <DocumentStatusBadge status={version.status} staff={staff} />
            </div>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Uploaded {new Date(version.created_at).toLocaleString()}
              {version.reviewed_at
                ? ` · Reviewed ${new Date(version.reviewed_at).toLocaleString()}`
                : ''}
            </p>
            {version.client_reason && (
              <blockquote className="mt-1.5 border-l-2 border-amber-300 pl-2 text-xs text-zinc-600 dark:border-amber-700 dark:text-zinc-300">
                {version.client_reason}
              </blockquote>
            )}
            {version.original_filename && (
              <button
                type="button"
                onClick={() => void handleDownload(version.id)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primarycolor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                <DownloadIcon className="size-3" aria-hidden="true" />
                Download
              </button>
            )}
          </li>
        ))}
      </ol>

      {staff && history.audit.length > 0 && (
        <details className="rounded-lg border border-zinc-200/80 p-2.5 dark:border-zinc-700/80">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Audit trail ({history.audit.length})
          </summary>
          <ol className="mt-2 space-y-1">
            {history.audit.map((entry) => (
              <li key={entry.id} className="text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {entry.action}
                </span>
                {entry.document_status ? ` → ${entry.document_status}` : ''} ·{' '}
                {new Date(entry.created_at).toLocaleString()}
                {entry.actor_user_id === null ? ' · system' : ''}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
