/**
 * Home Value — plan item 4.2.
 */

import api from '@/lib/axios';
import type {
  HomeValueDraftBody,
  HomeValuePublishBody,
  HomeValueRequestBody,
  HomeValueRequestRead,
  HomeValueRequestStaff,
} from '@/types/homeValue';

export async function submitHomeValueRequest(
  payload: HomeValueRequestBody,
): Promise<HomeValueRequestRead> {
  const res = await api.post<HomeValueRequestRead>('/home_value/requests', payload);
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
export async function clearHomeValueCompliance(
  id: string,
): Promise<HomeValueRequestStaff> {
  const res = await api.post<HomeValueRequestStaff>(
    `/home_value/requests/${id}/clear-compliance`,
  );
  return res.data;
}

/**
 * The only step that makes a valuation visible to the person who asked.
 *
 * Refused by the server until compliance is cleared. Every client-visible
 * field is required: a range without its limitations is the "instant valuation
 * number" the scope rules out, merely typed by a person.
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
