/**
 * Agent + superadmin portal API calls.
 */

import api from '@/lib/axios';
import type {
  AgentProfile,
  ApiListing,
  ApiPaginated,
  ClientIntentListResponse,
} from '@/types/api';

export async function fetchMyAgentProfile(): Promise<AgentProfile> {
  const res = await api.get<AgentProfile>('/agents/me');
  return res.data;
}

/** Paginated active listings for the given agent id (public endpoint; used only after we verified caller owns this agent). */
export async function fetchListingsByAgentId(
  agentId: string,
  page = 1,
  size = 50,
): Promise<ApiPaginated<ApiListing>> {
  const res = await api.get<ApiPaginated<ApiListing>>(
    `/listings/agent/${agentId}`,
    { params: { page, size } },
  );
  return res.data;
}

export async function fetchClientIntentsForListing(
  listingId: string,
): Promise<ClientIntentListResponse> {
  const res = await api.get<ClientIntentListResponse>(
    `/agents/me/listings/${listingId}/client_intents`,
  );
  return res.data;
}

/** Superadmin: browse all listings (paginated). Uses public GET /listings/. */
export async function fetchAllListingsAdmin(
  page = 1,
  size = 24,
): Promise<ApiPaginated<ApiListing>> {
  const res = await api.get<ApiPaginated<ApiListing>>('/listings/', {
    params: { page, size },
  });
  return res.data;
}
