import api from '@/lib/axios';

export type PropertyMapping = {
  listing_id: string;
  property_id: string | null;
  mapping_revision: number;
  attested_at: string | null;
  verification_basis: string | null;
  evidence_reference: string | null;
  reason: string | null;
};

export type PublicListingOwnership = {
  transaction_id: string;
  property_id: string;
  internal_listing_id: string | null;
  listing_id: string | null;
  revision: number;
  listing_status: string | null;
  seller_url_visible: boolean;
  suspension_reason: string | null;
  seller_visibility_approved_at: string | null;
};

export type PublicListingOwnershipEvent = {
  action: string;
  occurred_at: string;
  actor_user_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  event_metadata: Record<string, unknown> | null;
};

export type PublicListingOwnershipDetail = {
  ownership: PublicListingOwnership;
  history: PublicListingOwnershipEvent[];
};

export type PropertyAttestationRequest = {
  listing_id: string;
  expected_mapping_revision: number;
  verification_basis: string;
  evidence_reference: string;
  reason: string;
};

export type OwnershipChangeRequest = {
  expected_revision: number;
  reason: string;
};

export type OwnershipLinkRequest = OwnershipChangeRequest & { listing_id: string };

export type OwnershipReassignmentRequest = OwnershipLinkRequest & {
  from_transaction_id: string;
  expected_from_revision: number;
};

const base = (transactionId: string) =>
  `/seller-transactions/${transactionId}/public-listing-ownership`;

export async function fetchPublicListingOwnership(
  transactionId: string,
): Promise<PublicListingOwnershipDetail> {
  const response = await api.get<PublicListingOwnershipDetail>(base(transactionId));
  return response.data;
}

export async function fetchPublicListingPropertyMapping(
  listingId: string,
): Promise<PropertyMapping> {
  const response = await api.get<PropertyMapping>(`/listings/${listingId}/property-mapping`);
  return response.data;
}

export async function attestPublicListingProperty(
  transactionId: string,
  payload: PropertyAttestationRequest,
): Promise<PropertyMapping> {
  const response = await api.post<PropertyMapping>(`${base(transactionId)}/attestation`, payload);
  return response.data;
}

export async function linkPublicListing(
  transactionId: string,
  payload: OwnershipLinkRequest,
): Promise<PublicListingOwnership> {
  const response = await api.put<PublicListingOwnership>(base(transactionId), payload);
  return response.data;
}

export async function unlinkPublicListing(
  transactionId: string,
  payload: OwnershipChangeRequest,
): Promise<PublicListingOwnership> {
  const response = await api.delete<PublicListingOwnership>(base(transactionId), { data: payload });
  return response.data;
}

export async function reassignPublicListing(
  destinationTransactionId: string,
  payload: OwnershipReassignmentRequest,
): Promise<PublicListingOwnership> {
  const response = await api.post<PublicListingOwnership>(
    `${base(destinationTransactionId)}/reassignment`,
    payload,
  );
  return response.data;
}

export async function approvePublicListingVisibility(
  transactionId: string,
  payload: OwnershipChangeRequest,
): Promise<PublicListingOwnership> {
  const response = await api.post<PublicListingOwnership>(
    `${base(transactionId)}/visibility-approval`,
    payload,
  );
  return response.data;
}

export async function revokePublicListingVisibility(
  transactionId: string,
  payload: OwnershipChangeRequest,
): Promise<PublicListingOwnership> {
  const response = await api.post<PublicListingOwnership>(
    `${base(transactionId)}/visibility-revocation`,
    payload,
  );
  return response.data;
}
