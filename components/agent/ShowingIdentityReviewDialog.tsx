'use client';

import { useEffect, useState } from 'react';

import {
  fetchShowingIdentityDocuments,
  openShowingIdentityDocument,
  reviewShowingIdentityDocument,
} from '@/services/showingService';
import type { ShowingRequest, ShowingVerificationDocument } from '@/types/api';

type ShowingIdentityReviewDialogProps = {
  request: ShowingRequest | null;
  open: boolean;
  onClose: () => void;
  onReviewed?: () => void;
};

export default function ShowingIdentityReviewDialog({
  request,
  open,
  onClose,
  onReviewed,
}: ShowingIdentityReviewDialogProps) {
  const [documents, setDocuments] = useState<ShowingVerificationDocument[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !request) return;
    let active = true;
    void (async () => {
      setError(null);
      try {
        const rows = await fetchShowingIdentityDocuments(request.id);
        if (!active) return;
        setDocuments(rows);
        setViewedIds(new Set(rows.filter((doc) => doc.viewed_at).map((doc) => doc.id)));
      } catch {
        if (!active) return;
        setError('Could not load identity documents.');
      }
    })();
    return () => {
      active = false;
    };
  }, [open, request]);

  if (!open || !request) return null;

  const activeRequest = request;

  async function handleView(documentId: string) {
    setError(null);
    try {
      await openShowingIdentityDocument(activeRequest.id, documentId);
      setViewedIds((prev) => new Set(prev).add(documentId));
      setDocuments(await fetchShowingIdentityDocuments(activeRequest.id));
    } catch {
      setError('Could not open the document. Try again.');
    }
  }

  async function handleReview(documentId: string, status: 'verified' | 'rejected') {
    if (!viewedIds.has(documentId)) {
      setError('View the ID document before verifying or rejecting it.');
      return;
    }
    setBusyId(documentId);
    setError(null);
    try {
      await reviewShowingIdentityDocument(activeRequest.id, documentId, status);
      setDocuments(await fetchShowingIdentityDocuments(activeRequest.id));
      onReviewed?.();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not update verification status.';
      setError(String(detail));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="id-review-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <h2 id="id-review-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Review identity documents
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Open the protected document first. Verify and Reject stay disabled until you view it.
        </p>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {documents.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No document uploaded yet.</p>
          ) : (
            documents.map((document) => {
              const hasViewed = viewedIds.has(document.id) || Boolean(document.viewed_at);
              const canDecide = document.status === 'uploaded';
              return (
                <div
                  key={document.id}
                  className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {document.original_filename}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {document.status}
                    {document.review_note ? ` · ${document.review_note}` : ''}
                    {hasViewed ? ' · viewed' : ' · not viewed yet'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleView(document.id)}
                      className="text-xs font-semibold text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                    >
                      View securely
                    </button>
                    {canDecide && (
                      <>
                        <button
                          type="button"
                          disabled={!hasViewed || busyId === document.id}
                          onClick={() => void handleReview(document.id, 'verified')}
                          className="text-xs font-semibold text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                          title={
                            hasViewed
                              ? 'Mark as verified'
                              : 'View the document before verifying'
                          }
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          disabled={!hasViewed || busyId === document.id}
                          onClick={() => void handleReview(document.id, 'rejected')}
                          className="text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
                          title={
                            hasViewed
                              ? 'Reject this document'
                              : 'View the document before rejecting'
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
