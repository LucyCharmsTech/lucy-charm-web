'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PublishedSellerPlan, { type SellerPublicationState } from '@/components/seller/PublishedSellerPlan';
import JourneyDocumentPreview from '@/components/seller/JourneyDocumentPreview';
import { downloadPdfBlob } from '@/services/sellerPlanPdfService';
import {
  fetchSharedJourneyDocumentContent, getSharedJourneyDocument, journeyDocumentError,
  listRequestedJourneyDocuments, listSharedJourneyDocuments, uploadRequestedJourneyDocument,
  type SellerJourneyDocument,
} from '@/services/sellerJourneyDocumentService';

const MAX_BYTES = 10 * 1024 * 1024;
const typesByExtension: Record<string, string[]> = {
  pdf: ['application/pdf'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'],
  png: ['image/png'], webp: ['image/webp'],
};

function validateUploadFile(file: File): { ok: true; file: File } | { ok: false; error: string } {
  if (!file.size) return { ok: false, error: 'This file is empty. Choose a PDF or image with content.' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'This file exceeds 10 MB. Choose a smaller PDF or image.' };
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const allowedTypes = typesByExtension[extension];
  if (!allowedTypes) return { ok: false, error: 'Unsupported format. Choose a PDF, JPG, PNG, or WebP file.' };
  if (!file.type && extension === 'pdf') {
    // The API still verifies the declared PDF type against the actual file bytes.
    return { ok: true, file: new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified }) };
  }
  if (!file.type) return { ok: false, error: 'Your browser could not identify this image type. Choose a JPG, PNG, or WebP file.' };
  if (!allowedTypes.includes(file.type)) return { ok: false, error: 'The filename and file type do not match. Choose a valid PDF or image.' };
  return { ok: true, file };
}

export default function ExploringSellerDocuments({ journeyId, publication, onPublicationRefresh }: {
  journeyId: string; publication: SellerPublicationState; onPublicationRefresh: (message?: string) => void;
}) {
  const [shared, setShared] = useState<SellerJourneyDocument[]>([]);
  const [requested, setRequested] = useState<SellerJourneyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ requestId: string; file: File } | null>(null);
  const [confirmedUploadId, setConfirmedUploadId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ document: SellerJourneyDocument; blob: Blob } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const previewRequest = useRef(0);
  const listRequest = useRef(0);
  const loadedOnce = useRef(false);
  const uploadInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    const request = ++listRequest.current;
    previewRequest.current += 1;
    const timer = window.setTimeout(() => {
      if (loadedOnce.current) setRevalidating(true);
      else setLoading(true);
      setPreview(null);
      Promise.all([listSharedJourneyDocuments(journeyId), listRequestedJourneyDocuments(journeyId)])
        .then(([sharedDocs, requests]) => {
          if (!active || request !== listRequest.current) return;
          loadedOnce.current = true;
          setShared(sharedDocs); setRequested(requests); setError(null);
        }).catch((failure: unknown) => {
          if (!active || request !== listRequest.current) return;
          // Shared access has not been reverified; keep existing request controls mounted.
          setShared([]);
          if (!loadedOnce.current) setRequested([]);
          setError(journeyDocumentError(failure));
        }).finally(() => {
          if (active && request === listRequest.current) { setLoading(false); setRevalidating(false); }
        });
    }, 0);
    return () => { active = false; previewRequest.current += 1; window.clearTimeout(timer); };
  }, [journeyId, refresh]);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === 'visible' && !uploadInFlight.current) { previewRequest.current += 1; setPreview(null); setRefresh((n) => n + 1); }
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate); };
  }, []);

  const currentDocument = preview?.document;
  useEffect(() => {
    if (preview && !shared.some((item) => item.id === currentDocument?.id)) {
      const timer = window.setTimeout(() => setPreview(null), 0);
      return () => window.clearTimeout(timer);
    }
  }, [shared, preview, currentDocument?.id]);

  useEffect(() => {
    if (loading || !selected || requested.some((item) => item.id === selected.requestId && item.status === 'requested')) return;
    const timer = window.setTimeout(() => {
      setSelected((current) => current?.requestId === selected.requestId ? null : current);
      setUploadError('This request no longer accepts an upload. Your selection was cleared; review its current status.');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, requested, selected]);

  const getVerifiedBytes = useCallback(async (item: SellerJourneyDocument) => {
    // Detail and content both enforce current journey ownership and sharing on the server.
    await getSharedJourneyDocument(journeyId, item.id);
    return fetchSharedJourneyDocumentContent(journeyId, item.id);
  }, [journeyId]);

  async function open(item: SellerJourneyDocument) {
    if (busyId) return;
    const request = ++previewRequest.current;
    setBusyId(item.id); setError(null);
    try { const blob = await getVerifiedBytes(item); if (request === previewRequest.current) setPreview({ document: item, blob }); }
    catch (failure) { if (request === previewRequest.current) { setPreview(null); setError(journeyDocumentError(failure)); setRefresh((n) => n + 1); } }
    finally { if (request === previewRequest.current) setBusyId(null); }
  }
  async function download(item: SellerJourneyDocument) {
    const blob = await getVerifiedBytes(item);
    downloadPdfBlob(blob, item.filename || 'shared-document');
  }
  function selectFile(item: SellerJourneyDocument, file?: File) {
    setConfirmedUploadId(null);
    if (uploadInFlight.current || busyId) {
      setUploadError('A document action is in progress. Wait for it to finish before uploading.'); return;
    }
    if (item.status !== 'requested') {
      setSelected(null); setUploadError('This request no longer accepts an upload. Refresh its status.'); return;
    }
    if (!file) {
      setSelected(null); setUploadError('Select a PDF or image before uploading.'); return;
    }
    const validated = validateUploadFile(file);
    if (!validated.ok) {
      setSelected(null); setUploadError(validated.error); return;
    }
    setSelected({ requestId: item.id, file: validated.file });
    setUploadError(null);
  }

  async function upload(item: SellerJourneyDocument) {
    if (uploadInFlight.current || busyId) {
      setUploadError('A document action is in progress. Wait for it to finish before uploading.'); return;
    }
    if (item.status !== 'requested') {
      setSelected(null); setUploadError('This request no longer accepts an upload. Refresh its status.'); return;
    }
    if (selected?.requestId !== item.id) {
      setUploadError('Select a PDF or image before uploading.'); return;
    }
    const validated = validateUploadFile(selected.file);
    if (!validated.ok) { setSelected(null); setUploadError(validated.error); return; }
    uploadInFlight.current = true;
    listRequest.current += 1;
    setBusyId(item.id); setUploadError(null); setConfirmedUploadId(null);
    let submitted = false;
    try {
      const result = await uploadRequestedJourneyDocument(journeyId, item.id, validated.file);
      submitted = true;
      if (result.id !== item.id || result.status !== 'uploaded') throw new Error('Unexpected upload response');
      const requests = await listRequestedJourneyDocuments(journeyId);
      setRequested(requests);
      setLoading(false);
      if (requests.find((request) => request.id === item.id)?.status !== 'uploaded') {
        throw new Error('Upload status was not confirmed');
      }
      setSelected(null); setUploadError(null); setConfirmedUploadId(item.id);
    } catch (failure) {
      setUploadError(submitted
        ? 'The upload response was received, but its current status could not be confirmed. Refresh the list before trying again.'
        : journeyDocumentError(failure));
      setRefresh((n) => n + 1);
    } finally {
      uploadInFlight.current = false; setBusyId(null);
    }
  }

  return <div className="space-y-8">
    <div><h2 className="text-xl font-semibold text-zinc-900">Documents</h2>
      <p className="mt-1 text-sm text-zinc-600">Files shared for this home only.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" className="underline" onClick={() => setRefresh((n) => n + 1)}>Retry</button></p>}
    {uploadError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{uploadError} <button type="button" className="underline" onClick={() => setRefresh((n) => n + 1)}>Refresh status</button></p>}
    {busyId && <p role="status" className="text-sm text-zinc-700">Document action in progress. Wait for it to finish before uploading another file.</p>}
    {revalidating && <p role="status" className="text-xs text-zinc-600">Checking for document updates…</p>}
    {loading ? <p role="status" className="text-sm text-zinc-600">Checking your documents…</p> : <>
      <section aria-labelledby="shared-heading" className="space-y-3">
        <h3 id="shared-heading" className="text-base font-semibold text-zinc-900">Shared with you</h3>
        {publication.kind === 'available' && <div className="rounded-xl border border-zinc-200 p-4">
          <PublishedSellerPlan journeyId={journeyId} publication={publication} onRefresh={onPublicationRefresh} />
        </div>}
        {publication.kind === 'error' && <p className="text-sm text-zinc-600">Seller Plan availability could not be checked. Please try again later.</p>}
        {shared.length === 0 && publication.kind === 'unavailable' && <p className="text-sm text-zinc-600">No documents have been shared for this home yet.</p>}
        {shared.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 p-4">
          <div className="min-w-0"><p className="break-words text-sm font-semibold text-zinc-900">{item.filename || item.description || 'Shared document'}</p>
            <p className="mt-1 text-xs text-zinc-500">{item.category.replaceAll('_', ' ')}{item.shared_at ? ` · Shared ${new Date(item.shared_at).toLocaleDateString()}` : ''}</p></div>
          <div className="flex gap-2"><button type="button" disabled={busyId !== null} onClick={() => void open(item)} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">View</button>
            <button type="button" disabled={busyId !== null} onClick={() => void download(item).catch((failure) => { setError(journeyDocumentError(failure)); setRefresh((n) => n + 1); })} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50">Download</button></div>
        </div>)}
      </section>
      <section aria-labelledby="requests-heading" className="space-y-3">
        <h3 id="requests-heading" className="text-base font-semibold text-zinc-900">Requested from you</h3>
        {requested.length === 0 && <p className="text-sm text-zinc-600">No documents have been requested for this home.</p>}
        {requested.map((item) => <div key={item.id} className="rounded-xl border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-zinc-900">{item.description || item.category.replaceAll('_', ' ')}</p>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{item.status === 'uploaded' ? 'Uploaded · pending staff review' : item.status.replaceAll('_', ' ')}</span></div>
          {item.filename && <p className="mt-1 text-sm text-zinc-600">Submitted: {item.filename}</p>}
          {confirmedUploadId === item.id && item.status === 'uploaded' && <p role="status" className="mt-2 text-sm font-medium text-zinc-800">Uploaded — pending staff review.</p>}
          {item.client_reason && <p className="mt-2 text-sm text-zinc-700">Staff note: {item.client_reason}</p>}
          {item.status === 'requested' && <div className="mt-3 space-y-2">
            <label className="inline-block cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800">
              Select PDF or image
              <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={busyId !== null}
                onChange={(event) => { selectFile(item, event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
            </label>
            {selected?.requestId === item.id && <p className="break-all text-sm text-zinc-700">Selected: {selected.file.name}</p>}
            <p className="text-xs text-zinc-600">Selecting a file does not upload it. Choose a PDF or image under 10 MB, then select Upload.</p>
            <button type="button" disabled={busyId !== null} onClick={() => void upload(item)}
              className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">
              {busyId === item.id ? 'Uploading…' : 'Upload selected file'}
            </button>
          </div>}
          {(item.status === 'rejected' || item.status === 'replacement_needed') && <p className="mt-2 text-xs text-zinc-600">This request cannot be replaced here yet. Please contact your agent.</p>}
        </div>)}
      </section>
    </>}
    {preview && <JourneyDocumentPreview key={preview.document.id} blob={preview.blob} filename={preview.document.filename || 'Shared document'}
      onClose={() => setPreview(null)} onDownload={() => download(preview.document)} />}
  </div>;
}
