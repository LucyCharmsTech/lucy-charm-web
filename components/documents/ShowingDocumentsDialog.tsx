'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DownloadIcon,
  EyeIcon,
  HistoryIcon,
  LockIcon,
  PlusIcon,
  ShieldAlertIcon,
} from 'lucide-react';

import DocumentHistoryList from '@/components/documents/DocumentHistoryList';
import DocumentPreviewDialog from '@/components/documents/DocumentPreviewDialog';
import DocumentStatusBadge from '@/components/documents/DocumentStatusBadge';
import { IdentityDocumentReview } from '@/components/showings/IdentityDocumentReview';
import {
  DOCUMENT_CATEGORY_LABELS,
  DocumentError,
  documentErrorMessage,
  downloadDocumentFile,
  fetchDocuments,
  formatBytes,
  isDocumentOverdue,
  isHistoryDocument,
  isStaffDocument,
  markDocumentMissing,
  requestDocument,
  reviewDocument,
} from '@/services/documentService';
import type {
  AppDocument,
  DocumentCategory,
  DocumentReviewOutcome,
  ShowingRequest,
} from '@/types/api';

const REVIEWABLE = new Set(['uploaded', 'under_review']);

/**
 * The staff (agent/admin) side of the document centre for one showing request:
 * list, preview, review with the three outcomes, request a document, and mark
 * an outstanding request missing.
 */
export default function ShowingDocumentsDialog({
  request,
  open,
  onClose,
  onChanged,
}: {
  request: ShowingRequest | null;
  open: boolean;
  onClose: () => void;
  /** Fired after any change that may affect the showings list (e.g. ID verified). */
  onChanged?: () => void;
}) {
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<AppDocument | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestId = request?.id ?? null;

  const load = useCallback(async () => {
    if (!requestId) return;
    setError(null);
    try {
      setDocuments(await fetchDocuments('showing_request', requestId));
    } catch (err: unknown) {
      setError(
        err instanceof DocumentError ? documentErrorMessage(err) : 'Could not load documents.',
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!open || !requestId) return;
    setDocuments([]);
    setLoading(true);
    setNotice(null);
    setViewedIds(new Set());
    setReviewId(null);
    setHistoryId(null);
    setRequestFormOpen(false);
    void load();
  }, [open, requestId, load]);

  if (!open || !request) return null;
  const activeRequest = request;

  function markViewed(id: string) {
    setViewedIds((prev) => new Set(prev).add(id));
  }

  async function handleDownload(doc: AppDocument) {
    setError(null);
    try {
      await downloadDocumentFile(doc.id);
      markViewed(doc.id);
    } catch (err: unknown) {
      setError(
        err instanceof DocumentError ? documentErrorMessage(err) : 'Download failed. Try again.',
      );
    }
  }

  async function handleReview(
    doc: AppDocument,
    outcome: DocumentReviewOutcome,
    clientReason: string,
    reviewNote: string,
  ) {
    setBusy(true);
    setError(null);
    try {
      // Reviewing an identity document also updates the showing request's
      // id_verification_status server-side, so `onChanged` picks the badge up.
      await reviewDocument(doc.id, {
        outcome,
        client_reason: clientReason.trim() || null,
        review_note: reviewNote.trim() || null,
      });
      setReviewId(null);
      setNotice('Review saved. The client has been notified.');
      await load();
      onChanged?.();
    } catch (err: unknown) {
      if (err instanceof DocumentError && err.code === 'conflict') {
        // The client replaced the file while this review was open. Stale view —
        // refetch and say so rather than surfacing a raw 409.
        setNotice('This document was replaced while you were reviewing. Showing the newest version.');
        setReviewId(null);
        await load();
      } else {
        setError(
          err instanceof DocumentError ? documentErrorMessage(err) : 'Could not save the review.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkMissing(doc: AppDocument) {
    setBusy(true);
    setError(null);
    try {
      await markDocumentMissing(doc.id);
      setNotice('Marked as missing. A late upload will still be accepted.');
      await load();
    } catch (err: unknown) {
      setError(
        err instanceof DocumentError ? documentErrorMessage(err) : 'Could not update the request.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRequest(category: DocumentCategory, description: string, dueDate: string) {
    setBusy(true);
    setError(null);
    try {
      await requestDocument({
        resource_type: 'showing_request',
        resource_id: activeRequest.id,
        category,
        description: description.trim() || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });
      setRequestFormOpen(false);
      setNotice('Request sent. The client will see it in their document centre.');
      await load();
    } catch (err: unknown) {
      if (err instanceof DocumentError && err.code === 'conflict') {
        setError('This requester has no client account, so there is nobody to send the request to.');
      } else {
        setError(
          err instanceof DocumentError ? documentErrorMessage(err) : 'Could not send the request.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  const visibleDocs = documents.filter((doc) => !isHistoryDocument(doc));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="showing-documents-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="showing-documents-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Documents
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {activeRequest.first_name} {activeRequest.last_name} · showing on{' '}
              {new Date(activeRequest.scheduled_at ?? activeRequest.preferred_date).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setRequestFormOpen((v) => !v)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primarycolor px-3 text-xs font-semibold text-primarycolor-foreground transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:opacity-50"
          >
            <PlusIcon className="size-3.5" aria-hidden="true" />
            Request a document
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
            {notice}
          </p>
        )}

        {activeRequest.id_verification_requested && (
          <IdentityDocumentReview showingRequestId={activeRequest.id} />
        )}

        {requestFormOpen && (
          <RequestDocumentForm busy={busy} onSubmit={handleRequest} onCancel={() => setRequestFormOpen(false)} />
        )}

        <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading documents…</p>
          ) : visibleDocs.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No documents yet. Use “Request a document” to ask the client for one.
            </p>
          ) : (
            visibleDocs.map((doc) => {
              const hasFile = doc.original_filename !== null;
              const viewed = viewedIds.has(doc.id);
              const staffDoc = isStaffDocument(doc) ? doc : null;
              return (
                <div key={doc.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {doc.description ?? DOCUMENT_CATEGORY_LABELS[doc.category]}
                    </p>
                    <DocumentStatusBadge status={doc.status} overdue={isDocumentOverdue(doc)} staff />
                  </div>

                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {hasFile
                      ? `${doc.original_filename}${doc.size_bytes !== null ? ` · ${formatBytes(doc.size_bytes)}` : ''} · v${doc.version}`
                      : 'Nothing uploaded yet.'}
                    {doc.due_date && doc.status === 'requested'
                      ? ` · Preferred by ${new Date(doc.due_date).toLocaleDateString()}`
                      : ''}
                    {doc.expires_at
                      ? ` · Valid until ${new Date(doc.expires_at).toLocaleDateString()}`
                      : ''}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {staffDoc?.visibility === 'internal_only' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        <LockIcon className="size-3" aria-hidden="true" />
                        Internal — not visible to the client
                      </span>
                    )}
                    {staffDoc?.scan_status === 'infected' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-300">
                        <ShieldAlertIcon className="size-3" aria-hidden="true" />
                        Blocked by security scan
                      </span>
                    )}
                  </div>

                  {doc.client_reason && (
                    <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                      Reason shared with the client: “{doc.client_reason}”
                    </p>
                  )}
                  {staffDoc?.review_note && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <LockIcon className="size-3 shrink-0" aria-hidden="true" />
                      Internal note: {staffDoc.review_note}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {hasFile && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewDoc(doc);
                            markViewed(doc.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primarycolor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                        >
                          <EyeIcon className="size-3.5" aria-hidden="true" />
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDownload(doc)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primarycolor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                        >
                          <DownloadIcon className="size-3.5" aria-hidden="true" />
                          Download
                        </button>
                      </>
                    )}
                    {REVIEWABLE.has(doc.status) && (
                      <button
                        type="button"
                        disabled={busy || !viewed}
                        onClick={() => setReviewId((id) => (id === doc.id ? null : doc.id))}
                        title={viewed ? 'Review this document' : 'Open the document before reviewing it'}
                        className="text-xs font-semibold text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-emerald-400"
                      >
                        {reviewId === doc.id ? 'Close review' : 'Review'}
                      </button>
                    )}
                    {doc.status === 'requested' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleMarkMissing(doc)}
                        className="text-xs font-semibold text-red-600 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-red-400"
                      >
                        Mark missing
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setHistoryId((id) => (id === doc.id ? null : doc.id))}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
                    >
                      <HistoryIcon className="size-3.5" aria-hidden="true" />
                      {historyId === doc.id ? 'Close history' : 'Show history'}
                    </button>
                  </div>

                  {REVIEWABLE.has(doc.status) && !viewed && hasFile && (
                    <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-500">
                      Open the document first — Review stays disabled until you view it.
                    </p>
                  )}

                  {reviewId === doc.id && (
                    <ReviewPanel
                      busy={busy}
                      onSubmit={(outcome, clientReason, reviewNote) =>
                        void handleReview(doc, outcome, clientReason, reviewNote)
                      }
                    />
                  )}

                  {historyId === doc.id && (
                    <div className="mt-3">
                      <DocumentHistoryList documentId={doc.id} staff />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
          >
            Close
          </button>
        </div>
      </div>

      {previewDoc && (
        <DocumentPreviewDialog
          documentId={previewDoc.id}
          filename={previewDoc.original_filename}
          open
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

function RequestDocumentForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (category: DocumentCategory, description: string, dueDate: string) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<DocumentCategory>('identity');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="mt-3 space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-950/40"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(category, description, dueDate);
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Document type
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as DocumentCategory)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-normal text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {/* Advisory only — nothing is enforced when it passes, so never say "deadline". */}
          Preferred by (optional)
          <input
            type="date"
            min={today}
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-normal text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
      </div>
      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        Note to the client (optional)
        <input
          type="text"
          maxLength={1000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. A photo of your government-issued ID"
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-normal text-zinc-800 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <span className="mt-0.5 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
          The client reads this word for word — keep it plain.
        </span>
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-primarycolor px-3 py-1.5 text-xs font-semibold text-primarycolor-foreground transition hover:bg-primarycolor/90 disabled:opacity-50"
        >
          Send request
        </button>
      </div>
    </form>
  );
}

function ReviewPanel({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (outcome: DocumentReviewOutcome, clientReason: string, reviewNote: string) => void;
}) {
  const [outcome, setOutcome] = useState<DocumentReviewOutcome>('accepted');
  const [clientReason, setClientReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const reasonRequired = outcome !== 'accepted';
  const canSubmit = !reasonRequired || clientReason.trim().length > 0;

  const OUTCOMES: Array<{ value: DocumentReviewOutcome; label: string; hint: string }> = [
    { value: 'accepted', label: 'Accept', hint: 'The document is good to use.' },
    { value: 'rejected', label: 'Reject', hint: 'Not acceptable — the client must send something else.' },
    {
      value: 'replacement_needed',
      label: 'Ask for a new copy',
      hint: 'Legitimate, but unusable — blurry, cropped, out of date.',
    },
  ];

  return (
    <form
      className="mt-3 space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-950/40"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(outcome, clientReason, reviewNote);
      }}
    >
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Outcome</legend>
        {OUTCOMES.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <input
              type="radio"
              name="review-outcome"
              value={option.value}
              checked={outcome === option.value}
              onChange={() => setOutcome(option.value)}
              className="mt-0.5"
            />
            <span>
              <span className="font-semibold">{option.label}</span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* The two text fields are deliberately styled apart: one is read by the
          client, the other must never reach them. */}
      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        Reason — the client will read this{reasonRequired ? '' : ' (optional)'}
        <textarea
          required={reasonRequired}
          maxLength={1000}
          rows={2}
          value={clientReason}
          onChange={(event) => setClientReason(event.target.value)}
          placeholder="Write it for them: say what to do differently."
          className="mt-1 block w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-normal text-zinc-800 placeholder:text-zinc-400 dark:border-amber-700/60 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        <span className="inline-flex items-center gap-1">
          <LockIcon className="size-3" aria-hidden="true" />
          Internal note — the client never sees this (optional)
        </span>
        <textarea
          maxLength={2000}
          rows={2}
          value={reviewNote}
          onChange={(event) => setReviewNote(event.target.value)}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-xs font-normal text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="rounded-lg bg-primarycolor px-3 py-1.5 text-xs font-semibold text-primarycolor-foreground transition hover:bg-primarycolor/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Submit review'}
        </button>
      </div>
    </form>
  );
}
