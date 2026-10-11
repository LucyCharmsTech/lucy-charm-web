'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ShieldCheckIcon } from 'lucide-react';

import ClientDocumentCard from '@/components/documents/ClientDocumentCard';
import DocumentPreviewDialog from '@/components/documents/DocumentPreviewDialog';
import DocumentStatusBadge from '@/components/documents/DocumentStatusBadge';
import DocumentHistoryList from '@/components/documents/DocumentHistoryList';
import {
  DocumentError,
  documentErrorMessage,
  downloadVerifiedDocumentFile,
  fetchDocument,
  isStaffDocument,
  reviewDocument,
} from '@/services/documentService';
import type { AppDocument, DocumentReviewOutcome, StaffDocument } from '@/types/api';

/**
 * Deep-link target for document notifications (`deep_link: "/documents/<id>"`).
 * Notification copy is deliberately vague, so the client reads the actual
 * reason here. Authorized staff use the same protected document endpoint for
 * review; a 404 still covers both missing and inaccessible documents.
 */
export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const documentId = params?.id;

  const [doc, setDoc] = useState<AppDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    try {
      const fetched = await fetchDocument(documentId);
      setDoc(fetched);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof DocumentError ? documentErrorMessage(err) : 'Could not load the document.',
      );
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      {doc && isStaffDocument(doc) ? (
        <button type="button" onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primarycolor-text underline-offset-2 hover:underline">
          <ArrowLeftIcon className="size-4" aria-hidden="true" /> Back to work
        </button>
      ) : (
        <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primarycolor-text underline-offset-2 hover:underline">
          <ArrowLeftIcon className="size-4" aria-hidden="true" /> Back to profile
        </Link>
      )}

      <div className="mt-4 flex items-start gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 text-primarycolor-text" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Document</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {doc && isStaffDocument(doc)
              ? 'Review this document using the existing secure Document Centre workflow.'
              : 'Stored securely — only you, your agent, and our staff can open it.'}
          </p>
        </div>
      </div>

      {loading && <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>}

      {!loading && error && (
        <p
          className="mt-6 rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
          role="alert"
        >
          {error}
        </p>
      )}

      {actionError && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {actionError}
        </p>
      )}

      {!loading && doc && (
        <div className="mt-6 space-y-4">
          {isStaffDocument(doc) ? (
            <StaffDocumentReview key={doc.id} document={doc} onChanged={() => void load()} />
          ) : (
            <ClientDocumentCard
              document={doc}
              onChanged={() => {
                setActionError(null);
                void load();
              }}
              onError={setActionError}
            />
          )}
          <section>
            <h2 className="mb-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">History</h2>
            <DocumentHistoryList documentId={doc.id} staff={isStaffDocument(doc)} />
          </section>
        </div>
      )}
    </main>
  );
}

function StaffDocumentReview({ document: doc, onChanged }: { document: StaffDocument; onChanged: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewed, setViewed] = useState(false);
  const session = useRef(0);
  const [reviewSession, setReviewSession] = useState(0);
  const [outcome, setOutcome] = useState<DocumentReviewOutcome>('accepted');
  const [clientReason, setClientReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewable = (doc.status === 'uploaded' || doc.status === 'under_review') &&
    (doc.scan_status === 'clean' || doc.scan_status === 'skipped');
  const reasonRequired = outcome !== 'accepted';
  const renderedSession = reviewSession;
  const markViewed = useCallback(() => {
    if (session.current === renderedSession) setViewed(true);
  }, [renderedSession]);
  const clearViewed = useCallback(() => {
    if (session.current === renderedSession) setViewed(false);
  }, [renderedSession]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewed || (reasonRequired && !clientReason.trim())) return;
    setBusy(true);
    setError(null);
    try {
      await reviewDocument(doc.id, {
        outcome,
        client_reason: clientReason.trim() || null,
        review_note: reviewNote.trim() || null,
      });
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof DocumentError ? documentErrorMessage(err) : 'Could not save the review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{doc.original_filename ?? doc.category}</p>
        <DocumentStatusBadge status={doc.status} staff />
      </div>
      <p className="mt-2 text-xs text-zinc-500">Security scan: {doc.scan_status.replace('_', ' ')}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {doc.original_filename && <>
          <button type="button" onClick={() => { const next = ++session.current; setReviewSession(next); setViewed(false); setPreviewOpen(true); }} className="font-semibold text-primarycolor-text">Preview</button>
          <button type="button" onClick={() => {
            const attempt = ++session.current;
            setReviewSession(attempt);
            setViewed(false);
            void downloadVerifiedDocumentFile(doc.id, doc.original_filename ?? 'document')
              .then(() => { if (session.current === attempt) setViewed(true); })
              .catch(() => { if (session.current === attempt) setError('Download failed. Try again.'); });
          }} className="font-semibold text-primarycolor-text">Download</button>
        </>}
      </div>
      {doc.client_reason && <p className="mt-2 text-sm">Reason shared with the client: {doc.client_reason}</p>}
      {doc.review_note && <p className="mt-2 text-sm">Internal note: {doc.review_note}</p>}
      {reviewable && <form onSubmit={(event) => void submitReview(event)} className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h2 className="font-semibold">Review document</h2>
        {!viewed && <p className="text-xs text-zinc-500">Open the document before reviewing it.</p>}
        <label className="block text-sm">Outcome
          <select value={outcome} onChange={(event) => setOutcome(event.target.value as DocumentReviewOutcome)} className="mt-1 block w-full rounded border p-2 dark:bg-zinc-900">
            <option value="accepted">Accept</option><option value="rejected">Reject</option><option value="replacement_needed">Ask for a new copy</option>
          </select>
        </label>
        <label className="block text-sm">Reason shared with the client {reasonRequired ? '(required)' : '(optional)'}
          <textarea required={reasonRequired} maxLength={1000} value={clientReason} onChange={(event) => setClientReason(event.target.value)} className="mt-1 block w-full rounded border p-2 dark:bg-zinc-900" />
        </label>
        <label className="block text-sm">Internal note (optional)
          <textarea maxLength={2000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-1 block w-full rounded border p-2 dark:bg-zinc-900" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !viewed || (reasonRequired && !clientReason.trim())} className="rounded bg-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Submit review'}</button>
      </form>}
      {!reviewable && error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <DocumentPreviewDialog key={`${doc.id}:${reviewSession}`} documentId={doc.id} filename={doc.original_filename} contentType={doc.content_type}
        open={previewOpen} verifiedContent onClose={() => setPreviewOpen(false)}
        onReady={markViewed} onPreviewError={clearViewed} onDownloaded={markViewed} />
    </section>
  );
}
