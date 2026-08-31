/**
 * Client-side service for Property Checkup — the instant rules-based
 * buyer intelligence card, its buyer actions, and Deeper Property Review
 * requests.
 *
 * The Checkup itself needs no auth (backend spec A3: "Do not make the user
 * sign in merely to see the basic instant Checkup"). Saving a question,
 * adding a showing question, and requesting a Deeper Review all require a
 * signed-in caller — the shared Axios instance attaches the bearer token
 * automatically when one exists.
 */

import api from '@/lib/axios';
import type {
  PropertyCheckup,
  PropertyCheckupQuestion,
  PropertyCheckupQuestionCreateRequest,
  PropertyReviewRequest,
  PropertyReviewRequestCreateRequest,
  PropertyReviewRequestStaff,
  PropertyReviewRequestAssignRequest,
  PropertyReviewRequestRespondRequest,
} from '@/types/api';

export async function fetchPropertyCheckup(listingId: string): Promise<PropertyCheckup> {
  const res = await api.get<PropertyCheckup>(`/property_checkup/listing/${listingId}`);
  return res.data;
}

export async function addPropertyCheckupQuestion(
  payload: PropertyCheckupQuestionCreateRequest,
): Promise<PropertyCheckupQuestion> {
  const res = await api.post<PropertyCheckupQuestion>('/property_checkup/questions', payload);
  return res.data;
}

/**
 * Everything the caller has already actioned on this listing — saved
 * questions plus showing-questions still pending. Used to restore the
 * Checkup panel's button states after a page refresh.
 */
export async function fetchMyCheckupQuestions(
  listingId: string,
): Promise<PropertyCheckupQuestion[]> {
  const res = await api.get<PropertyCheckupQuestion[]>(
    `/property_checkup/listing/${listingId}/my_questions`,
  );
  return res.data;
}

export async function fetchShowingQuestions(
  listingId: string,
): Promise<PropertyCheckupQuestion[]> {
  const res = await api.get<PropertyCheckupQuestion[]>(
    `/property_checkup/listing/${listingId}/showing_questions`,
  );
  return res.data;
}

/**
 * Removes a saved/showing question. Only works while it is not yet attached
 * to a submitted showing request — the backend refuses (403) once an agent
 * may already be reading it from that showing's record.
 */
export async function deletePropertyCheckupQuestion(questionId: string): Promise<void> {
  await api.delete(`/property_checkup/questions/${questionId}`);
}

export async function requestDeeperReview(
  payload: PropertyReviewRequestCreateRequest,
): Promise<PropertyReviewRequest> {
  const res = await api.post<PropertyReviewRequest>('/property_checkup/review_requests', payload);
  return res.data;
}

export async function fetchMyReviewRequests(): Promise<PropertyReviewRequest[]> {
  const res = await api.get<PropertyReviewRequest[]>('/property_checkup/review_requests/mine');
  return res.data;
}

// ── Staff (agent / superadmin) ───────────────────────────────────────────────

export async function fetchStaffReviewRequests(): Promise<PropertyReviewRequestStaff[]> {
  const res = await api.get<PropertyReviewRequestStaff[]>('/property_checkup/review_requests');
  return res.data;
}

export async function assignReviewRequest(
  requestId: string,
  payload: PropertyReviewRequestAssignRequest,
): Promise<PropertyReviewRequestStaff> {
  const res = await api.patch<PropertyReviewRequestStaff>(
    `/property_checkup/review_requests/${requestId}/assign`,
    payload,
  );
  return res.data;
}

export async function clearReviewRequestCompliance(
  requestId: string,
): Promise<PropertyReviewRequestStaff> {
  const res = await api.patch<PropertyReviewRequestStaff>(
    `/property_checkup/review_requests/${requestId}/compliance`,
    {},
  );
  return res.data;
}

/** Saves/edits the response privately — never visible to the buyer, never
 * gated on compliance. Use `respondToReviewRequest` to actually publish it. */
export async function draftReviewRequestResponse(
  requestId: string,
  payload: PropertyReviewRequestRespondRequest,
): Promise<PropertyReviewRequestStaff> {
  const res = await api.patch<PropertyReviewRequestStaff>(
    `/property_checkup/review_requests/${requestId}/draft`,
    payload,
  );
  return res.data;
}

/** Publishes the response, making it visible to the buyer. The backend
 * refuses (403) until compliance has been cleared on this request. */
export async function respondToReviewRequest(
  requestId: string,
  payload: PropertyReviewRequestRespondRequest,
): Promise<PropertyReviewRequestStaff> {
  const res = await api.patch<PropertyReviewRequestStaff>(
    `/property_checkup/review_requests/${requestId}/respond`,
    payload,
  );
  return res.data;
}
