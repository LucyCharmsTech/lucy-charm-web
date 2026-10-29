import api from '@/lib/axios';
import { DOCUMENT_MAX_BYTES } from '@/services/documentService';

export type SellerPlanPdfState = 'draft' | 'approved' | 'published' | 'superseded' | 'withdrawn';

/** Staff-only fields. Never pass this type into seller-facing components. */
export type SellerPlanPdfVersion = {
  id: string;
  document_id: string;
  version_number: number;
  state: SellerPlanPdfState;
  checksum_sha256: string;
  revision: number;
  scanner_name: string | null;
  scanner_version: string | null;
  scan_evidence_reference: string | null;
  scan_at: string | null;
  scan_result: 'clean' | 'failed' | null;
  verified_by_user_id: string | null;
  verified_at: string | null;
  verification_revoked_at: string | null;
  verification_revoked_by_user_id: string | null;
  verification_revocation_reason: string | null;
  compliance_attestation: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  published_by_user_id: string | null;
  published_at: string | null;
  withdrawn_by_user_id: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  /** Effective server policy and advisory eligibility; mutations recheck both. */
  require_clean_scan: boolean;
  scan_policy_eligible: boolean;
};

/** The only publication metadata returned to the authenticated seller. */
export type SellerPlanPublication = {
  version_id: string;
  version_number: number;
  published_at: string;
  filename: string;
  size_bytes: number;
};

const staffPath = (leadId: string) => `/seller-leads/${leadId}/plan-pdfs`;
const versionPath = (leadId: string, versionId: string) => `${staffPath(leadId)}/${versionId}`;
const sellerPath = (journeyId: string) => `/seller-journeys/${journeyId}/plan-pdf`;

export async function listSellerPlanPdfVersions(leadId: string): Promise<SellerPlanPdfVersion[]> {
  return (await api.get<SellerPlanPdfVersion[]>(staffPath(leadId))).data;
}

export async function uploadSellerPlanPdf(leadId: string, file: File): Promise<SellerPlanPdfVersion> {
  const body = new FormData();
  body.set('file', file);
  return (await api.post<SellerPlanPdfVersion>(staffPath(leadId), body, {
    headers: { 'Content-Type': undefined },
  })).data;
}

async function pdfBlob(path: string, params?: Record<string, string>): Promise<Blob> {
  const blob = (await api.get<Blob>(path, { responseType: 'blob', ...(params ? { params } : {}) })).data;
  if (!(blob instanceof Blob) || blob.size < 1 || blob.size > DOCUMENT_MAX_BYTES || blob.type !== 'application/pdf') {
    throw new Error('The PDF response is unavailable or invalid.');
  }
  return blob;
}

export function fetchStaffSellerPlanPdf(leadId: string, versionId: string): Promise<Blob> {
  return pdfBlob(`${versionPath(leadId, versionId)}/content`);
}

export async function verifySellerPlanPdf(
  leadId: string, versionId: string,
  payload: { expected_revision: number; scanner_name: string; scanner_version: string;
    evidence_reference: string; scan_at: string; result: 'clean' | 'failed' },
): Promise<SellerPlanPdfVersion> {
  return (await api.post<SellerPlanPdfVersion>(`${versionPath(leadId, versionId)}/verification`, payload)).data;
}

export async function approveSellerPlanPdf(
  leadId: string, versionId: string, expectedRevision: number, complianceAttestation: string,
): Promise<SellerPlanPdfVersion> {
  return (await api.post<SellerPlanPdfVersion>(`${versionPath(leadId, versionId)}/approval`, {
    expected_revision: expectedRevision, compliance_attestation: complianceAttestation,
  })).data;
}

export async function publishSellerPlanPdf(
  leadId: string, versionId: string, expectedRevision: number, expectedWorkflowRevision: number,
): Promise<SellerPlanPdfVersion> {
  return (await api.post<SellerPlanPdfVersion>(`${versionPath(leadId, versionId)}/publication`, {
    expected_revision: expectedRevision, expected_workflow_revision: expectedWorkflowRevision,
  })).data;
}

export async function withdrawSellerPlanPdf(
  leadId: string, versionId: string, expectedRevision: number, reason: string,
): Promise<SellerPlanPdfVersion> {
  return (await api.post<SellerPlanPdfVersion>(`${versionPath(leadId, versionId)}/withdrawal`, {
    expected_revision: expectedRevision, reason,
  })).data;
}

export async function revokeSellerPlanPdfVerification(
  leadId: string, versionId: string, expectedRevision: number, reason: string,
): Promise<SellerPlanPdfVersion> {
  return (await api.post<SellerPlanPdfVersion>(`${versionPath(leadId, versionId)}/verification-revocation`, {
    expected_revision: expectedRevision, reason,
  })).data;
}

export async function fetchPublishedSellerPlan(journeyId: string): Promise<SellerPlanPublication> {
  return (await api.get<SellerPlanPublication>(sellerPath(journeyId))).data;
}

export function fetchPublishedSellerPlanPdf(journeyId: string, expectedVersionId: string): Promise<Blob> {
  return pdfBlob(`${sellerPath(journeyId)}/content`, { expected_version_id: expectedVersionId });
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
