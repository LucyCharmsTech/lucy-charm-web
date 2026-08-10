'use client';

import { useRef, useState } from 'react';
import { FileUpIcon } from 'lucide-react';

import {
  DOCUMENT_ACCEPT_ATTR,
  DocumentError,
  documentErrorMessage,
  preflightDocumentFile,
  uploadDocument,
  uploadDocumentRevision,
} from '@/services/documentService';
import type { AppDocument, DocumentCategory, DocumentResourceType } from '@/types/api';

// The server requires a future expires_at, so the picker starts tomorrow.
// Computed once at load; the server is the real validator, this only steers
// the picker away from past dates.
const MIN_EXPIRY = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

type UploadTarget =
  | {
      /** Upload against an existing row: fills a request in place, or supersedes. */
      kind: 'revision';
      documentId: string;
    }
  | {
      /** First upload with no predecessor row. */
      kind: 'new';
      resourceType: DocumentResourceType;
      resourceId: string;
      category?: DocumentCategory;
      description?: string;
    };

export default function DocumentUploadButton({
  target,
  label = 'Upload document',
  busyLabel = 'Uploading…',
  className = '',
  withExpiryField = false,
  onUploaded,
  onError,
}: {
  target: UploadTarget;
  label?: string;
  busyLabel?: string;
  className?: string;
  /** Offer an optional "document expiry date" input (e.g. an ID card's own expiry). */
  withExpiryField?: boolean;
  onUploaded?: (document: AppDocument) => void;
  onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const inputId =
    target.kind === 'revision'
      ? `document-upload-${target.documentId}`
      : `document-upload-${target.resourceId}-${target.category ?? 'any'}`;

  async function handleFile(file: File | undefined) {
    if (!file) return;

    // Fail locally before spending a round trip on a file we know is wrong.
    const problem = preflightDocumentFile(file);
    if (problem) {
      onError?.(problem);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // End of day, so the document stays valid through its printed date.
    const expiresAt = expiryDate
      ? new Date(`${expiryDate}T23:59:59`).toISOString()
      : undefined;

    setBusy(true);
    try {
      const uploaded =
        target.kind === 'revision'
          ? await uploadDocumentRevision(target.documentId, file, expiresAt)
          : await uploadDocument({
              file,
              resourceType: target.resourceType,
              resourceId: target.resourceId,
              category: target.category,
              description: target.description,
              expiresAt,
            });
      onUploaded?.(uploaded);
    } catch (err: unknown) {
      onError?.(
        err instanceof DocumentError
          ? documentErrorMessage(err)
          : 'Upload failed. Use a PDF, JPEG, PNG, or WebP under 10 MB.',
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      {withExpiryField && (
        <label
          htmlFor={`${inputId}-expiry`}
          className="mb-2 block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Document expiry date (optional)
          <input
            id={`${inputId}-expiry`}
            type="date"
            min={MIN_EXPIRY}
            value={expiryDate}
            disabled={busy}
            onChange={(event) => setExpiryDate(event.target.value)}
            className="mt-1 block w-full max-w-[200px] rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-normal text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span className="mt-0.5 block text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
            The date printed on the document, e.g. your ID card&rsquo;s expiry.
          </span>
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={DOCUMENT_ACCEPT_ATTR}
        className="sr-only"
        disabled={busy}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        aria-controls={inputId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          inputRef.current?.click();
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primarycolor px-3 text-xs font-semibold text-white transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:opacity-50"
      >
        <FileUpIcon className="size-3.5" aria-hidden="true" />
        {busy ? busyLabel : label}
      </button>
    </div>
  );
}
