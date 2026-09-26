import { render, screen, waitFor } from '@testing-library/react';
import ClientShowingScheduleSection from '@/components/profile/ClientShowingScheduleSection';
import { fetchMyShowingRequests } from '@/services/showingService';
import { fetchListingById } from '@/services/listingsService';
import type { ShowingRequest } from '@/types/api';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
jest.mock('@/services/showingService', () => ({ fetchMyShowingRequests: jest.fn() }));
jest.mock('@/services/listingsService', () => ({ fetchListingById: jest.fn() }));
jest.mock('@/lib/useLiveShowingRequests', () => ({ useLiveShowingRequests: jest.fn() }));
jest.mock('@/lib/useShowingDeepLink', () => ({
  showingAnchorId: (id: string) => `showing-${id}`,
  useShowingDeepLink: () => null,
}));
jest.mock('@/components/showings/IdentityDocumentUpload', () => ({
  IdentityDocumentUpload: () => null,
}));
jest.mock('@/components/profile/ShowingFeedbackDialog', () => () => null);

const mockFetchShowings = fetchMyShowingRequests as jest.MockedFunction<typeof fetchMyShowingRequests>;
const mockFetchListing = fetchListingById as jest.MockedFunction<typeof fetchListingById>;

function request(overrides: Partial<ShowingRequest> = {}): ShowingRequest {
  return {
    id: 'showing-1', user_id: 'buyer-1', listing_id: 'listing-1', agent_id: 'agent-1',
    first_name: 'Ada', last_name: 'Buyer', email: 'ada@example.com', phone: null,
    showing_type: 'in_person', preferred_date: '2026-10-10T15:00:00Z', alternate_date: null,
    duration_minutes: 30, message: null, lead_type: 'buyer', is_pre_approved: false,
    financing_notes: null, referral_source: null, id_verification_requested: false,
    id_verification_status: 'not_requested', id_verification_notes: null,
    identity_document_uploaded: false, status: 'requested', confirmed_at: null,
    scheduled_at: null, proposed_scheduled_at: null, confirmed_by_user_id: null,
    rescheduled_at: null, agent_notes: null, crm_synced: false,
    feedback_submitted_at: null, feedback_rating: null, feedback_interest_level: null,
    feedback_price_fit: null, feedback_comment: null, feedback_would_offer: null,
    feedback_ai_profile_consent: true, checkup_questions: [], was_duplicate: false,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchListing.mockResolvedValue({ id: 'listing-1', title: '12 Maple Street' } as never);
});

test('an unconfirmed showing is labelled as a request, never as booked or confirmed', async () => {
  mockFetchShowings.mockResolvedValue([request()]);
  render(<ClientShowingScheduleSection />);

  await waitFor(() => expect(screen.getByText('Request received')).toBeTruthy());
  expect(screen.getByText(/Requested time:/)).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/Visit booked|Visit confirmed/i);
});

test('only a confirmed showing is presented as a confirmed visit', async () => {
  mockFetchShowings.mockResolvedValue([
    request({ status: 'confirmed', scheduled_at: '2026-10-11T15:00:00Z', confirmed_at: '2026-10-02T00:00:00Z' }),
  ]);
  render(<ClientShowingScheduleSection />);

  await waitFor(() => expect(screen.getByText('Visit confirmed')).toBeTruthy());
  expect(screen.getByText(/Confirmed for/)).toBeTruthy();
});
