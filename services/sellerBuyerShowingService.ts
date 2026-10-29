import api from '@/lib/axios';

export type SellerShowing = {
  id: string;
  source: 'buyer_request' | 'seller_appointment';
  label: string;
  starts_at: string;
  status: 'requested' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
  time_kind?: 'requested' | 'proposed' | 'confirmed' | null;
  access_policy?: 'unset' | 'required' | 'not_required' | null;
  access_state?: 'awaiting_response' | 'approved' | 'admin_exception' | 'change_requested' | 'stale' | 'not_required' | 'unset' | null;
  access_revision?: number | null;
  policy_revision?: number | null;
  association_revision?: number | null;
  schedule_revision?: number | null;
  proposed_time?: string | null;
  can_respond?: boolean;
};

export type ShowingAccessPolicy = { policy: 'unset' | 'required' | 'not_required'; revision: number };
export type ShowingAccessResponse = {
  policy: ShowingAccessPolicy['policy'];
  policy_revision: number;
  state: NonNullable<SellerShowing['access_state']>;
  response_revision: number;
  association_revision: number;
  schedule_revision: number;
  proposed_time: string;
  change_explanation: string | null;
  requested_time: string | null;
  can_respond: boolean;
  can_confirm: boolean;
};
export type AgentShowingAccess = {
  applicable: boolean;
  transaction_id: string | null;
  policy: ShowingAccessPolicy['policy'] | null;
  state: string;
  can_confirm: boolean;
  change_explanation: string | null;
  requested_time: string | null;
};

export type BuyerShowingAssociation = {
  id: string;
  showing_request_id: string;
  listing_id: string;
  transaction_id: string | null;
  same_as_appointment_id: string | null;
  revision: number;
  linked_at: string;
  unlinked_at: string | null;
  shared_at: string | null;
  seller_visible: boolean;
};

export type BuyerShowingAudit = {
  action: string;
  occurred_at: string;
  actor_user_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  event_metadata: Record<string, unknown> | null;
};

const base = (transactionId: string) => `/seller-transactions/${transactionId}`;
const path = (transactionId: string, requestId: string) =>
  `${base(transactionId)}/buyer-showings/${requestId}`;

export async function getShowingAccessPolicy(transactionId: string): Promise<ShowingAccessPolicy> {
  return (await api.get<ShowingAccessPolicy>(`${base(transactionId)}/showing-access-policy`)).data;
}

export async function updateShowingAccessPolicy(transactionId: string, payload: {
  policy: ShowingAccessPolicy['policy']; expected_revision: number; reason: string;
}): Promise<ShowingAccessPolicy> {
  return (await api.put<ShowingAccessPolicy>(`${base(transactionId)}/showing-access-policy`, payload)).data;
}

export async function respondToShowingAccess(transactionId: string, associationId: string,
  action: 'approve' | 'request-change', payload: {
    expected_revision: number; expected_association_revision: number;
    expected_policy_revision: number; expected_schedule_revision: number;
    proposed_time: string; explanation?: string | null; requested_time?: string | null;
  }): Promise<ShowingAccessResponse> {
  return (await api.post<ShowingAccessResponse>(
    `${base(transactionId)}/showings/${associationId}/access/${action}`, payload,
  )).data;
}

export async function getAgentShowingAccess(requestId: string): Promise<AgentShowingAccess> {
  return (await api.get<AgentShowingAccess>(`/showing_requests/${requestId}/seller-access`)).data;
}

export async function getStaffShowingAccess(transactionId: string, requestId: string): Promise<ShowingAccessResponse> {
  return (await api.get<ShowingAccessResponse>(`${path(transactionId, requestId)}/access`)).data;
}

export async function adminShowingAccessException(transactionId: string, requestId: string,
  payload: { expected_revision: number; expected_association_revision: number;
    expected_policy_revision: number; expected_schedule_revision: number;
    proposed_time: string; explanation: string }): Promise<ShowingAccessResponse> {
  return (await api.post<ShowingAccessResponse>(`${path(transactionId, requestId)}/access/admin-exception`, payload)).data;
}

export async function listShowingAccessHistory(transactionId: string, requestId: string): Promise<BuyerShowingAudit[]> {
  return (await api.get<BuyerShowingAudit[]>(`${path(transactionId, requestId)}/access/history`)).data;
}

export async function listSellerShowings(
  transactionId: string,
): Promise<SellerShowing[]> {
  return (await api.get<SellerShowing[]>(`${base(transactionId)}/showings`))
    .data;
}

export async function listBuyerShowingAssociations(
  transactionId: string,
): Promise<BuyerShowingAssociation[]> {
  return (
    await api.get<BuyerShowingAssociation[]>(
      `${base(transactionId)}/buyer-showings`,
    )
  ).data;
}

export async function listBuyerShowingHistory(
  transactionId: string,
  requestId: string,
): Promise<BuyerShowingAudit[]> {
  return (
    await api.get<BuyerShowingAudit[]>(
      `${path(transactionId, requestId)}/history`,
    )
  ).data;
}

export async function associateBuyerShowing(
  transactionId: string,
  requestId: string,
  payload: {
    expected_revision: number;
    reason: string;
    same_as_appointment_id: string | null;
  },
): Promise<BuyerShowingAssociation> {
  return (
    await api.put<BuyerShowingAssociation>(
      path(transactionId, requestId),
      payload,
    )
  ).data;
}

export async function decideBuyerShowing(
  transactionId: string,
  requestId: string,
  action: 'share' | 'withdraw' | 'unlink',
  payload: { expected_revision: number; reason: string },
): Promise<BuyerShowingAssociation> {
  const url = path(transactionId, requestId);
  return (
    action === 'unlink'
      ? await api.delete<BuyerShowingAssociation>(url, { data: payload })
      : await api.post<BuyerShowingAssociation>(`${url}/${action}`, payload)
  ).data;
}

export function buyerShowingError(error: unknown): string {
  const response = (
    error as { response?: { status?: number; data?: { detail?: unknown } } }
  )?.response;
  const detail = response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (response?.status === 409)
    return 'The association changed or conflicts with another showing. Refresh and review it.';
  if (response?.status === 422)
    return 'This exact showing is not eligible for the requested action.';
  if ([401, 403, 404].includes(response?.status ?? 0))
    return 'This showing is no longer available to your account.';
  return 'Could not load or update showing associations. Please try again.';
}
