'use client';

import { useState } from 'react';
import { DownloadIcon, EyeIcon, HistoryIcon } from 'lucide-react';

import DocumentHistoryList from '@/components/documents/DocumentHistoryList';
import DocumentPreviewDialog from '@/components/documents/DocumentPreviewDialog';
import DocumentStatusBadge from '@/components/documents/DocumentStatusBadge';
import DocumentUploadButton from '@/components/documents/DocumentUploadButton';
import {
  DOCUMENT_CATEGORY_LABELS,
  DocumentError,
  documentErrorMessage,
  downloadDocumentFile,
  formatBytes,
  isDocumentOverdue,
  SHOWS_UPLOAD_CTA,
} from '@/services/documentService';
import type { AppDocument } from '@/types/api';

/**
 * One document as its owner sees it. Handles the file-less `requested` /
 * `missing` states (every file field is null there) and keeps rejected
 * versions reachable through the history toggle.
 */
export default function ClientDocumentCard({
  document: doc,
  onChanged,
  onError,
}: {
  document: AppDocument;
  /** A replacement changes two rows — the parent should refetch the collection. */
  onChanged?: (uploaded: AppDocument) => void;
  onError?: (message: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const hasFile = doc.original_filename !== null;
  const overdue = isDocumentOverdue(doc);
  const hasHistory = Boolean(doc.supersedes_document_id || doc.superseded_by_document_id);

  async function handleDownload() {
    try {
      await downloadDocumentFile(doc.id);
    } catch (err: unknown) {
      onError?.(
        err instanceof DocumentError ? documentErrorMessage(err) : 'Download failed. Try again.',
      );
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {doc.description ?? DOCUMENT_CATEGORY_LABELS[doc.category]}
        </p>
        <DocumentStatusBadge status={doc.status} overdue={overdue} />
      </div>

      {hasFile ? (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          {doc.original_filename}
          {doc.size_bytes !== null ? ` · ${formatBytes(doc.size_bytes)}` : ''}
        </p>
      ) : (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Not uploaded yet.</p>
      )}

      {doc.client_reason && (
        <p
          className={`mt-2 rounded-lg px-2.5 py-2 text-xs ${
            doc.status === 'rejected'
              ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
              : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
          }`}
        >
          {doc.client_reason}
        </p>
      )}

      {doc.due_date && doc.status === 'requested' && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Preferred by {new Date(doc.due_date).toLocaleDateString()}
          {overdue ? ' — overdue, but you can still upload' : ''}
        </p>
      )}

      {doc.expires_at && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Valid until {new Date(doc.expires_at).toLocaleDateString()}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {hasFile && (
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
            >
              <EyeIcon className="size-3.5" aria-hidden="true" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primarycolor focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
            >
              <DownloadIcon className="size-3.5" aria-hidden="true" />
              Download
            </button>
          </>
        )}
        {hasHistory && (
          <button
            type="button"
            onClick={() => setHistoryOpen((open) => !open)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
          >
            <HistoryIcon className="size-3.5" aria-hidden="true" />
            {historyOpen ? 'Close history' : 'Show history'}
          </button>
        )}
      </div>

      {SHOWS_UPLOAD_CTA.includes(doc.status) && (
        <DocumentUploadButton
          className="mt-3"
          target={{ kind: 'revision', documentId: doc.id }}
          withExpiryField
          label={hasFile ? 'Upload a new copy' : 'Upload'}
          onUploaded={(uploaded) => onChanged?.(uploaded)}
          onError={onError}
        />
      )}

      {historyOpen && (
        <div className="mt-3">
          <DocumentHistoryList documentId={doc.id} />
        </div>
      )}

      <DocumentPreviewDialog
        documentId={doc.id}
        filename={doc.original_filename}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
