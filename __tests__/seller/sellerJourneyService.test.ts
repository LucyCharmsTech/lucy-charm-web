import type { SellerJourney } from '@/types/api';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
}));
jest.mock('@/lib/anonymousSession', () => ({
  getOrCreateAnonymousSessionToken: () => 'anonymous-session-token-1234',
}));

import {
  createSellerJourney,
  fetchSellerJourney,
  getStoredSellerJourneyId,
  requestProfessionalReview,
  resumeSellerJourney,
  updateSellerJourney,
} from '@/services/sellerJourneyService';
import { sendChatMessage } from '@/services/chatService';
import { convertSellerLead, fetchMySellerPortals } from '@/services/sellerService';
import api from '@/lib/axios';

const mockApi = api as jest.Mocked<typeof api>;

const record: SellerJourney = {
  id: 'journey-1',
  user_id: null,
  anonymous_session_id: 'anonymous-session-token-1234',
  property_id: 'property-1',
  property_address: '123 Main Street',
  property_unit: null,
  property_city: 'Toronto',
  property_region: 'ON',
  property_postal_code: 'M5V 1A1',
  property_country: 'CA',
  relationship_to_property: 'owner',
  selling_timeline: null,
  property_condition: null,
  renovations_upgrades: null,
  primary_goal: null,
  home_value_request_id: null,
  home_value_result_id: null,
  status: 'exploring',
  created_at: '2026-08-15T00:00:00Z',
  updated_at: '2026-08-15T00:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

test('creates an anonymous journey, persists its id, and sends the anonymous ownership token', async () => {
  mockApi.post.mockResolvedValueOnce({ data: record });
  await expect(
    createSellerJourney({
      property_address: '123 Main Street',
      property_city: 'Toronto',
      property_region: 'ON',
      property_postal_code: 'M5V 1A1',
    }),
  ).resolves.toEqual(record);
  expect(mockApi.post).toHaveBeenCalledWith(
    '/seller-journeys/',
    expect.anything(),
    {
      headers: { 'X-Anonymous-Session-Token': 'anonymous-session-token-1234' },
    },
  );
  expect(getStoredSellerJourneyId()).toBe('journey-1');
});

test('uses the same anonymous token to retrieve, update, and attach a journey after login', async () => {
  mockApi.get.mockResolvedValueOnce({ data: record });
  mockApi.patch.mockResolvedValueOnce({ data: record });
  mockApi.post.mockResolvedValueOnce({
    data: { ...record, user_id: 'user-1' },
  });
  await fetchSellerJourney('journey-1');
  await updateSellerJourney('journey-1', { primary_goal: 'Plan a move' });
  await resumeSellerJourney('journey-1');
  expect(mockApi.get).toHaveBeenCalledWith('/seller-journeys/journey-1', {
    headers: { 'X-Anonymous-Session-Token': 'anonymous-session-token-1234' },
  });
  expect(mockApi.patch).toHaveBeenCalledWith(
    '/seller-journeys/journey-1',
    { primary_goal: 'Plan a move' },
    {
      headers: { 'X-Anonymous-Session-Token': 'anonymous-session-token-1234' },
    },
  );
  expect(mockApi.post).toHaveBeenCalledWith(
    '/seller-journeys/journey-1/resume',
    {},
    {
      headers: { 'X-Anonymous-Session-Token': 'anonymous-session-token-1234' },
    },
  );
});

test('submits an explicit professional-review handoff with the same journey ownership token', async () => {
  mockApi.post.mockResolvedValueOnce({
    data: {
      seller_lead_id: 'seller-lead-1',
      seller_journey_id: 'journey-1',
      property_id: 'property-1',
      status: 'consultation_requested',
      assigned_agent_id: null,
      representation_status: 'none',
      created_at: '2026-08-15T00:00:00Z',
    },
  });

  await requestProfessionalReview('journey-1', {
    first_name: 'Ada',
    email: 'ada@example.com',
    request: 'Please help me plan a move.',
  });

  expect(mockApi.post).toHaveBeenCalledWith(
    '/seller-journeys/journey-1/professional-review',
    expect.objectContaining({ request: 'Please help me plan a move.' }),
    {
      headers: { 'X-Anonymous-Session-Token': 'anonymous-session-token-1234' },
    },
  );
});

test('sends a Seller Journey chat request with the journey ownership token', async () => {
  const payload = {
    session_id: 'session-1',
    seller_journey_id: 'journey-1',
    message_text: 'What usually happens during the selling process?',
  };
  mockApi.post.mockResolvedValueOnce({ data: { reply_text: 'General education.' } });

  await sendChatMessage(payload);

  expect(mockApi.post).toHaveBeenCalledWith('/chat/send', payload, {
    timeout: 300_000,
    headers: { 'X-Anonymous-Session-Token': 'anonymous-session-token-1234' },
  });
});

test('converts an offline seller only with explicit representation and compliance approval', async () => {
  mockApi.post.mockResolvedValueOnce({ data: { id: 'transaction-1' } });

  await convertSellerLead('lead-1', {
    representation_type: 'brokerage',
    compliance_approved: true,
  });

  expect(mockApi.post).toHaveBeenCalledWith('/seller-leads/lead-1/convert', {
    representation_type: 'brokerage',
    compliance_approved: true,
  });
});

test('retrieves only the signed-in seller portal entry points', async () => {
  mockApi.get.mockResolvedValueOnce({ data: [{ transaction_id: 'transaction-1' }] });

  await expect(fetchMySellerPortals()).resolves.toEqual([{ transaction_id: 'transaction-1' }]);
  expect(mockApi.get).toHaveBeenCalledWith('/seller-transactions/mine');
});
