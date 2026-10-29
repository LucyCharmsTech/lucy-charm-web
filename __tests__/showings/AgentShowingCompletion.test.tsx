import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AgentShowingsPage from '@/app/agent/showings/page';
import { fetchMyAgentProfile } from '@/services/portalService';
import { fetchShowingRequestsByAgent, updateShowingRequest } from '@/services/showingService';
import { getAgentShowingAccess } from '@/services/sellerBuyerShowingService';
import type { ShowingRequest } from '@/types/api';

jest.mock('@/services/portalService', () => ({ fetchMyAgentProfile: jest.fn() }));
jest.mock('@/services/showingService', () => ({
  fetchShowingRequestsByAgent: jest.fn(),
  updateShowingRequest: jest.fn(),
}));
jest.mock('@/services/sellerBuyerShowingService', () => ({ getAgentShowingAccess: jest.fn() }));
jest.mock('@/lib/useLiveShowingRequests', () => ({ useLiveShowingRequests: jest.fn() }));
jest.mock('@/lib/useShowingDeepLink', () => ({
  showingAnchorId: (id: string) => `showing-${id}`,
  useShowingDeepLink: () => null,
}));
jest.mock('@/components/documents/ShowingDocumentsDialog', () => () => null);
jest.mock('@/components/agent/ShowingRescheduleDialog', () => () => null);
jest.mock('@/components/showings/ClientFlaggedQuestionsDialog', () => () => null);

const mockFetchProfile = fetchMyAgentProfile as jest.MockedFunction<typeof fetchMyAgentProfile>;
const mockFetchShowings = fetchShowingRequestsByAgent as jest.MockedFunction<typeof fetchShowingRequestsByAgent>;
const mockUpdateShowing = updateShowingRequest as jest.MockedFunction<typeof updateShowingRequest>;
const mockAccess = getAgentShowingAccess as jest.MockedFunction<typeof getAgentShowingAccess>;

function request(scheduledAt: string): ShowingRequest {
  return {
    id: 'showing-1', user_id: 'buyer-1', listing_id: 'listing-1', agent_id: 'agent-1',
    first_name: 'Ada', last_name: 'Buyer', email: 'ada@example.com', phone: null,
    showing_type: 'in_person', preferred_date: scheduledAt, alternate_date: null,
    duration_minutes: 30, message: null, lead_type: 'buyer', is_pre_approved: false,
    financing_notes: null, referral_source: null, id_verification_requested: false,
    id_verification_status: 'not_requested', id_verification_notes: null,
    identity_document_uploaded: false, status: 'confirmed', confirmed_at: scheduledAt,
    scheduled_at: scheduledAt, proposed_scheduled_at: null, confirmed_by_user_id: 'agent-user-1',
    rescheduled_at: null, agent_notes: null, crm_synced: false,
    feedback_submitted_at: null, feedback_rating: null, feedback_interest_level: null,
    feedback_price_fit: null, feedback_comment: null, feedback_would_offer: null,
    feedback_ai_profile_consent: false, checkup_questions: [], was_duplicate: false,
    created_at: scheduledAt, updated_at: scheduledAt,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchProfile.mockResolvedValue({ id: 'agent-1' } as never);
  mockAccess.mockResolvedValue({ applicable: false, transaction_id: null, policy: null,
    state: 'not_applicable', can_confirm: true, change_explanation: null, requested_time: null });
});

test('Agent confirmation remains disabled until seller access is current', async () => {
  mockFetchShowings.mockResolvedValue([{ ...request(new Date(Date.now() + 60_000).toISOString()),
    status: 'awaiting_confirmation', scheduled_at: null, confirmed_at: null }]);
  mockAccess.mockResolvedValue({ applicable: true, transaction_id: 'transaction-1',
    policy: 'required', state: 'change_requested', can_confirm: false,
    change_explanation: 'Later access needed', requested_time: null });
  render(<AgentShowingsPage />);
  const action = await screen.findByRole('button', { name: 'Confirm' });
  await screen.findByText(/Seller requested a different time/);
  expect((action as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Later access needed/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open represented seller showings' }).getAttribute('href'))
    .toBe('/seller-portal/transaction-1?workspace=showings');
  fireEvent.click(action);
  expect(mockUpdateShowing).not.toHaveBeenCalled();
});

test('future confirmed showing cannot be marked complete from the Agent page', async () => {
  mockFetchShowings.mockResolvedValue([request(new Date(Date.now() + 60_000).toISOString())]);
  render(<AgentShowingsPage />);

  const action = await screen.findByRole('button', { name: 'Mark complete' });
  expect((action as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Available after the scheduled showing time.')).toBeTruthy();
  fireEvent.click(action);
  expect(mockUpdateShowing).not.toHaveBeenCalled();
});

test('elapsed confirmed showing keeps the Agent completion action', async () => {
  const showing = request(new Date(Date.now() - 60_000).toISOString());
  mockFetchShowings.mockResolvedValue([showing]);
  mockUpdateShowing.mockResolvedValue({ ...showing, status: 'completed' });
  render(<AgentShowingsPage />);

  const action = await screen.findByRole('button', { name: 'Mark complete' });
  expect((action as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(action);
  await waitFor(() => expect(mockUpdateShowing).toHaveBeenCalledWith('showing-1', { status: 'completed' }));
});
