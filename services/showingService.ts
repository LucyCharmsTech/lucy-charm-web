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
