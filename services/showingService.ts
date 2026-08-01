/**
 * Showing-request API calls.
 * Public: POST / (submit)
 * Authenticated: GET /me, GET /agent/:id, GET / (admin), PATCH /:id
 */

import api from '@/lib/axios';
import type {
  ShowingRequest,
  ShowingRequestCreate,
  ShowingRequestFeedbackSubmit,
  ShowingRequestUpdate,
  ShowingVerificationDocument,
  ApiPaginated,
} from '@/types/api';

/** Submit a tour/showing request — works for anonymous and logged-in users. */
export async function submitShowingRequest(
  payload: ShowingRequestCreate,
): Promise<ShowingRequest> {
  const res = await api.post<ShowingRequest>('/showing_requests/', payload);
  return res.data;
}

/** Logged-in client: list their own requests. */
export async function fetchMyShowingRequests(): Promise<ShowingRequest[]> {
  const res = await api.get<ShowingRequest[]>('/showing_requests/me');
  return res.data;
}

/** Agent: list showing requests routed to them. */
export async function fetchShowingRequestsByAgent(agentId: string): Promise<ShowingRequest[]> {
  const res = await api.get<ShowingRequest[]>(`/showing_requests/agent/${agentId}`);
  return res.data;
}

/** Superadmin: full paginated catalog of all requests. */
export async function fetchAllShowingRequestsAdmin(
  page = 1,
  size = 50,
): Promise<ApiPaginated<ShowingRequest>> {
  const res = await api.get<ApiPaginated<ShowingRequest>>('/showing_requests/', {
    params: { page, size },
  });
  return res.data;
}

/** Agent / admin: update status, confirm, add notes. */
export async function updateShowingRequest(
  id: string,
  payload: ShowingRequestUpdate,
): Promise<ShowingRequest> {
  const res = await api.patch<ShowingRequest>(`/showing_requests/${id}`, payload);
  return res.data;
}

/** Logged-in client: submit post-showing feedback. */
export async function submitShowingFeedback(
  id: string,
  payload: ShowingRequestFeedbackSubmit,
): Promise<ShowingRequest> {
  const res = await api.patch<ShowingRequest>(`/showing_requests/${id}/feedback`, payload);
  return res.data;
}

export async function uploadShowingIdentityDocument(showingRequestId: string, file: File): Promise<ShowingVerificationDocument> {
  const body = new FormData();
  body.append('file', file);
  // Drop instance default application/json so the browser sets multipart boundary.
  const res = await api.post<ShowingVerificationDocument>(
    `/showing_requests/${showingRequestId}/identity_documents`,
    body,
    {
      transformRequest: [
        (data, headers) => {
          if (typeof FormData !== 'undefined' && data instanceof FormData) {
            headers.delete('Content-Type');
          }
          return data;
        },
      ],
    },
  );
  return res.data;
}

export async function fetchShowingIdentityDocuments(showingRequestId: string): Promise<ShowingVerificationDocument[]> {
  const res = await api.get<ShowingVerificationDocument[]>(`/showing_requests/${showingRequestId}/identity_documents`);
  return res.data;
}

export async function reviewShowingIdentityDocument(showingRequestId: string, documentId: string, status: 'verified' | 'rejected', review_note?: string): Promise<ShowingVerificationDocument> {
  const res = await api.patch<ShowingVerificationDocument>(`/showing_requests/${showingRequestId}/identity_documents/${documentId}`, { status, review_note });
  return res.data;
}

export async function openShowingIdentityDocument(showingRequestId: string, documentId: string): Promise<void> {
  const res = await api.get(`/showing_requests/${showingRequestId}/identity_documents/${documentId}/file`, { responseType: 'blob' });
  window.open(URL.createObjectURL(res.data), '_blank', 'noopener,noreferrer');
}
