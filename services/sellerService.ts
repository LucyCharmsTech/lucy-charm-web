import api from '@/lib/axios';
import type {
  ApiPaginated,
  SellerLead,
  SellerLeadCreateRequest,
  SellerLeadConvertRequest,
  SellerLeadUpdateRequest,
  SellerTransaction,
} from '@/types/api';

export async function createSellerLead(
  payload: SellerLeadCreateRequest,
): Promise<SellerLead> {
  const res = await api.post<SellerLead>('/seller-leads/', payload);
  return res.data;
}

/** Preserve FastAPI's useful validation and authorization detail for staff actions. */
export function sellerApiErrorMessage(error: unknown): string {
  const response = (error as {
    response?: { status?: number; data?: { detail?: unknown } };
  })?.response;
  const detail = response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const issue = item as { loc?: unknown; msg?: unknown };
        if (typeof issue.msg !== 'string') return null;
        const field = Array.isArray(issue.loc) ? issue.loc.at(-1) : null;
        return typeof field === 'string' ? `${field}: ${issue.msg}` : issue.msg;
      })
      .filter((message): message is string => Boolean(message));
    if (messages.length) return messages.join('; ');
  }
  if (response?.status === 401 || response?.status === 403) {
    return 'Your account is not authorized for this action.';
  }
  return 'The request could not be completed.';
}

export async function fetchSellerLeadsAdmin(
  page = 1,
  size = 25,
): Promise<ApiPaginated<SellerLead>> {
  const res = await api.get<ApiPaginated<SellerLead>>('/seller-leads/', {
    params: { page, size },
  });
  return res.data;
}

export async function updateSellerLead(
  leadId: string,
  payload: SellerLeadUpdateRequest,
): Promise<SellerLead> {
  const res = await api.patch<SellerLead>('/seller-leads/' + leadId, payload);
  return res.data;
}

export async function convertSellerLead(
  leadId: string,
  payload: SellerLeadConvertRequest,
): Promise<SellerTransaction> {
  const res = await api.post<SellerTransaction>('/seller-leads/' + leadId + '/convert', payload);
  return res.data;
}

export async function fetchSellerTransactionsAdmin(
  page = 1,
  size = 25,
): Promise<ApiPaginated<SellerTransaction>> {
  const res = await api.get<ApiPaginated<SellerTransaction>>('/seller-transactions/', {
    params: { page, size },
  });
  return res.data;
}

/** E3-A: only currently assigned, active represented portals for this Agent. */
export type AssignedSellerTransaction = {
  transaction_id: string;
  property_address: string;
  property_unit: string | null;
  property_city: string;
  property_region: string;
  current_stage: string;
};

export async function fetchAssignedSellerTransactions(
  page = 1,
  size = 20,
): Promise<ApiPaginated<AssignedSellerTransaction>> {
  const res = await api.get<ApiPaginated<AssignedSellerTransaction>>(
    '/seller-transactions/assigned',
    { params: { page, size } },
  );
  return res.data;
}

export type SellerPortalAccess = {
  transaction_id: string;
  property_id: string;
  property_address: string;
  property_unit: string | null;
  property_city: string;
  property_region: string;
  current_stage: string;
};

export async function fetchMySellerPortals(): Promise<SellerPortalAccess[]> {
  const res = await api.get<SellerPortalAccess[]>('/seller-transactions/mine');
  return res.data;
}

export type SellerPlanStatus = 'requested' | 'in_preparation' | 'needs_information' | 'ready';
export type SellerPlanStaff = {
  seller_lead_id: string;
  canonical_lead_id: string | null;
  seller_journey_id: string;
  assigned_agent_id: string | null;
  status: SellerPlanStatus;
  property_details_reviewed: boolean;
  reco_preparation_recorded: boolean;
  additional_information_requested: boolean;
  manual_valuation_needed: boolean | null;
  recommendations_prepared: boolean;
  information_request: string | null;
  information_response: string | null;
  revision: number;
};
export type SellerPlanSeller = Pick<SellerPlanStaff, 'status' | 'information_request' | 'information_response' | 'revision'>;
export type SellerPlanUpdate = Partial<Pick<SellerPlanStaff,
  'property_details_reviewed' | 'reco_preparation_recorded' |
  'additional_information_requested' | 'manual_valuation_needed' | 'recommendations_prepared' | 'information_request'
>> & { status?: Exclude<SellerPlanStatus, 'ready'>; expected_revision: number };

export async function fetchStaffSellerPlan(sellerLeadId: string): Promise<SellerPlanStaff> {
  const res = await api.get<SellerPlanStaff>(`/seller-leads/${sellerLeadId}/plan-workflow`);
  return res.data;
}

export async function updateStaffSellerPlan(sellerLeadId: string, payload: SellerPlanUpdate): Promise<SellerPlanStaff> {
  const res = await api.patch<SellerPlanStaff>(`/seller-leads/${sellerLeadId}/plan-workflow`, payload);
  return res.data;
}

export async function listStaffSellerPlansForLead(canonicalLeadId: string): Promise<SellerPlanStaff[]> {
  const res = await api.get<SellerPlanStaff[]>(`/seller-plan-workflows/by-canonical-lead/${canonicalLeadId}`);
  return res.data;
}

export async function fetchSellerPlan(journeyId: string): Promise<SellerPlanSeller> {
  const res = await api.get<SellerPlanSeller>(`/seller-journeys/${journeyId}/plan-workflow`);
  return res.data;
}

export async function respondToSellerPlan(journeyId: string, expectedRevision: number, response: string): Promise<SellerPlanSeller> {
  const res = await api.post<SellerPlanSeller>(`/seller-journeys/${journeyId}/plan-workflow/information-response`, {
    expected_revision: expectedRevision,
    response,
  });
  return res.data;
}
