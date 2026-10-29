import api from '@/lib/axios';
import { DOCUMENT_MAX_BYTES } from '@/services/documentService';

export type JourneyDocumentStatus = 'requested' | 'missing' | 'uploaded' | 'under_review' | 'accepted' | 'rejected' | 'replacement_needed' | 'expired' | 'superseded';
export type SellerJourneyDocument = {
  id: string;
  category: string;
  description: string | null;
  filename: string | null;
  status: JourneyDocumentStatus;
  shared_at: string | null;
  client_reason: string | null;
};
export type StaffJourneyDocument = SellerJourneyDocument & {
  journey_id: string;
  kind: 'staff_shared' | 'requested_upload';
  revision: number;
  withdrawn_at: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  shared_by_user_id: string | null;
};

const path = (journeyId: string) => `/seller-journeys/${journeyId}`;
const staffPath = (journeyId: string) => `${path(journeyId)}/staff-documents`;
const sharedPath = (journeyId: string) => `${path(journeyId)}/shared-documents`;
const requestPath = (journeyId: string) => `${path(journeyId)}/document-requests`;

export async function listSharedJourneyDocuments(journeyId: string): Promise<SellerJourneyDocument[]> {
  return (await api.get<SellerJourneyDocument[]>(sharedPath(journeyId))).data;
}
export async function listRequestedJourneyDocuments(journeyId: string): Promise<SellerJourneyDocument[]> {
  return (await api.get<SellerJourneyDocument[]>(requestPath(journeyId))).data;
}
export async function getSharedJourneyDocument(journeyId: string, documentId: string): Promise<SellerJourneyDocument> {
  return (await api.get<SellerJourneyDocument>(`${sharedPath(journeyId)}/${documentId}`)).data;
}
export async function listStaffJourneyDocuments(journeyId: string): Promise<StaffJourneyDocument[]> {
  return (await api.get<StaffJourneyDocument[]>(staffPath(journeyId))).data;
}
export async function uploadStaffJourneyDocument(journeyId: string, file: File, category: string, description: string): Promise<StaffJourneyDocument> {
  const body = new FormData();
  body.set('file', file);
  body.set('category', category);
  body.set('description', description);
  return (await api.post<StaffJourneyDocument>(staffPath(journeyId), body, { headers: { 'Content-Type': undefined } })).data;
}
export async function requestSellerJourneyDocument(journeyId: string, category: string, description: string): Promise<StaffJourneyDocument> {
  return (await api.post<StaffJourneyDocument>(`${staffPath(journeyId)}/requests`, { category, description })).data;
}
export async function uploadRequestedJourneyDocument(journeyId: string, documentId: string, file: File): Promise<SellerJourneyDocument> {
  const body = new FormData();
  body.set('file', file);
  return (await api.post<SellerJourneyDocument>(`${requestPath(journeyId)}/${documentId}/file`, body, { headers: { 'Content-Type': undefined } })).data;
}
export async function reviewStaffJourneyDocument(journeyId: string, documentId: string, expectedRevision: number, outcome: 'accepted' | 'rejected' | 'replacement_needed', clientReason?: string): Promise<StaffJourneyDocument> {
  return (await api.post<StaffJourneyDocument>(`${staffPath(journeyId)}/${documentId}/review`, {
    expected_revision: expectedRevision, outcome, client_reason: clientReason || null,
  })).data;
}
export async function shareStaffJourneyDocument(journeyId: string, documentId: string, expectedRevision: number): Promise<StaffJourneyDocument> {
  return (await api.post<StaffJourneyDocument>(`${staffPath(journeyId)}/${documentId}/share`, { expected_revision: expectedRevision })).data;
}
export async function withdrawStaffJourneyDocument(journeyId: string, documentId: string, expectedRevision: number, reason: string): Promise<StaffJourneyDocument> {
  return (await api.post<StaffJourneyDocument>(`${staffPath(journeyId)}/${documentId}/withdraw`, { expected_revision: expectedRevision, reason })).data;
}

async function contentBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const blob = (await api.get<Blob>(url, { responseType: 'blob', signal })).data;
  if (!(blob instanceof Blob) || blob.size < 1 || blob.size > DOCUMENT_MAX_BYTES ||
      !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
    throw new Error('Document content is unavailable or invalid.');
  }
  return blob;
}
export function fetchSharedJourneyDocumentContent(journeyId: string, documentId: string, signal?: AbortSignal): Promise<Blob> {
  return contentBlob(`${sharedPath(journeyId)}/${documentId}/content`, signal);
}
export function fetchStaffJourneyDocumentContent(journeyId: string, documentId: string, signal?: AbortSignal): Promise<Blob> {
  return contentBlob(`${staffPath(journeyId)}/${documentId}/content`, signal);
}

export function journeyDocumentError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 403 || status === 404) return 'This document is no longer available to your account. Refresh the list.';
  if (status === 409) return 'This document changed. Refresh the list before trying again.';
  if (status === 413 || status === 422) return 'Choose a valid PDF or image under the allowed file size.';
  if (status === 503) return 'Document storage is temporarily unavailable. Try again later.';
  return 'Could not complete the document action. Please retry.';
}
