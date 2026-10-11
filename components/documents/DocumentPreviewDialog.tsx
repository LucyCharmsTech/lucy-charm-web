'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DownloadIcon, XIcon } from 'lucide-react';
import PdfCanvasPreview from './PdfCanvasPreview';

import {
  DocumentError,
  documentErrorMessage,
  downloadDocumentFile,
  downloadVerifiedDocumentFile,
  fetchVerifiedDocumentBlob,
  mintPreviewUrl,
} from '@/services/documentService';

type PreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; documentId: string; url?: string; blob?: Blob; contentType: string; expiresIn: number }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

/**
 * Homeowner previews start from a short-lived signed URL; staff previews use
 * authenticated verified bytes. Signed URLs stay in component state only and
 * are never cached or rendered into a shareable surface.
 */
export default function DocumentPreviewDialog({
  documentId,
  filename,
  contentType,
  open,
  onClose,
  onReady,
  onPreviewError,
  onDownloaded,
  verifiedContent = false,
}: {
  documentId: string;
  filename: string | null;
  contentType?: string | null;
  open: boolean;
  onClose: () => void;
  onReady?: () => void;
  onPreviewError?: () => void;
  onDownloaded?: () => void;
  verifiedContent?: boolean;
}) {
  const [state, setState] = useState<PreviewState>({ kind: 'loading' });
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestId = useRef(0);
  const invalidateRequest = useCallback(() => { requestId.current++; }, []);
  const previewFailed = useCallback(() => {
    setPdfLoaded(false);
    onPreviewError?.();
    setState({ kind: 'error', message: 'Could not render the preview. You can retry or download the document.' });
  }, [onPreviewError]);

  const mint = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const { url, content_type, expires_in } = await mintPreviewUrl(documentId);
      if (currentRequest === requestId.current) {
        setState({ kind: 'ready', documentId, url, contentType: content_type, expiresIn: expires_in });
      }
    } catch (err: unknown) {
      if (currentRequest !== requestId.current) return;
      if (err instanceof DocumentError && err.code === 'not_previewable') {
        // Not an error to the user — offer the download instead.
        setState({ kind: 'unsupported' });
      } else {
        onPreviewError?.();
        setState({
          kind: 'error',
          message: err instanceof DocumentError ? documentErrorMessage(err) : 'Could not open the preview.',
        });
      }
    }
  }, [documentId, onPreviewError]);

  useEffect(() => {
    if (!open || verifiedContent) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setState({ kind: 'loading' });
      setPdfLoaded(false);
      setDownloadError(null);
      void mint();
    });
    return () => { active = false; invalidateRequest(); };
  }, [open, mint, verifiedContent, invalidateRequest]);

  useEffect(() => {
    if (!open || !verifiedContent) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      if (contentType && contentType !== 'application/pdf' && !contentType.startsWith('image/')) {
        setState({ kind: 'unsupported' });
        return;
      }
      setState({ kind: 'loading' });
      setPdfLoaded(false);
      setDownloadError(null);
      void fetchVerifiedDocumentBlob(documentId, controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return;
          if (blob.type !== 'application/pdf' && !blob.type.startsWith('image/')) {
            setState({ kind: 'unsupported' });
            return;
          }
          if (blob.type === 'application/pdf') {
            setState({ kind: 'ready', documentId, blob, contentType: blob.type, expiresIn: 0 });
          } else {
            objectUrl = URL.createObjectURL(blob);
            setState({ kind: 'ready', documentId, url: objectUrl, contentType: blob.type, expiresIn: 0 });
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          onPreviewError?.();
          setState({ kind: 'error', message: err instanceof DocumentError
            ? documentErrorMessage(err) : 'Could not open the preview.' });
        });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contentType, documentId, open, onPreviewError, retryNonce, verifiedContent]);

  // Images still display the signed URL directly, so re-mint it before expiry.
  // PDF.js fetches the full PDF once; page navigation no longer needs the URL.
  useEffect(() => {
    if (!open || verifiedContent || state.kind !== 'ready' || state.blob || state.contentType === 'application/pdf') return;
    const ms = Math.max(30_000, state.expiresIn * 1000 * 0.8);
    const timer = setTimeout(() => void mint(), ms);
    return () => clearTimeout(timer);
  }, [open, state, mint, verifiedContent]);

  const pdfFailed = useCallback(() => {
    // Signed S3 URLs may not permit PDF.js cross-origin fetches. The existing
    // authenticated endpoint applies the same document authorization, scan and
    // byte-size gates before returning content; use it only on signed-URL failure.
    if (verifiedContent || state.kind !== 'ready' || state.blob) {
      previewFailed();
      return;
    }
    const currentRequest = ++requestId.current;
    setState({ kind: 'loading' });
    setPdfLoaded(false);
    void fetchVerifiedDocumentBlob(documentId)
      .then((blob) => {
        if (currentRequest !== requestId.current) return;
        if (blob.type !== 'application/pdf') throw new Error('Not a PDF');
        setState({ kind: 'ready', documentId, blob, contentType: blob.type, expiresIn: 0 });
      })
      .catch(() => { if (currentRequest === requestId.current) previewFailed(); });
  }, [documentId, previewFailed, state, verifiedContent]);

  if (!open) return null;

  async function handleDownload() {
    setDownloadError(null);
    try {
      if (verifiedContent) {
        await downloadVerifiedDocumentFile(documentId, filename ?? 'document');
      } else {
        await downloadDocumentFile(documentId);
      }
      onDownloaded?.();
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
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-primarycolor px-4 text-xs font-semibold text-primarycolor-foreground transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
              >
                <DownloadIcon className="size-3.5" aria-hidden="true" />
                Download instead
              </button>
            </div>
          )}
          {state.kind === 'error' && (
            <div className="text-center">
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">{state.message}</p>
              <button type="button" onClick={() => {
                setPdfLoaded(false);
                setState({ kind: 'loading' });
                if (verifiedContent) setRetryNonce((n) => n + 1);
                else void mint();
              }} className="mt-3 rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground">
                Retry preview
              </button>
            </div>
          )}
          {state.kind === 'ready' && state.documentId === documentId &&
            (state.contentType === 'application/pdf' ? (
              <PdfCanvasPreview
                key={`${documentId}:${state.url ?? 'verified'}`}
                url={state.url}
                blob={state.blob}
                onRendered={verifiedContent ? () => setPdfLoaded(true) : () => onReady?.()}
                onError={pdfFailed}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived S3 URL; next/image would proxy and cache it
              <img
                src={state.url ?? ''}
                alt="Document preview"
                onLoad={onReady}
                onError={previewFailed}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ))}
        </div>
        {verifiedContent && state.kind === 'ready' && state.documentId === documentId && state.contentType === 'application/pdf' && pdfLoaded && onReady && (
          <button type="button" onClick={onReady} className="mx-4 mb-3 rounded-lg bg-primarycolor px-3 py-2 text-sm font-semibold text-primarycolor-foreground">
            I can read this PDF
          </button>
        )}
      </div>
    </div>
  );
}
