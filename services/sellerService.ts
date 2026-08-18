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
