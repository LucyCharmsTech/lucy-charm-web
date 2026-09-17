'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheckIcon } from 'lucide-react';

import ClientDocumentCard from '@/components/documents/ClientDocumentCard';
import DocumentUploadButton from '@/components/documents/DocumentUploadButton';
import { useRealtimeEvent, useRefetchOnReconnect } from '@/lib/realtime/hooks';
import {
  fetchDocuments,
  isHistoryDocument,
  NEEDS_CLIENT_ACTION,
  sortDocumentsForClient,
} from '@/services/documentService';
import { fetchMyShowingRequests } from '@/services/showingService';
import type { AppDocument, NotificationCreatedPayload, ShowingRequest } from '@/types/api';

type DocumentRow = { request: ShowingRequest; documents: AppDocument[] };

/**
 * A row is shown when the showing opted into ID verification, or when any
 * document exists on it — staff can request documents on any showing, and a
 * request with no file is still a real document the client must see.
 */
function isRelevant(row: DocumentRow): boolean {
  return (
    row.request.id_verification_requested ||
    row.request.id_verification_status !== 'not_requested' ||
    row.documents.length > 0
  );
}

export default function ClientDocumentsSection() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const requests = await fetchMyShowingRequests();
      const documents = await Promise.all(
        requests.map(async (request) => ({
          request,
          documents: await fetchDocuments('showing_request', request.id),
        })),
      );
      setRows(documents.filter(isRelevant));
      setError(null);
    } catch {
      setError('Could not load your documents.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Document notifications (requested / reviewed / expired) arrive over the
  // socket; the payload is deliberately vague, so refetch rather than patch.
  useRealtimeEvent<NotificationCreatedPayload>('notification.created', (event) => {
    if (event.payload?.notification?.resource_type === 'document') void load();
  });
  useRefetchOnReconnect(() => void load());

  const outstanding = rows
    .flatMap((row) => row.documents)
    .filter((doc) => NEEDS_CLIENT_ACTION.includes(doc.status)).length;

  return (
    <section
      id="documents"
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
    >
      <div className="flex items-start gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 text-primarycolor-text" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Documents
            {outstanding > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {outstanding} needing action
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload and track the documents your agent needs — like a photo or PDF of your ID for
            verified showings. Your agent reviews them here.
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
            Nothing is needed right now. When you request a showing, check “Request ID
            verification” to enable upload — or your agent may ask you for a document here.
          </p>
        ) : (
          rows.map(({ request, documents }) => {
            const visibleDocs = sortDocumentsForClient(
              documents.filter((doc) => !isHistoryDocument(doc)),
            );
            const needsFirstIdUpload =
              (request.id_verification_requested ||
                request.id_verification_status === 'pending') &&
              request.id_verification_status !== 'verified' &&
              !documents.some((doc) => doc.category === 'identity');
            return (
              <div
                key={request.id}
                className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Showing on{' '}
                  {new Date(request.scheduled_at ?? request.preferred_date).toLocaleString()}
                </p>
                <div className="mt-2 space-y-2">
                  {visibleDocs.map((doc) => (
                    <ClientDocumentCard
                      key={doc.id}
                      document={doc}
                      onChanged={() => {
                        setError(null);
                        setStatusMessage('Uploaded. Your agent will review it shortly.');
                        void load();
                      }}
                      onError={(message) => {
                        setStatusMessage(null);
                        setError(message);
                      }}
                    />
                  ))}
                  {visibleDocs.length === 0 && !needsFirstIdUpload && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">No documents yet.</p>
                  )}
                  {needsFirstIdUpload && (
                    <div className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Upload a photo or PDF of your ID (max 10 MB) so your agent can verify it.
                      </p>
                      <DocumentUploadButton
                        className="mt-2"
                        target={{
                          kind: 'new',
                          resourceType: 'showing_request',
                          resourceId: request.id,
                          category: 'identity',
                        }}
                        withExpiryField
                        label="Upload ID"
                        onUploaded={() => {
                          setError(null);
                          setStatusMessage('ID uploaded. Your agent will review it shortly.');
                          void load();
                        }}
                        onError={(message) => {
                          setStatusMessage(null);
                          setError(message);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
