'use client';

import { useEffect, useState } from 'react';
import { ShieldCheckIcon } from 'lucide-react';

import ShowingIdentityUploadButton, {
  canUploadShowingIdentity,
  isShowingIdentityAwaitingReview,
} from '@/components/profile/ShowingIdentityUploadButton';
import { fetchMyShowingRequests, fetchShowingIdentityDocuments } from '@/services/showingService';
import type { ShowingRequest, ShowingVerificationDocument } from '@/types/api';

type DocumentRow = { request: ShowingRequest; documents: ShowingVerificationDocument[] };

function needsIdentitySection(request: ShowingRequest): boolean {
  return request.id_verification_requested || request.id_verification_status !== 'not_requested';
}

export default function ClientDocumentsSection() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function load() {
    try {
      const requests = await fetchMyShowingRequests();
      const verificationRequests = requests.filter(needsIdentitySection);
      const documents = await Promise.all(
        verificationRequests.map(async (request) => ({
          request,
          documents: await fetchShowingIdentityDocuments(request.id),
        })),
      );
      setRows(documents);
    } catch {
      setError('Could not load your verification documents.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <div className="flex items-start gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 text-primarycolor" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Verification documents</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload a photo or PDF of your ID for showings where you requested verification. Your agent
            reviews the file here.
          </p>
        </div>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {statusMessage && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {statusMessage}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No ID verification is needed right now. When you request a showing, check “Request ID
            verification” to enable upload.
          </p>
        ) : (
          rows.map(({ request, documents }) => {
            const activeDocs = documents.filter((doc) => doc.status !== 'rejected');
            const awaiting = isShowingIdentityAwaitingReview(request);
            return (
              <div
                key={request.id}
                className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Showing on{' '}
                    {new Date(request.scheduled_at ?? request.preferred_date).toLocaleString()}
                  </p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      request.id_verification_status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}
                  >
                    ID {request.id_verification_status}
                  </span>
                </div>
                {activeDocs.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    No ID file uploaded yet.
                  </p>
                ) : (
                  activeDocs.map((document) => (
                    <p
                      key={document.id}
                      className="mt-2 text-xs text-zinc-600 dark:text-zinc-300"
                    >
                      {document.original_filename} ·{' '}
                      <span className="font-semibold">{document.status}</span>
                      {document.review_note ? ` · ${document.review_note}` : ''}
                    </p>
                  ))
                )}
                {(canUploadShowingIdentity(request) || awaiting) && (
                  <ShowingIdentityUploadButton
                    className="mt-3"
                    request={request}
                    onUploaded={async () => {
                      setError(null);
                      setStatusMessage('ID uploaded. Your agent will review it shortly.');
                      await load();
                    }}
                    onError={(message) => {
                      setStatusMessage(null);
                      setError(message);
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
