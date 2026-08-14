'use client';

import { useCallback, useEffect, useState } from 'react';
import { DownloadIcon, XIcon } from 'lucide-react';

import {
  DocumentError,
  documentErrorMessage,
  downloadDocumentFile,
  mintPreviewUrl,
} from '@/services/documentService';

type PreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; url: string; contentType: string; expiresIn: number }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

/**
 * In-browser preview over a short-lived signed URL. The URL is a bearer
 * credential: it lives only in this component's state, is re-minted before it
 * expires, and is never cached or rendered into a shareable surface.
 */
export default function DocumentPreviewDialog({
  documentId,
  filename,
  open,
  onClose,
}: {
  documentId: string;
  filename: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<PreviewState>({ kind: 'loading' });
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const mint = useCallback(async () => {
    try {
      const { url, content_type, expires_in } = await mintPreviewUrl(documentId);
      setState({ kind: 'ready', url, contentType: content_type, expiresIn: expires_in });
    } catch (err: unknown) {
      if (err instanceof DocumentError && err.code === 'not_previewable') {
        // Not an error to the user — offer the download instead.
        setState({ kind: 'unsupported' });
      } else {
        setState({
          kind: 'error',
          message: err instanceof DocumentError ? documentErrorMessage(err) : 'Could not open the preview.',
        });
      }
    }
  }, [documentId]);

  useEffect(() => {
    if (!open) return;
    setState({ kind: 'loading' });
    setDownloadError(null);
    void mint();
  }, [open, mint]);

  // Re-mint before the signed URL dies so a long-open preview doesn't break.
  useEffect(() => {
    if (!open || state.kind !== 'ready') return;
    const ms = Math.max(30_000, state.expiresIn * 1000 * 0.8);
    const timer = setTimeout(() => void mint(), ms);
    return () => clearTimeout(timer);
  }, [open, state, mint]);

  if (!open) return null;

  async function handleDownload() {
    setDownloadError(null);
    try {
      await downloadDocumentFile(documentId);
    } catch (err: unknown) {
      setDownloadError(
        err instanceof DocumentError ? documentErrorMessage(err) : 'Download failed. Try again.',
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Document preview"
    >
      <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {filename ?? 'Document preview'}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <DownloadIcon className="size-3.5" aria-hidden="true" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:bg-zinc-800"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {downloadError && (
          <p className="px-4 pt-2 text-xs text-red-600 dark:text-red-400" role="alert">
            {downloadError}
          </p>
        )}

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2">
          {state.kind === 'loading' && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading preview…</p>
          )}
          {state.kind === 'unsupported' && (
            <div className="text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This file type can&rsquo;t be previewed in the browser.
              </p>
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-primarycolor px-4 text-xs font-semibold text-white transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                <DownloadIcon className="size-3.5" aria-hidden="true" />
                Download instead
              </button>
            </div>
          )}
          {state.kind === 'error' && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {state.message}
            </p>
          )}
          {state.kind === 'ready' &&
            (state.contentType === 'application/pdf' ? (
              <iframe
                src={state.url}
                title="Document preview"
                sandbox=""
                className="h-full w-full rounded-lg border border-zinc-200 dark:border-zinc-800"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived S3 URL; next/image would proxy and cache it
              <img
                src={state.url}
                alt="Document preview"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ))}
        </div>
      </div>
    </div>
  );
}
