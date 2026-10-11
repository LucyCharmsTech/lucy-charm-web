'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';

/** Render PDF bytes on our own canvas: iframe load is not evidence of a visible PDF. */
export default function PdfCanvasPreview({ url, blob, onRendered, onError }: {
  url?: string;
  blob?: Blob;
  onRendered: () => void;
  onError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedCallback = useRef(onRendered);
  const errorCallback = useRef(onError);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    renderedCallback.current = onRendered;
    errorCallback.current = onError;
  }, [onRendered, onError]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let loadedDocument: PDFDocumentProxy | null = null;
    const canvas = canvasRef.current;
    queueMicrotask(() => {
      if (cancelled) return;
      setDocument(null);
      setPageNumber(1);
      setRendered(false);
      void (async () => {
        try {
          const pdfjs = await import('pdfjs-dist');
          if (cancelled) return;
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url,
          ).toString();
          const data = blob ? new Uint8Array(await blob.arrayBuffer()) : undefined;
          if (cancelled) return;
          // Signed objects are upload-size bounded. Fetch them once rather than
          // issuing later range requests after a short-lived URL has expired.
          loadingTask = pdfjs.getDocument(data ? { data, isEvalSupported: false } : {
            url: url!, disableRange: true, disableStream: true, isEvalSupported: false,
          });
          loadedDocument = await loadingTask.promise;
          if (cancelled) {
            await loadedDocument.destroy();
            return;
          }
          setDocument(loadedDocument);
        } catch {
          if (!cancelled) errorCallback.current();
        }
      })();
    });
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    };
  }, [blob, url]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    queueMicrotask(() => {
      if (cancelled) return;
      setRendered(false);
      void (async () => {
        try {
          const page = await document.getPage(pageNumber);
          if (cancelled) return;
          const canvas = canvasRef.current;
          const context = canvas?.getContext('2d');
          if (!canvas || !context) throw new Error('Canvas unavailable');
          const natural = page.getViewport({ scale: 1.25 });
          const displayScale = Math.min(1, 1600 / Math.max(natural.width, natural.height));
          const viewport = page.getViewport({ scale: 1.25 * displayScale });
          const scale = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(viewport.width, viewport.height));
          canvas.width = Math.ceil(viewport.width * scale);
          canvas.height = Math.ceil(viewport.height * scale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          renderTask = page.render({ canvas, canvasContext: context, viewport, transform: [scale, 0, 0, scale, 0, 0] });
          await renderTask.promise;
          if (!cancelled) {
            setRendered(true);
            renderedCallback.current();
          }
        } catch {
          if (!cancelled) errorCallback.current();
        }
      })();
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col items-center gap-2">
      <div className="min-h-0 w-full flex-1 overflow-auto text-center">
        {!rendered && <p className="py-4 text-sm text-zinc-500" role="status">Rendering PDF page…</p>}
        <canvas ref={canvasRef} aria-label={`PDF page ${pageNumber}`} className="mx-auto max-w-full rounded bg-white shadow" />
      </div>
      {document && document.numPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" disabled={pageNumber === 1} onClick={() => setPageNumber((n) => n - 1)} className="disabled:opacity-50">Previous page</button>
          <span>Page {pageNumber} of {document.numPages}</span>
          <button type="button" disabled={pageNumber === document.numPages} onClick={() => setPageNumber((n) => n + 1)} className="disabled:opacity-50">Next page</button>
        </div>
      )}
    </div>
  );
}
