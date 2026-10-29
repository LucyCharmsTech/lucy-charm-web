'use client';

import { useEffect, useRef, useState } from 'react';
import SellerPlanPdfPreviewDialog from './SellerPlanPdfPreviewDialog';
import {
  downloadPdfBlob, fetchPublishedSellerPlanPdf,
  type SellerPlanPublication,
} from '@/services/sellerPlanPdfService';

export type SellerPublicationState =
  | { kind: 'loading' }
  | { kind: 'available'; value: SellerPlanPublication }
  | { kind: 'unavailable' }
  | { kind: 'error' };

export default function PublishedSellerPlan({ journeyId, publication, onRefresh }: {
  journeyId: string;
  publication: SellerPublicationState;
  onRefresh: (message?: string) => void;
}) {
  const [preview, setPreview] = useState<{ blob: Blob; versionId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const currentVersionId = publication.kind === 'available' ? publication.value.version_id : null;
  const currentVersion = useRef(currentVersionId);

  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => {
    requestId.current += 1;
    currentVersion.current = currentVersionId;
    let active = true;
    queueMicrotask(() => { if (active) setPreview(null); });
    return () => { active = false; };
  }, [currentVersionId]);

  async function getPdf(download: boolean) {
    if (busy || publication.kind !== 'available') return;
    setBusy(true);
    setError(null);
    const currentRequest = ++requestId.current;
    try {
      // Fetch authorized bytes for every action. Metadata is not a storage URL.
      const blob = await fetchPublishedSellerPlanPdf(journeyId, publication.value.version_id);
      if (currentRequest !== requestId.current || currentVersion.current !== publication.value.version_id) return;
      if (download) downloadPdfBlob(blob, publication.value.filename || 'Seller-Plan.pdf');
      else setPreview({ blob, versionId: publication.value.version_id });
    } catch (failure) {
      if (currentRequest !== requestId.current) return;
      setPreview(null);
      const status = (failure as { response?: { status?: number } })?.response?.status;
      onRefresh(status === 409
        ? 'The published Seller Plan changed. Open the refreshed version to view or download it.'
        : 'The published PDF could not be opened. Its current availability is being checked.');
    } finally {
      if (currentRequest === requestId.current) setBusy(false);
    }
  }

  if (publication.kind === 'loading') return <p role="status" className="mt-5 text-sm text-zinc-600 dark:text-zinc-300">Checking published PDF access…</p>;
  if (publication.kind !== 'available') return <div className="mt-5 border-t border-zinc-200 pt-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
    <p>{publication.kind === 'error' ? 'We cannot check your published PDF right now.' : 'No published Seller Plan PDF is currently available.'}</p>
    <button type="button" onClick={() => onRefresh()} className="mt-2 min-h-10 font-semibold text-primarycolor-text underline underline-offset-4">Check again</button>
  </div>;

  return <section aria-label="Published Seller Plan PDF" className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-700">
    <h3 className="text-base font-bold">Your PDF is ready</h3>
    <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">Version {publication.value.version_number} · Published {new Date(publication.value.published_at).toLocaleString()}</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <button type="button" aria-label="View Seller Plan PDF" disabled={busy} onClick={() => void getPdf(false)} className="min-h-11 rounded-full bg-primarycolor px-5 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:opacity-50">View Seller Plan</button>
      <button type="button" aria-label="Download Seller Plan PDF" disabled={busy} onClick={() => void getPdf(true)} className="min-h-11 rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-700">Download PDF</button>
      <button type="button" onClick={() => onRefresh()} className="min-h-11 px-4 py-2 text-sm font-semibold text-primarycolor-text underline underline-offset-4">Check current status</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
    {preview?.versionId === publication.value.version_id && <SellerPlanPdfPreviewDialog blob={preview.blob}
      filename={publication.value.filename || 'Seller-Plan.pdf'} title="Seller Plan PDF preview"
      onDownload={() => getPdf(true)} onClose={() => setPreview(null)} />}
  </section>;
}
