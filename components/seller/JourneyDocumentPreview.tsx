'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import PdfCanvasPreview from '@/components/documents/PdfCanvasPreview';

export default function JourneyDocumentPreview({ blob, filename, onClose, onDownload }: {
  blob: Blob; filename: string; onClose: () => void; onDownload: () => Promise<void>;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!blob.type.startsWith('image/')) return;
    const url = URL.createObjectURL(blob);
    queueMicrotask(() => setImageUrl(url));
    return () => { URL.revokeObjectURL(url); };
  }, [blob]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const targets = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!targets.length) return;
      if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets[targets.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === targets[targets.length - 1]) { event.preventDefault(); targets[0].focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);

  return createPortal(<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 sm:p-4"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="flex h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:h-[85dvh]">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4">
        <h2 id={titleId} className="truncate text-sm font-semibold text-zinc-900">{filename}</h2>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => {
            setBusy(true); setError(null);
            void onDownload().catch(() => setError('Download is unavailable. Refresh and try again.')).finally(() => setBusy(false));
          }} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Download</button>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close preview"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800">Close</button>
        </div>
      </header>
      {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
      <div className="min-h-0 flex-1 overflow-auto p-3 text-center">
        {blob.type === 'application/pdf' ? <PdfCanvasPreview blob={blob} onRendered={() => {}} onError={() => setError('Could not display this PDF. Try downloading it.')} />
          : imageUrl ? <Image unoptimized src={imageUrl} width={1200} height={900} alt={`Preview of ${filename}`} onError={() => setError('Could not display this image. Try downloading it.')} className="mx-auto max-h-full max-w-full object-contain" /> : <p role="status">Loading preview…</p>}
      </div>
    </div>
  </div>, document.body);
}
