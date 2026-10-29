'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import JourneyDocumentPreview from './JourneyDocumentPreview';
import { downloadPdfBlob } from '@/services/sellerPlanPdfService';
import {
  fetchStaffJourneyDocumentContent, journeyDocumentError, listStaffJourneyDocuments,
  requestSellerJourneyDocument, reviewStaffJourneyDocument, shareStaffJourneyDocument,
  uploadStaffJourneyDocument, withdrawStaffJourneyDocument, type StaffJourneyDocument,
} from '@/services/sellerJourneyDocumentService';

const MAX_BYTES = 10 * 1024 * 1024;
const types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
function selectedFileIssue(file: File | null): string | null {
  if (!file) return null;
  if (!types.includes(file.type)) return 'Choose a PDF, JPEG, PNG, or WebP file.';
  if (file.size < 1) return 'Choose a file that is not empty.';
  if (file.size > MAX_BYTES) return 'Choose a file no larger than 10 MB.';
  return null;
}
function fileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  return size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
const categories = [
  ['supporting_property_document', 'Property document'], ['property_photo', 'Property photo'], ['other', 'Other'],
] as const;

export default function JourneyDocumentManager({ journeyId, role }: { journeyId: string; role: string | undefined }) {
  const [rows, setRows] = useState<StaffJourneyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [category, setCategory] = useState<string>('supporting_property_document');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [requestDescription, setRequestDescription] = useState('');
  const [pending, setPending] = useState<{ doc: StaffJourneyDocument; action: 'rejected' | 'replacement_needed' | 'withdraw' } | null>(null);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ doc: StaffJourneyDocument; blob: Blob } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const previewRequest = useRef(0);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (role !== 'superadmin' && role !== 'agent') return;
    let active = true;
    previewRequest.current += 1;
    const scope = `${role}:${journeyId}`;
    if (loadedFor.current !== scope) {
      loadedFor.current = scope;
      setLoading(true); setRows([]); setFile(null);
    }
    const timer = window.setTimeout(() => {
      setPreview(null); setPending(null);
      listStaffJourneyDocuments(journeyId).then((items) => {
        if (active) { setRows(items); setError(null); }
      }).catch((failure: unknown) => {
        if (active) { setRows([]); setError(journeyDocumentError(failure)); }
      }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; previewRequest.current += 1; window.clearTimeout(timer); };
  }, [journeyId, refresh, role]);

  const reload = useCallback(() => setRefresh((n) => n + 1), []);
  async function act(action: () => Promise<unknown>, success: string): Promise<boolean> {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setBusy(true); setError(null); setNotice(null);
    try { await action(); setNotice(success); reload(); return true; }
    catch (failure) { setError(journeyDocumentError(failure)); reload(); return false; }
    finally { actionInFlight.current = false; setBusy(false); }
  }
  async function upload() {
    if (!file || selectedFileIssue(file)) {
      setError('Choose a PDF or image under 10 MB.'); return;
    }
    if (await act(() => uploadStaffJourneyDocument(journeyId, file, category, description.trim()), 'Private draft uploaded. Review it before sharing.')) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  async function open(doc: StaffJourneyDocument) {
    if (busy) return;
    const request = ++previewRequest.current;
    setBusy(true); setError(null);
    try { const blob = await fetchStaffJourneyDocumentContent(journeyId, doc.id); if (request === previewRequest.current) setPreview({ doc, blob }); }
    catch (failure) { if (request === previewRequest.current) { setPreview(null); setError(journeyDocumentError(failure)); reload(); } }
    finally { if (request === previewRequest.current) setBusy(false); }
  }
  async function download(doc: StaffJourneyDocument) {
    const blob = await fetchStaffJourneyDocumentContent(journeyId, doc.id);
    downloadPdfBlob(blob, doc.filename || 'journey-document');
  }
  const privateDrafts = rows.filter((row) => row.kind === 'staff_shared');
  const requests = rows.filter((row) => row.kind === 'requested_upload');
  const fileIssue = selectedFileIssue(file);

  if (role !== 'superadmin' && role !== 'agent') return null;
  return <section aria-label="Journey documents" className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
    <div><h2 className="text-lg font-semibold text-zinc-900">Journey documents</h2>
      <p className="mt-1 text-sm text-zinc-600">Files stay private until reviewed and explicitly shared with this seller.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" className="underline" onClick={reload}>Reload</button></p>}
    {notice && <p role="status" className="text-sm text-zinc-700">{notice}</p>}
    {loading ? <p role="status" className="text-sm text-zinc-600">Loading journey documents…</p> : <>
      <div className="space-y-3 border-t border-zinc-200 pt-5">
        <h3 className="font-semibold">Upload a private file</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Type <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm">Description <input value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input id="journey-document-file" ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={busy}
            aria-describedby="journey-document-upload-help" className="peer sr-only"
            onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }} />
          <label htmlFor="journey-document-file" className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-zinc-400 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 peer-focus-visible:ring-2 peer-focus-visible:ring-primarycolor peer-disabled:cursor-not-allowed peer-disabled:opacity-50">Select PDF or image to upload</label>
          <span role="status" className="max-w-full break-all text-sm font-medium text-zinc-700">{file ? `${file.name} (${fileSize(file.size)})` : 'No file selected'}</span>
        </div>
        <p id="journey-document-upload-help" className="text-xs text-zinc-600">PDF, JPEG, PNG, or WebP; maximum 10 MB. Files stay private until separately reviewed and shared.</p>
        {fileIssue && <p role="alert" className="text-sm text-red-700">{fileIssue}</p>}
        <p className="text-xs text-zinc-600">{busy ? 'Uploading or completing another document action…' : !file ? 'Select a valid file to enable Upload privately.' : fileIssue ? 'Choose a valid file to enable Upload privately.' : 'Ready to upload privately.'}</p>
        <button type="button" disabled={busy || !file || !!fileIssue} onClick={() => void upload()} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Working…' : 'Upload privately'}</button>
      </div>
      <div className="space-y-3 border-t border-zinc-200 pt-5">
        <h3 className="font-semibold">Staff files</h3>
        {privateDrafts.length === 0 && <p className="text-sm text-zinc-600">No files uploaded for this journey.</p>}
        {privateDrafts.map((doc) => <div key={doc.id} className="rounded-xl border border-zinc-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="break-words text-sm font-semibold">{doc.filename || doc.description || 'Document'}</p>
            <p className="text-xs text-zinc-600">{doc.category.replaceAll('_', ' ')}</p></div>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">{doc.withdrawn_at ? 'Withdrawn' : doc.shared_at ? 'Shared with seller' : doc.status === 'accepted' ? 'Approved · private' : `${doc.status.replaceAll('_', ' ')} · private`}</span></div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button type="button" disabled={busy} onClick={() => void open(doc)} className="font-semibold text-primarycolor-text underline disabled:opacity-50">View private file</button>
            {(doc.status === 'uploaded' || doc.status === 'under_review') && <>
              <button type="button" disabled={busy} onClick={() => void act(() => reviewStaffJourneyDocument(journeyId, doc.id, doc.revision, 'accepted'), 'Document approved. It is still private until shared.')} className="rounded-lg border border-zinc-300 px-3 py-1 font-semibold disabled:opacity-50">Approve</button>
              <button type="button" disabled={busy} onClick={() => { setPending({ doc, action: 'rejected' }); setReason(''); }} className="rounded-lg border border-zinc-300 px-3 py-1 disabled:opacity-50">Reject</button>
            </>}
            {doc.status === 'accepted' && !doc.shared_at && !doc.withdrawn_at && <button type="button" disabled={busy} onClick={() => void act(() => shareStaffJourneyDocument(journeyId, doc.id, doc.revision), 'Document shared with the seller.')} className="rounded-lg bg-primarycolor px-3 py-1 font-semibold text-primarycolor-foreground disabled:opacity-50">Share with seller</button>}
            {doc.shared_at && !doc.withdrawn_at && <button type="button" disabled={busy} onClick={() => { setPending({ doc, action: 'withdraw' }); setReason(''); }} className="rounded-lg border border-zinc-300 px-3 py-1 disabled:opacity-50">Withdraw sharing</button>}
          </div>
        </div>)}
      </div>
      <div className="space-y-3 border-t border-zinc-200 pt-5">
        <h3 className="font-semibold">Requested from seller</h3>
        <label className="block text-sm">What do you need? <input value={requestDescription} maxLength={1000} onChange={(e) => setRequestDescription(e.target.value)} className="mt-1 block w-full rounded-lg border border-zinc-300 p-2" /></label>
        <button type="button" disabled={busy || requestDescription.trim().length < 3} onClick={() => void act(() => requestSellerJourneyDocument(journeyId, category, requestDescription.trim()), 'Document request sent.')} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Request document</button>
        {requests.map((doc) => <div key={doc.id} className="rounded-xl border border-zinc-200 p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{doc.description || doc.category}</p><span className="text-zinc-600">{doc.status === 'uploaded' ? 'Uploaded by seller · pending review' : doc.status.replaceAll('_', ' ')}</span></div>
          {doc.filename && <><p className="mt-1 text-zinc-600">{doc.filename}</p><button type="button" disabled={busy} onClick={() => void open(doc)} className="mt-2 font-semibold text-primarycolor-text underline disabled:opacity-50">View submitted file</button></>}
          {(doc.status === 'uploaded' || doc.status === 'under_review') && <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void act(() => reviewStaffJourneyDocument(journeyId, doc.id, doc.revision, 'accepted'), 'Seller submission accepted.')} className="rounded-lg border border-zinc-300 px-3 py-1 font-semibold disabled:opacity-50">Accept</button>
            <button type="button" disabled={busy} onClick={() => { setPending({ doc, action: 'replacement_needed' }); setReason(''); }} className="rounded-lg border border-zinc-300 px-3 py-1 disabled:opacity-50">Request replacement</button>
          </div>}
        </div>)}
      </div>
    </>}
    {pending && <div role="dialog" aria-modal="true" aria-label="Confirm document action"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setPending(null);
        if (event.key !== 'Tab') return;
        const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('textarea, button:not([disabled])'));
        if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets[targets.length - 1]?.focus(); }
        else if (!event.shiftKey && document.activeElement === targets[targets.length - 1]) { event.preventDefault(); targets[0]?.focus(); }
      }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5"><h3 className="font-semibold">{pending.action === 'withdraw' ? 'Withdraw sharing?' : 'Send seller a reason'}</h3>
        <label className="block text-sm">Reason <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} className="mt-1 w-full rounded-lg border border-zinc-300 p-2" /></label>
        <div className="flex gap-2"><button type="button" disabled={busy || reason.trim().length < (pending.action === 'withdraw' ? 5 : 1)} onClick={() => {
          const { doc, action } = pending; setPending(null);
          void act(() => action === 'withdraw'
            ? withdrawStaffJourneyDocument(journeyId, doc.id, doc.revision, reason.trim())
            : reviewStaffJourneyDocument(journeyId, doc.id, doc.revision, action, reason.trim()), 'Document updated.');
        }} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground disabled:opacity-50">Confirm</button>
          <button type="button" onClick={() => setPending(null)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm">Cancel</button></div>
      </div>
    </div>}
    {preview && <JourneyDocumentPreview key={preview.doc.id} blob={preview.blob} filename={preview.doc.filename || 'Journey document'} onClose={() => setPreview(null)} onDownload={() => download(preview.doc)} />}
  </section>;
}
