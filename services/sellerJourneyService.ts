import api from '@/lib/axios';
import { getOrCreateAnonymousSessionToken } from '@/lib/anonymousSession';
import { ANONYMOUS_SESSION_HEADER } from '@/types/api';
import type {
  SellerJourney,
  SellerJourneyCreateRequest,
  SellerJourneyStatus,
  SellerJourneyUpdateRequest,
  ProfessionalReview,
  ProfessionalReviewCreateRequest,
} from '@/types/api';

const JOURNEY_STORAGE_KEY = 'lucy-seller-explorer-journey-id';

function journeyHeaders(): Record<string, string> {
  const token = getOrCreateAnonymousSessionToken();
  return token ? { [ANONYMOUS_SESSION_HEADER]: token } : {};
}

export function getStoredSellerJourneyId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(JOURNEY_STORAGE_KEY);
}

export function storeSellerJourneyId(journeyId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(JOURNEY_STORAGE_KEY, journeyId);
  }
}

export async function createSellerJourney(
  payload: SellerJourneyCreateRequest,
): Promise<SellerJourney> {
  const response = await api.post<SellerJourney>('/seller-journeys/', payload, {
    headers: journeyHeaders(),
  });
  storeSellerJourneyId(response.data.id);
  return response.data;
}

export async function fetchSellerJourney(
  journeyId: string,
): Promise<SellerJourney> {
  const response = await api.get<SellerJourney>(
    `/seller-journeys/${journeyId}`,
    {
      headers: journeyHeaders(),
    },
  );
  return response.data;
}

export async function updateSellerJourney(
  journeyId: string,
  payload: SellerJourneyUpdateRequest,
): Promise<SellerJourney> {
  const response = await api.patch<SellerJourney>(
    `/seller-journeys/${journeyId}`,
    payload,
    {
      headers: journeyHeaders(),
    },
  );
  return response.data;
}

export async function updateSellerJourneyStatus(
  journeyId: string,
  status: SellerJourneyStatus,
): Promise<SellerJourney> {
  const response = await api.patch<SellerJourney>(
    `/seller-journeys/${journeyId}/status`,
    { status },
    { headers: journeyHeaders() },
  );
  return response.data;
}

export async function resumeSellerJourney(
  journeyId: string,
): Promise<SellerJourney> {
  const response = await api.post<SellerJourney>(
    `/seller-journeys/${journeyId}/resume`,
    {},
    { headers: journeyHeaders() },
  );
  storeSellerJourneyId(response.data.id);
  return response.data;
}

export async function requestProfessionalReview(
  journeyId: string,
  payload: ProfessionalReviewCreateRequest,
): Promise<ProfessionalReview> {
  const response = await api.post<ProfessionalReview>(
    `/seller-journeys/${journeyId}/professional-review`,
    payload,
    { headers: journeyHeaders() },
  );
  return response.data;
}
