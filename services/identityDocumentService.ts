/**
 * Showing identity documents — client upload, staff review.
 *
 * Our 1 September report: *"The system can accept, store and review a client's
 * identity document for a showing. There is no screen for a client to upload
 * one or for staff to review it."* The API is complete; this is the missing
 * connection.
 *
 * **These are identity documents.** Everything here is deliberately narrow:
 * one upload per showing, no listing of file contents anywhere, and the file
 * itself only ever fetched on an explicit action.
 */

import api from '@/lib/axios';
import type {
  ShowingIdentityDocument,
  ShowingIdentityDocumentReview,
} from '@/types/api';

/** The server's own allow-list. Mirrored for instant feedback; it stays the authority. */
export const ACCEPTED_ID_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const ACCEPTED_ID_EXTENSIONS = '.pdf,.jpg,.jpeg,.png';
export const MAX_ID_BYTES = 10 * 1024 * 1024;

export type IdUploadProblem = 'type' | 'size' | 'empty';

/** Mirrors the server's checks so a 10 MB upload is refused before it is sent. */
export function validateIdFile(file: File): IdUploadProblem | null {
  if (file.size === 0) return 'empty';
  if (!ACCEPTED_ID_TYPES.includes(file.type as (typeof ACCEPTED_ID_TYPES)[number])) {
    return 'type';
  }
  if (file.size > MAX_ID_BYTES) return 'size';
  return null;
}

export const ID_UPLOAD_PROBLEM_MESSAGES: Record<IdUploadProblem, string> = {
  type: 'Upload a PDF, JPEG or PNG.',
  size: 'That file is larger than 10 MB. Please upload a smaller one.',
  empty: 'That file is empty.',
};

export async function fetchIdentityDocuments(
  showingRequestId: string,
): Promise<ShowingIdentityDocument[]> {
  const res = await api.get<ShowingIdentityDocument[]>(
    `/showing_requests/${showingRequestId}/identity_documents`,
  );
  return res.data;
}

export async function uploadIdentityDocument(
  showingRequestId: string,
  file: File,
): Promise<ShowingIdentityDocument> {
  const form = new FormData();
  form.set('file', file);
  const res = await api.post<ShowingIdentityDocument>(
    `/showing_requests/${showingRequestId}/identity_documents`,
    form,
    // Unset the client-wide JSON default so the browser sets the multipart
    // boundary itself.
    { headers: { 'Content-Type': undefined } },
  );
  return res.data;
}

export async function reviewIdentityDocument(
  showingRequestId: string,
  documentId: string,
  payload: ShowingIdentityDocumentReview,
): Promise<ShowingIdentityDocument> {
  const res = await api.patch<ShowingIdentityDocument>(
    `/showing_requests/${showingRequestId}/identity_documents/${documentId}`,
    payload,
  );
  return res.data;
}

/**
 * Open the document in a new tab.
 *
 * Fetched as a blob rather than linked directly, because the route is
 * authenticated with a bearer token and a plain `<a href>` sends no header.
 * The object URL is revoked on a timer so it does not linger as a way back to
 * an identity document after the tab is closed.
 *
 * The server records `viewed_at` and `viewed_by_user_id` on this call, so
 * every look at a document is auditable.
 */
export async function openIdentityDocument(
  showingRequestId: string,
  documentId: string,
): Promise<void> {
  const res = await api.get<Blob>(
    `/showing_requests/${showingRequestId}/identity_documents/${documentId}/file`,
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(res.data);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Long enough for the tab to load, short enough not to leave a handle around.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
