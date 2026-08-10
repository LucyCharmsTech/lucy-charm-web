import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import type {
  AppDocument,
  DocumentAccessUrl,
  DocumentCategory,
  DocumentHistory,
  DocumentResourceType,
  DocumentReviewBody,
  DocumentStatus,
  DocumentVisibility,
  RequestDocumentBody,
  StaffDocument,
} from '@/types/api';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type DocumentErrorCode =
  | 'not_found' // 404 — wrong id, or not yours. Same message for both.
  | 'forbidden' // 403 — staff-only action, or blocked by malware scan
  | 'conflict' // 409 — the document's state does not allow this
  | 'too_large' // 413
  | 'invalid_file' // 422 on an upload
  | 'invalid_input' // 422 on a body
  | 'not_previewable' // 415
  | 'gone' // 410 — purged under the retention policy
  | 'storage_down' // 503
  | 'unknown';

export class DocumentError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly code: DocumentErrorCode,
  ) {
    super(detail);
    this.name = 'DocumentError';
  }
}

function classify(status: number, detail: string): DocumentErrorCode {
  switch (status) {
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 410:
      return 'gone';
    case 413:
      return 'too_large';
    case 415:
      return 'not_previewable';
    case 503:
      return 'storage_down';
    case 422:
      return detail.toLowerCase().includes('file') ? 'invalid_file' : 'invalid_input';
    default:
      return 'unknown';
  }
}

/** Human copy per error code. 404 deliberately never says "no permission". */
export function documentErrorMessage(error: DocumentError): string {
  switch (error.code) {
    case 'not_found':
      return "This document isn't available.";
    case 'gone':
      return 'This document was deleted under our retention policy.';
    case 'storage_down':
      return 'Document uploads are temporarily unavailable. Please try again shortly.';
    case 'forbidden':
      return error.detail.toLowerCase().includes('scan')
        ? 'This file was blocked by a security scan. Please upload a different copy.'
        : error.detail;
    default:
      // 413/422/409 details are written for the end user — surface them verbatim.
      return error.detail;
  }
}

async function call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const res = await fn();
    return res.data;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status ?? 0;
    const detail = getApiErrorMessage(err);
    throw new DocumentError(status, detail, classify(status, detail));
  }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function fetchDocuments(
  resourceType: DocumentResourceType,
  resourceId: string,
  category?: DocumentCategory,
): Promise<AppDocument[]> {
  return call(() =>
    api.get<AppDocument[]>('/documents', {
      params: { resource_type: resourceType, resource_id: resourceId, category },
    }),
  );
}

export function fetchDocument(id: string): Promise<AppDocument> {
  return call(() => api.get<AppDocument>(`/documents/${id}`));
}

/** Version chain (oldest first), plus the audit trail if the caller is staff. */
export function fetchDocumentHistory(id: string): Promise<DocumentHistory> {
  return call(() => api.get<DocumentHistory>(`/documents/${id}/history`));
}

/** A first upload, with no predecessor. Prefer `uploadDocumentRevision` when a row exists. */
export function uploadDocument(input: {
  file: File;
  resourceType: DocumentResourceType;
  resourceId: string;
  category?: DocumentCategory;
  description?: string;
  expiresAt?: string; // ISO 8601, must be in the future
  visibility?: DocumentVisibility; // staff only; silently downgraded for clients
}): Promise<AppDocument> {
  const form = new FormData();
  form.set('file', input.file);
  form.set('resource_type', input.resourceType);
  form.set('resource_id', input.resourceId);
  if (input.category) form.set('category', input.category);
  if (input.description) form.set('description', input.description);
  if (input.expiresAt) form.set('expires_at', input.expiresAt);
  if (input.visibility) form.set('visibility', input.visibility);
  return call(() =>
    // Override the client-wide JSON default so the browser sets the multipart boundary.
    api.post<AppDocument>('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}

/**
 * Upload against an existing document. Behaviour depends on the target:
 * a file-less request is filled in place (same id, still version 1); anything
 * with a file gets a NEW row at version + 1 and the old row becomes superseded.
 */
export function uploadDocumentRevision(
  id: string,
  file: File,
  expiresAt?: string,
): Promise<AppDocument> {
  const form = new FormData();
  form.set('file', file);
  if (expiresAt) form.set('expires_at', expiresAt);
  return call(() =>
    api.post<AppDocument>(`/documents/${id}/file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}

/** Staff only. Creates a file-less `requested` row the client can see. */
export function requestDocument(body: RequestDocumentBody): Promise<StaffDocument> {
  return call(() => api.post<StaffDocument>('/documents/request', body));
}

/** Staff only. `client_reason` is required unless accepting. */
export function reviewDocument(id: string, body: DocumentReviewBody): Promise<StaffDocument> {
  return call(() => api.post<StaffDocument>(`/documents/${id}/review`, body));
}

/** Staff only. Marks an outstanding request as not forthcoming. */
export function markDocumentMissing(id: string): Promise<StaffDocument> {
  return call(() => api.post<StaffDocument>(`/documents/${id}/missing`));
}

export function deleteDocument(id: string): Promise<AppDocument> {
  return call(() => api.delete<AppDocument>(`/documents/${id}`));
}

// ---------------------------------------------------------------------------
// Signed URLs — bearer credentials. Never cache, store, or log them; mint at
// the moment of use. Every mint writes a server-side audit row for the caller.
// ---------------------------------------------------------------------------

export function mintDownloadUrl(id: string): Promise<DocumentAccessUrl> {
  return call(() => api.get<DocumentAccessUrl>(`/documents/${id}/download`));
}

export function mintPreviewUrl(id: string): Promise<DocumentAccessUrl> {
  return call(() => api.get<DocumentAccessUrl>(`/documents/${id}/preview`));
}

/** Mint a fresh signed URL and trigger a browser download, leaving no URL in the DOM. */
export async function downloadDocumentFile(id: string): Promise<void> {
  const { url, filename } = await mintDownloadUrl(id);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

// ---------------------------------------------------------------------------
// Upload validation — mirrors the server for instant feedback; the server
// stays the authority (it also checks magic bytes, which the browser cannot).
// ---------------------------------------------------------------------------

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** GIF is deliberately absent — it is a listing-photo format, not a document one. */
export const DOCUMENT_ACCEPT: Record<string, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export const DOCUMENT_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a user-facing problem string, or null when the file looks acceptable. */
export function preflightDocumentFile(file: File): string | null {
  if (file.size === 0) return 'That file is empty.';
  if (file.size > DOCUMENT_MAX_BYTES) {
    return `That file is ${formatBytes(file.size)}. The maximum is 10 MB.`;
  }
  const allowed = DOCUMENT_ACCEPT[file.type];
  if (!allowed) return 'Please upload a PDF, JPEG, PNG, or WebP file.';

  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  if (ext && !allowed.includes(ext)) {
    return `A ${file.type} file should not end in ${ext}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

/** Statuses that need something from the client. Drive badge counts off this. */
export const NEEDS_CLIENT_ACTION: readonly DocumentStatus[] = [
  'requested',
  'missing',
  'rejected',
  'replacement_needed',
  'expired',
];

/** Statuses where the API accepts a client upload. `superseded` is deliberately absent. */
export const ACCEPTS_UPLOAD: readonly DocumentStatus[] = [
  'requested',
  'missing',
  'uploaded',
  'under_review',
  'accepted',
  'rejected',
  'replacement_needed',
  'expired',
];

/**
 * Statuses where the UI offers the upload button. Narrower than
 * `ACCEPTS_UPLOAD` as a product choice: an approved document needs no
 * replacement until staff ask again (`replacement_needed`) or it expires.
 */
export const SHOWS_UPLOAD_CTA: readonly DocumentStatus[] = ACCEPTS_UPLOAD.filter(
  (status) => status !== 'accepted',
);

export function isHistoryDocument(d: AppDocument): boolean {
  return d.status === 'superseded';
}

/** The same endpoint returns two shapes; probe for a staff-only key, not the role. */
export function isStaffDocument(d: AppDocument): d is StaffDocument {
  return 'review_note' in d;
}

/**
 * Overdue is a UI concept only: `due_date` is advisory and the server never
 * changes anything when it passes. Never gate the upload control on it.
 */
export function isDocumentOverdue(d: AppDocument): boolean {
  return d.status === 'requested' && Boolean(d.due_date) && new Date(d.due_date!) < new Date();
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  identity: 'ID document',
  proof_of_funds: 'Proof of funds',
  pre_approval: 'Mortgage pre-approval',


  other: 'Document',
};

/** Requests and rejections first — those are the ones needing the user. */
export function sortDocumentsForClient(docs: AppDocument[]): AppDocument[] {
  return [...docs].sort((a, b) => {
    const aNeeds = NEEDS_CLIENT_ACTION.includes(a.status) ? 0 : 1;
    const bNeeds = NEEDS_CLIENT_ACTION.includes(b.status) ? 0 : 1;
    if (aNeeds !== bNeeds) return aNeeds - bNeeds;
    return +new Date(b.created_at) - +new Date(a.created_at);
  });
}
