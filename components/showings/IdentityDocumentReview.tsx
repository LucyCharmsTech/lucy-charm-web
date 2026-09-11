'use client';

import { useEffect, useState } from 'react';
import { ExternalLinkIcon, LoaderIcon, ShieldCheckIcon } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  fetchIdentityDocuments,
  openIdentityDocument,
  reviewIdentityDocument,
} from '@/services/identityDocumentService';
import type { ShowingIdentityDocument } from '@/types/api';

/**
 * Staff review of a client's identity document.
 *
 * The counterpart to `IdentityDocumentUpload`. Both existed as API and
 * neither had a screen, so a document a client uploaded sat unreviewed and the
 * showing stayed blocked.
 *
 * Two deliberate constraints, because this is someone's identity document:
 *
 * **Nothing is rendered inline.** No thumbnail, no preview. The file opens in
 * a new tab only when a reviewer explicitly asks, so an ID is never sitting on
 * a screen behind a staff member in an office.
 *
 * **Opening is recorded.** The server stamps `viewed_at` and
 * `viewed_by_user_id` on the download route, and this component shows that a
 * document has been opened — so a reviewer knows the look is on the record.
 */

type IdentityDocumentReviewProps = {
  showingRequestId: string;
  onReviewed?: () => void;
};

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IdentityDocumentReview({
  showingRequestId,
  onReviewed,
}: IdentityDocumentReviewProps) {
  const [documents, setDocuments] = useState<ShowingIdentityDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchIdentityDocuments(showingRequestId)
      .then((rows) => {
        if (active) {
          setDocuments(rows);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(getApiErrorMessage(err, 'Could not load the ID documents.'));
          setDocuments([]);
        }
      });
    return () => {
      active = false;
    };
  }, [showingRequestId, reloadKey]);

  async function open(doc: ShowingIdentityDocument) {
    setBusy(doc.id);
    setError(null);
    try {
      await openIdentityDocument(showingRequestId, doc.id);
      // Re-read so the "opened" marker reflects the audit stamp just written.
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not open that document.'));
    } finally {
      setBusy(null);
    }
  }

  async function decide(doc: ShowingIdentityDocument, status: 'verified' | 'rejected') {
    setBusy(doc.id);
    setError(null);
    try {
      await reviewIdentityDocument(showingRequestId, doc.id, {
        status,
        review_note: note.trim() || null,
      });
      setNote('');
      setReloadKey((k) => k + 1);
      onReviewed?.();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not save that decision.'));
    } finally {
      setBusy(null);
    }
  }

  if (documents === null) {
    return (
      <p className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-500">
        <LoaderIcon className="size-3.5 animate-spin" aria-hidden="true" />
        Loading ID documents…
      </p>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        No ID uploaded yet.
      </p>
    );
  }

  return (
    <section
      className="mt-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
      aria-label="Identity document review"
    >
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <ShieldCheckIcon className="size-4" aria-hidden="true" />
        Identity documents
      </h3>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <ul className="mt-3 space-y-3">
        {documents.map((doc) => {
          const pending = doc.status === 'uploaded';
          return (
            <li
              key={doc.id}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {doc.original_filename}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {formatSize(doc.size_bytes)} · uploaded{' '}
                    {new Date(doc.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs font-semibold capitalize text-zinc-700 dark:text-zinc-300">
                    {doc.status}
                    {doc.viewed_at && (
                      <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                        opened {new Date(doc.viewed_at).toLocaleString()}
                      </span>
                    )}
                  </p>
                  {doc.review_note && (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Note: {doc.review_note}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void open(doc)}
                  disabled={busy !== null}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                  Open
                </button>
              </div>

              {pending && (
                <div className="mt-3 space-y-2">
                  <label
                    htmlFor={`id-note-${doc.id}`}
                    className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  >
                    Note (optional)
                  </label>
                  <input
                    id={`id-note-${doc.id}`}
                    type="text"
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why, if rejecting"
                    className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void decide(doc, 'verified')}
                      disabled={busy !== null}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(doc, 'rejected')}
                      disabled={busy !== null}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
