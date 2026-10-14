/**
 * Home Value — plan item 4.2.
 */

import api from '@/lib/axios';
import { getAnalyticsConsent } from '@/lib/analytics';
import { analyticsAttributionHeaders } from '@/lib/analyticsIdentity';
import type { PaginatedItems } from '@/types/api';
import type {
  HomeValueDraftBody,
  HomeValueAiDraftSuggestions,
  HomeValueEvidence,
  HomeValueEvidenceBody,
  HomeValueFollowUp,
  HomeValueFollowUpStaff,
  HomeValueFollowUpType,
  HomeValuePublishBody,
  HomeValueRequestBody,
  HomeValueRequestRead,
  HomeValueRequestStaff,
  HomeValueReportVersion,
  HomeValueClientReportVersion,
  HomeValueReviewSnapshot,
} from '@/types/homeValue';

export async function submitHomeValueRequest(
  payload: HomeValueRequestBody,
): Promise<HomeValueRequestRead> {
  const res = await api.post<HomeValueRequestRead>('/home_value/requests', payload, {
    headers: analyticsAttributionHeaders(getAnalyticsConsent() === 'accepted'),
  });
  return res.data;
}

export async function fetchMyHomeValueRequests(): Promise<HomeValueRequestRead[]> {
  const res = await api.get<HomeValueRequestRead[]>('/home_value/requests/mine');
  return res.data;
}

export async function fetchMyHomeValueRequest(
  id: string,
): Promise<HomeValueRequestRead> {
  const res = await api.get<HomeValueRequestRead>(`/home_value/requests/mine/${id}`);
  return res.data;
}


// ── Reviewer ─────────────────────────────────────────────────────────────────
// Plan item 4.2's reviewer workflow: "a person sets range and limitations,
// approves publication on the backend, drafts stay private."

export async function fetchStaffHomeValueRequests(): Promise<HomeValueRequestStaff[]> {
  const res = await api.get<HomeValueRequestStaff[]>('/home_value/requests');
  return res.data;
}

export async function fetchHomeValueConsultationContext(followUpId: string): Promise<string> {
  const res = await api.get<{ request_id: string }>(`/home_value/follow-ups/${followUpId}/context`);
  return res.data.request_id;
}

/** Admin only. `null` returns the request to the central brokerage queue. */
export async function assignHomeValueRequest(
  id: string,
  agentId: string | null,
): Promise<HomeValueRequestStaff> {
  const res = await api.patch<HomeValueRequestStaff>(
    `/home_value/requests/${id}/assign`,
    { assigned_agent_id: agentId },
  );
  return res.data;
}

/**
 * Save the working report. Never publishes it, and never gated on compliance —
 * a reviewer has to be able to do the work before it is approved, or approval
 * would be asked for on an empty page.
 */
export async function saveHomeValueDraft(
  id: string,
  draft: HomeValueDraftBody,
): Promise<HomeValueRequestStaff> {
  const res = await api.patch<HomeValueRequestStaff>(
    `/home_value/requests/${id}/draft`,
    draft,
  );
  return res.data;
}

/** Records who approved publication, and when. */
export async function fetchHomeValueReviewSnapshot(id: string): Promise<HomeValueReviewSnapshot> {
  const res = await api.get<HomeValueReviewSnapshot>(`/home_value/requests/${id}/review-snapshot`);
  return res.data;
}

export async function clearHomeValueCompliance(
  id: string, expectedRevision: string,
): Promise<HomeValueRequestStaff> {
  const res = await api.post<HomeValueRequestStaff>(
    `/home_value/requests/${id}/clear-compliance`,
    { expected_revision: expectedRevision },
  );
  return res.data;
}

/**
 * The only step that makes a valuation visible to the person who asked.
 *
 * Refused by the server unless the saved draft and selected evidence still
 * match the exact revision approved by compliance.
 */
export async function publishHomeValueReport(
  id: string,
  report: HomeValuePublishBody,
): Promise<HomeValueRequestStaff> {
  const res = await api.post<HomeValueRequestStaff>(
    `/home_value/requests/${id}/publish`,
    report,
  );
  return res.data;
}

/** Records a neutral acknowledgement of an existing-representation answer. */
export async function acknowledgeHomeValueRepresentationReview(
  id: string,
): Promise<HomeValueRequestStaff> {
  const res = await api.post<HomeValueRequestStaff>(
    `/home_value/requests/${id}/acknowledge-representation-review`,
  );
  return res.data;
}

export async function fetchHomeValueEvidence(id: string): Promise<HomeValueEvidence[]> {
  const res = await api.get<HomeValueEvidence[]>(`/home_value/requests/${id}/evidence`);
  return res.data;
}

export async function createHomeValueEvidence(
  id: string,
  evidence: HomeValueEvidenceBody,
): Promise<HomeValueEvidence> {
  const res = await api.post<HomeValueEvidence>(
    `/home_value/requests/${id}/evidence`,
    evidence,
  );
  return res.data;
}

export async function updateHomeValueEvidence(
  requestId: string,
  evidenceId: string,
  evidence: HomeValueEvidenceBody,
): Promise<HomeValueEvidence> {
  const res = await api.patch<HomeValueEvidence>(
    `/home_value/requests/${requestId}/evidence/${evidenceId}`,
    evidence,
  );
  return res.data;
}

export async function deleteHomeValueEvidence(
  requestId: string,
  evidenceId: string,
): Promise<void> {
  await api.delete(`/home_value/requests/${requestId}/evidence/${evidenceId}`);
}

export async function fetchHomeValueReportVersions(id: string): Promise<HomeValueReportVersion[]> {
  const res = await api.get<HomeValueReportVersion[]>(`/home_value/requests/${id}/versions`);
  return res.data;
}

export async function createHomeValueFollowUp(
  id: string,
  requestType: HomeValueFollowUpType,
  message: string,
): Promise<HomeValueFollowUp> {
  const res = await api.post<HomeValueFollowUp>(
    `/home_value/requests/mine/${id}/follow-ups`,
    { request_type: requestType, message },
  );
  return res.data;
}

export async function fetchMyHomeValueFollowUps(id: string): Promise<HomeValueFollowUp[]> {
  const res = await api.get<HomeValueFollowUp[]>(`/home_value/requests/mine/${id}/follow-ups`);
  return res.data;
}

export async function generateHomeValueAiDraft(
  id: string,
  includeRangeContext = false,
): Promise<HomeValueAiDraftSuggestions> {
  const res = await api.post<HomeValueAiDraftSuggestions>(
    `/home_value/requests/${id}/ai-draft`,
    { include_range_context: includeRangeContext },
  );
  return res.data;
}

export async function fetchHomeValueFollowUps(id: string): Promise<HomeValueFollowUpStaff[]> {
  const res = await api.get<HomeValueFollowUpStaff[]>(`/home_value/requests/${id}/follow-ups`);
  return res.data;
}

export async function updateHomeValueFollowUp(
  requestId: string,
  followUpId: string,
  status: HomeValueFollowUpStaff['status'],
  resolutionNotes: string | null = null,
): Promise<HomeValueFollowUpStaff> {
  const res = await api.patch<HomeValueFollowUpStaff>(
    `/home_value/requests/${requestId}/follow-ups/${followUpId}`,
    { status, resolution_notes: resolutionNotes },
  );
  return res.data;
}

export async function fetchMyHomeValueRequestsPage(page = 1, size = 10): Promise<PaginatedItems<HomeValueRequestRead>> {
  const res = await api.get<PaginatedItems<HomeValueRequestRead>>('/home_value/requests/mine/page', { params: { page, size } });
  return res.data;
}

export async function fetchStaffHomeValueRequestsPage(page = 1, size = 10): Promise<PaginatedItems<HomeValueRequestStaff>> {
  const res = await api.get<PaginatedItems<HomeValueRequestStaff>>('/home_value/requests/page', { params: { page, size } });
  return res.data;
}

export async function fetchStaffHomeValueRequest(id: string): Promise<HomeValueRequestStaff> {
  const res = await api.get<HomeValueRequestStaff>(`/home_value/requests/${id}`);
  return res.data;
}

export async function fetchHomeValueEvidencePage(id: string, page = 1, size = 20): Promise<PaginatedItems<HomeValueEvidence>> {
  const res = await api.get<PaginatedItems<HomeValueEvidence>>(`/home_value/requests/${id}/evidence/page`, { params: { page, size } });
  return res.data;
}

export async function fetchHomeValueReportVersionsPage(id: string, page = 1, size = 10): Promise<PaginatedItems<HomeValueReportVersion>> {
  const res = await api.get<PaginatedItems<HomeValueReportVersion>>(`/home_value/requests/${id}/versions/page`, { params: { page, size } });
  return res.data;
}

export async function fetchMyHomeValueVersionsPage(id: string, page = 1, size = 10): Promise<PaginatedItems<HomeValueClientReportVersion>> {
  const res = await api.get<PaginatedItems<HomeValueClientReportVersion>>(`/home_value/requests/mine/${id}/versions/page`, { params: { page, size } });
  return res.data;
}

export async function fetchMyHomeValueFollowUpsPage(id: string, page = 1, size = 10): Promise<PaginatedItems<HomeValueFollowUp>> {
  const res = await api.get<PaginatedItems<HomeValueFollowUp>>(`/home_value/requests/mine/${id}/follow-ups/page`, { params: { page, size } });
  return res.data;
}

export async function fetchHomeValueFollowUpsPage(id: string, page = 1, size = 10): Promise<PaginatedItems<HomeValueFollowUpStaff>> {
  const res = await api.get<PaginatedItems<HomeValueFollowUpStaff>>(`/home_value/requests/${id}/follow-ups/page`, { params: { page, size } });
  return res.data;
}
