'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, ShieldCheckIcon } from 'lucide-react';

import ClientDocumentCard from '@/components/documents/ClientDocumentCard';
import DocumentHistoryList from '@/components/documents/DocumentHistoryList';
import {
  DocumentError,
  documentErrorMessage,
  fetchDocument,
  isStaffDocument,
} from '@/services/documentService';
import type { AppDocument } from '@/types/api';

/**
 * Deep-link target for document notifications (`deep_link: "/documents/<id>"`).
 * Notification copy is deliberately vague, so this page is where the client
 * reads the actual reason and acts on it. A 404 here means "wrong id or not
 * yours" — one message covers both, on purpose.
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
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primarycolor-text underline-offset-2 hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden="true" />
        Back to profile
      </Link>

      <div className="mt-4 flex items-start gap-3">
        <ShieldCheckIcon className="mt-0.5 size-5 text-primarycolor-text" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Document</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Stored securely — only you, your agent, and our staff can open it.
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
          <ClientDocumentCard
            document={doc}
            onChanged={() => {
              setActionError(null);
              void load();
            }}
            onError={setActionError}
          />
          <section>
            <h2 className="mb-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">History</h2>
            <DocumentHistoryList documentId={doc.id} staff={isStaffDocument(doc)} />
          </section>
        </div>
      )}
    </main>
  );
}
