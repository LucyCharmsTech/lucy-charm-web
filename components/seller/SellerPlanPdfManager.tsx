'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import SellerPlanPdfPreviewDialog from './SellerPlanPdfPreviewDialog';
import { DOCUMENT_MAX_BYTES } from '@/services/documentService';
import type { SellerPlanStaff } from '@/services/sellerService';
import {
  approveSellerPlanPdf, downloadPdfBlob, fetchStaffSellerPlanPdf,
  listSellerPlanPdfVersions, publishSellerPlanPdf, uploadSellerPlanPdf, withdrawSellerPlanPdf,
  type SellerPlanPdfVersion,
} from '@/services/sellerPlanPdfService';

type Action = { kind: 'publish' | 'withdraw'; version: SellerPlanPdfVersion };

function pdfError(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const status = response?.status;
  const detail = response?.data?.detail;
  const safeDetails = new Set([
    'A specific compliance attestation is required',
    'Complete Plan preparation and seller responses first',
    'Stored Plan PDF differs from the verified bytes',
    'Plan has no verified account owner', 'Plan has no authenticated seller owner',
  ]);
  if (status === 401 || status === 403 || status === 404) return 'This Seller Plan PDF is not available to your account. Reload the Plan.';
  if (status === 409 && detail === 'A current approved clean scan of this PDF is required')
    return 'Publication is paused until approved document-safety evidence is available for this exact PDF.';
  if (status === 409 && detail === 'Document safety review blocks this PDF')
    return 'A recorded document-safety state blocks this PDF. Use a different verified version.';
  if ((status === 409 || status === 422) && typeof detail === 'string' && safeDetails.has(detail)) return detail;
  if (status === 409) return 'The PDF, its verification, or Plan progress changed. Reload before trying again.';
  if (status === 413) return 'The PDF is too large. Choose a file under 10 MB.';
  if (status === 422) return 'Check the PDF or form details and try again.';
  if (status === 503) return 'Private document storage is unavailable. Try again later.';
  return error instanceof Error && !status && error.message.startsWith('The PDF response')
    ? error.message : 'Could not complete this PDF action. Please try again.';
}

function prerequisites(plan: SellerPlanStaff) {
  return [
    { label: 'Property and details reviewed', done: plan.property_details_reviewed },
    { label: 'RECO/compliance preparation recorded', done: plan.reco_preparation_recorded },
    { label: 'Manual valuation need decided', done: plan.manual_valuation_needed !== null },
    { label: 'Recommendations and next steps prepared', done: plan.recommendations_prepared },
    { label: 'Seller information request resolved', done: plan.status !== 'needs_information' && (!plan.information_request || Boolean(plan.information_response)) },
  ];
}

export default function SellerPlanPdfManager({ leadId, plan, role, onPlanReload }: {
  leadId: string;
  plan: SellerPlanStaff;
  role: string | undefined;
  onPlanReload: () => Promise<void>;
}) {
  const staff = role === 'agent' || role === 'superadmin';
  const admin = role === 'superadmin';
  const [versions, setVersions] = useState<SellerPlanPdfVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [approvalVersionId, setApprovalVersionId] = useState<string | null>(null);
  const [compliance, setCompliance] = useState('');
  const [pending, setPending] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{ versionId: string; blob: Blob } | null>(null);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const reloadVersions = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listSellerPlanPdfVersions(leadId);
      if (!active.current) return;
      setVersions(rows);
      setPreview(null);
      setError(null);
    } catch (failure) {
      if (!active.current) return;
      setVersions([]);
      setPreview(null);
      setError(pdfError(failure));
    } finally {
      if (active.current) setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!staff) return;
    const timer = window.setTimeout(() => void reloadVersions(), 0);
    return () => window.clearTimeout(timer);
  }, [reloadVersions, staff]);

  async function afterChange(success: string) {
    await Promise.all([reloadVersions(), onPlanReload()]);
    setNotice(success);
  }

  async function act(change: () => Promise<unknown>, success: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await change();
      if (!active.current) return false;
      setApprovalVersionId(null);
      setPending(null);
      setReason('');
      setPreview(null);
      await afterChange(success);
      return true;
    } catch (failure) {
      if (!active.current) return false;
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if (status === 409 || status === 401 || status === 403 || status === 404) {
        setPending(null);
        setApprovalVersionId(null);
        await Promise.all([reloadVersions(), onPlanReload()]);
      }
      setError(pdfError(failure));
      return false;
    } finally {
      if (active.current) setBusy(false);
    }
  }

  async function upload() {
    if (!file) { setError('Choose a PDF to upload.'); return; }
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file ending in .pdf.'); return;
    }
    if (file.size < 1 || file.size > DOCUMENT_MAX_BYTES) {
      setError('Choose a PDF between 1 byte and 10 MB.'); return;
    }
    const saved = await act(() => uploadSellerPlanPdf(leadId, file), 'Private draft uploaded. Sellers cannot see it.');
    if (saved) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function openStaffPdf(version: SellerPlanPdfVersion, download: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await fetchStaffSellerPlanPdf(leadId, version.id);
      if (!active.current) return;
      if (download) downloadPdfBlob(blob, `Seller-Plan-v${version.version_number}.pdf`);
      else setPreview({ versionId: version.id, blob });
    } catch (failure) {
      if (!active.current) return;
      setPreview(null);
      setError(pdfError(failure));
    } finally {
      if (active.current) setBusy(false);
    }
  }

  const checks = prerequisites(plan);
  const readyForApproval = checks.every((item) => item.done);

  if (!staff) return null;
  return <section aria-label="Seller Plan PDF versions" className="space-y-5 rounded-xl border p-4">
    <div>
      <h2 className="text-lg font-semibold">Manual Seller Plan PDFs</h2>
      <p className="text-sm text-zinc-600">Upload and review private PDF drafts here. Compliance approval and publication are separate actions.</p>
      <button type="button" disabled={busy || loading} onClick={() => { void reloadVersions(); void onPlanReload(); }} className="mt-2 text-sm font-semibold underline disabled:opacity-50">Refresh PDF versions</button>
    </div>
    <div aria-label="Publication prerequisites" className="rounded-lg bg-zinc-50 p-3 text-sm">
      <h3 className="font-semibold">Before approval and publication</h3>
      <ul className="mt-2 space-y-1">
        {checks.map((item) => <li key={item.label}>{item.done ? '✓' : '○'} {item.label}</li>)}
      </ul>
      {!readyForApproval && <p className="mt-2 font-medium text-amber-800">Complete the Plan checklist and resolve seller questions first.</p>}
    </div>
    <div className="space-y-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold">Upload a private PDF draft</h3>
      <div className="flex flex-wrap items-center gap-3">
        <input id="seller-plan-pdf-file" ref={fileInput} type="file" accept=".pdf,application/pdf" disabled={busy}
          aria-describedby="seller-plan-pdf-help" className="peer sr-only" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }} />
        <label htmlFor="seller-plan-pdf-file" className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-zinc-400 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 peer-focus-visible:ring-2 peer-focus-visible:ring-primarycolor dark:bg-zinc-800 dark:text-zinc-100">Select PDF to upload</label>
        <span role="status" className="max-w-full break-all text-sm text-zinc-700 dark:text-zinc-300">{file ? file.name : 'No PDF selected'}</span>
      </div>
      <p id="seller-plan-pdf-help" className="text-xs text-zinc-600 dark:text-zinc-300">PDF only, maximum 10 MB. Select a valid PDF to enable Upload. Drafts remain private.</p>
      <button type="button" disabled={busy || !file || file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf') || file.size < 1 || file.size > DOCUMENT_MAX_BYTES}
        onClick={() => void upload()} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Working…' : 'Upload draft PDF'}</button>
    </div>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" className="underline" onClick={() => { void reloadVersions(); void onPlanReload(); }}>Reload</button></p>}
    {notice && <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {loading && <p role="status">Loading PDF versions…</p>}
    {!loading && versions.length === 0 && !error && <p className="text-sm text-zinc-600">No PDF versions uploaded yet.</p>}
    <div className="space-y-4">
      {versions.map((version) => <article key={version.id} className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Version {version.version_number}</h3>
          <span className="rounded bg-zinc-100 px-2 py-1 text-sm font-semibold capitalize">{version.state}</span>
        </div>
        <p className="break-all text-xs text-zinc-600">Stored PDF SHA-256: {version.checksum_sha256}</p>
        {(version.state === 'draft' || version.state === 'approved') && <p id={`seller-plan-safety-${version.id}`} className="text-sm text-zinc-600">
          {version.scan_policy_eligible === true
            ? version.require_clean_scan === false
              ? 'Clean-scan enforcement is off for this environment. Document review is not a malware scan.'
              : 'Approved clean-scan evidence is on file. The server rechecks it before approval and publication.'
            : version.require_clean_scan === false
              ? 'A recorded document-safety state blocks this PDF, even with scan enforcement off.'
              : 'Approval paused: this PDF needs current approved clean-scan evidence.'}
        </p>}
        {version.approved_at && <p className="text-sm">Compliance approved for this version.</p>}
        {version.published_at && <p className="text-sm">Published {new Date(version.published_at).toLocaleString()}.</p>}
        {version.withdrawal_reason && <p className="text-sm">Withdrawal reason: {version.withdrawal_reason}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void openStaffPdf(version, false)} className="rounded border px-3 py-2 text-sm disabled:opacity-50">View version {version.version_number}</button>
          <button type="button" disabled={busy} onClick={() => void openStaffPdf(version, true)} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Download version {version.version_number}</button>
          {admin && version.state === 'draft' && <button type="button" aria-describedby={`seller-plan-safety-${version.id}`} disabled={busy || !readyForApproval || version.scan_policy_eligible !== true} onClick={() => setApprovalVersionId(version.id)} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Review and approve version {version.version_number}</button>}
          {admin && version.state === 'approved' && <button type="button" aria-describedby={`seller-plan-safety-${version.id}`} disabled={busy || !readyForApproval || version.scan_policy_eligible !== true} onClick={() => setPending({ kind: 'publish', version })} className="rounded bg-primarycolor px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Publish version {version.version_number}</button>}
          {admin && version.state === 'published' && <button type="button" disabled={busy} onClick={() => { setReason(''); setPending({ kind: 'withdraw', version }); }} className="rounded border border-red-600 px-3 py-2 text-sm text-red-700 disabled:opacity-50">Withdraw version {version.version_number}</button>}
        </div>
        {approvalVersionId === version.id && admin && <form className="space-y-2 rounded-lg bg-zinc-50 p-3" onSubmit={(event) => {
          event.preventDefault();
          void act(() => approveSellerPlanPdf(leadId, version.id, version.revision, compliance.trim()), 'Compliance approval recorded. The PDF is still private until published.');
        }}>
          <h4 className="font-semibold">Compliance approval for version {version.version_number}</h4>
          <p className="text-sm">Review this exact PDF and record the compliance decision. This is not a file-safety check and does not activate representation.</p>
          <label className="block text-sm">Compliance attestation<textarea className="mt-1 block w-full rounded border p-2" value={compliance} minLength={10} maxLength={1000} required rows={3} onChange={(event) => setCompliance(event.target.value)} /></label>
          <button type="submit" disabled={busy || !readyForApproval || compliance.trim().length < 10} className="rounded bg-primarycolor px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Record compliance approval</button>
        </form>}
      </article>)}
    </div>
    {preview && <SellerPlanPdfPreviewDialog blob={preview.blob}
      filename={`Seller-Plan-v${versions.find((row) => row.id === preview.versionId)?.version_number ?? 'draft'}.pdf`}
      title={`Preview version ${versions.find((row) => row.id === preview.versionId)?.version_number ?? ''}`}
      onClose={() => setPreview(null)} />}
    <ConfirmDialog open={pending !== null} busy={busy} tone={pending?.kind === 'publish' ? 'default' : 'danger'}
      title={pending?.kind === 'publish' ? 'Publish this approved PDF?' : 'Withdraw this published PDF?'}
      description={<span className="block space-y-2 text-sm"><span className="block">{pending?.kind === 'publish' ? 'The owning seller will be notified and can download this exact version.' : 'The seller will lose access when this published version is withdrawn.'}</span>
        {pending?.kind === 'withdraw' && <label className="block">Reason<textarea className="mt-1 block w-full rounded border p-2" value={reason} minLength={5} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></label>}
      </span>}
      confirmLabel={pending?.kind === 'publish' ? 'Publish PDF' : 'Withdraw PDF'}
      onCancel={() => { if (!busy) setPending(null); }}
      onConfirm={() => {
        if (!pending) return;
        if (pending.kind === 'withdraw' && reason.trim().length < 5) { setError('Enter a reason of at least five characters.'); return; }
        const { version } = pending;
        if (pending.kind === 'publish') void act(() => publishSellerPlanPdf(leadId, version.id, version.revision, plan.revision), 'Approved PDF published and seller notified.');
        else void act(() => withdrawSellerPlanPdf(leadId, version.id, version.revision, reason.trim()), 'Published PDF withdrawn. Seller access has ended.');
      }}
    />
  </section>;
}
