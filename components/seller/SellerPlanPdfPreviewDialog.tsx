'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DownloadIcon, XIcon } from 'lucide-react';
import PdfCanvasPreview from '@/components/documents/PdfCanvasPreview';
import { downloadPdfBlob } from '@/services/sellerPlanPdfService';

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function SellerPlanPdfPreviewDialog({ blob, filename, title, onClose, onDownload }: {
  blob: Blob;
  filename: string;
  title: string;
  onClose: () => void;
  onDownload?: () => Promise<void>;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault(); focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault(); focusable[0].focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div data-modal-root="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
        className="flex h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900 sm:h-[85dvh]">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" disabled={downloading} onClick={() => {
              if (!onDownload) { downloadPdfBlob(blob, filename); return; }
              setDownloading(true);
              void onDownload().finally(() => setDownloading(false));
            }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
              <DownloadIcon className="size-4" aria-hidden="true" />{downloading ? 'Checking…' : 'Download'}
            </button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close preview"
              className="inline-flex size-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-200 dark:hover:bg-zinc-800">
              <XIcon className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2 text-center sm:p-4">
          <PdfCanvasPreview blob={blob} onRendered={() => setRendered(true)} onError={() => setError(true)} />
          {!rendered && !error && <p role="status" className="py-3 text-sm text-zinc-600">Rendering PDF…</p>}
          {error && <p role="alert" className="py-3 text-sm text-red-700">Could not display this PDF. Try downloading it.</p>}
        </div>
      </div>
    </div>, document.body,
  );
}
