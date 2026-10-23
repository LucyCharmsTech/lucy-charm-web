import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import SellPage from '@/app/sell/page';
import { afterOnboardingDestination } from '@/lib/sellerReturn';
import { getPostLoginPath } from '@/lib/postLoginRedirect';
import { useAuthStore } from '@/stores/authStore';
import type { SellerJourney } from '@/types/api';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/services/sellerJourneyService', () => ({
  createSellerJourney: jest.fn(),
  fetchSellerJourney: jest.fn(),
  getStoredSellerJourneyId: jest.fn(),
  requestProfessionalReview: jest.fn(),
  resumeSellerJourney: jest.fn(),
  updateSellerJourney: jest.fn(),
  updateSellerJourneyStatus: jest.fn(),
}));

import {
  createSellerJourney,
  fetchSellerJourney,
  getStoredSellerJourneyId,
  requestProfessionalReview,
  resumeSellerJourney,
  updateSellerJourney,
  updateSellerJourneyStatus,
} from '@/services/sellerJourneyService';

const createJourney = createSellerJourney as jest.MockedFunction<
  typeof createSellerJourney
>;
const fetchJourney = fetchSellerJourney as jest.MockedFunction<
  typeof fetchSellerJourney
>;
const storedJourneyId = getStoredSellerJourneyId as jest.MockedFunction<
  typeof getStoredSellerJourneyId
>;
const resumeJourney = resumeSellerJourney as jest.MockedFunction<
  typeof resumeSellerJourney
>;
const requestReview = requestProfessionalReview as jest.MockedFunction<
  typeof requestProfessionalReview
>;
const updateJourney = updateSellerJourney as jest.MockedFunction<
  typeof updateSellerJourney
>;
const updateStatus = updateSellerJourneyStatus as jest.MockedFunction<
  typeof updateSellerJourneyStatus
>;

function journey(overrides: Partial<SellerJourney> = {}): SellerJourney {
  return {
    id: 'journey-1',
    user_id: null,
    anonymous_session_id: 'anonymous-session-1234',
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
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  storedJourneyId.mockReturnValue(null);
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

test('starts with a low-pressure private exploration, not a listing submission', () => {
  render(<SellPage />);
  expect(screen.getByText('What if you sold your home?')).toBeTruthy();
  expect(screen.getByText(/no obligation/i)).toBeTruthy();
  expect(
    screen.getByText(/not submitting or publishing a listing/i),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start exploring' })).toBeTruthy();
});

test('shows a local Zod validation error for an incomplete postal or ZIP code', () => {
  render(<SellPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Start exploring' }));
  fireEvent.change(screen.getByLabelText('Street address *'), {
    target: { value: '123 Main Street' },
  });
  fireEvent.change(screen.getByLabelText('City *'), {
    target: { value: 'Toronto' },
  });
  fireEvent.change(screen.getByLabelText('Province / state *'), {
    target: { value: 'ON' },
  });
  fireEvent.change(screen.getByLabelText('Postal / ZIP code *'), {
    target: { value: 'ZD' },
  });
  fireEvent.click(screen.getByLabelText('My home'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  expect(
    screen.getByText(
      'Enter a complete postal or ZIP code (at least 3 characters).',
    ),
  ).toBeTruthy();
  expect(createJourney).not.toHaveBeenCalled();
});

test('an anonymous visitor saves private answers and sees next steps without a generated Plan', async () => {
  const created = journey();
  const details = journey({ status: 'details_in_progress' });
  const ready = journey({
    status: 'plan_ready',
    selling_timeline: 'Within 3 months',
    property_condition: 'Well maintained',
    renovations_upgrades: 'Kitchen update',
    primary_goal: 'Plan a move',
  });
  createJourney.mockResolvedValue(created);
  updateStatus.mockResolvedValueOnce(details).mockResolvedValueOnce(ready);
  updateJourney.mockResolvedValue(ready);

  render(<SellPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Start exploring' }));
  fireEvent.change(screen.getByLabelText('Street address *'), {
    target: { value: '123 Main Street' },
  });
  fireEvent.change(screen.getByLabelText('City *'), {
    target: { value: 'Toronto' },
  });
  fireEvent.change(screen.getByLabelText('Province / state *'), {
    target: { value: 'ON' },
  });
  fireEvent.change(screen.getByLabelText('Postal / ZIP code *'), {
    target: { value: 'M5V 1A1' },
  });
  fireEvent.click(screen.getByLabelText('My home'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() =>
    expect(createJourney).toHaveBeenCalledWith(
      expect.objectContaining({
        property_address: '123 Main Street',
        relationship_to_property: 'owner',
      }),
    ),
  );
  await waitFor(() =>
    expect(updateStatus).toHaveBeenCalledWith(
      'journey-1',
      'details_in_progress',
    ),
  );

  fireEvent.change(screen.getByLabelText('When might you sell?'), {
    target: { value: 'Within 3 months' },
  });
  fireEvent.change(
    screen.getByLabelText('How would you describe the home’s condition?'),
    { target: { value: 'Well maintained' } },
  );
  fireEvent.change(screen.getByLabelText('Major renovations or upgrades'), {
    target: { value: 'Kitchen update' },
  });
  fireEvent.change(screen.getByLabelText('What matters most about selling?'), {
    target: { value: 'Plan a move' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'See my next steps' }),
  );
  await waitFor(() =>
    expect(updateJourney).toHaveBeenCalledWith(
      'journey-1',
      expect.objectContaining({
        selling_timeline: 'Within 3 months',
        primary_goal: 'Plan a move',
      }),
    ),
  );
  expect(await screen.findByText('Your Seller Explorer summary')).toBeTruthy();
  expect(screen.getByText(/required review and compliance checks/i)).toBeTruthy();
  expect(
    screen.getByText(/Nothing here creates or publishes a listing/i),
  ).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ask Lucy' }).getAttribute('href')).toContain(
    'sellerJourneyId=journey-1',
  );
});

test('refreshing restores saved property and situation fields for an anonymous journey', async () => {
  storedJourneyId.mockReturnValue('journey-1');
  fetchJourney.mockResolvedValue(
    journey({
      status: 'details_in_progress',
      selling_timeline: '3–6 months',
      property_condition: 'Well maintained',
      primary_goal: 'Understand value',
    }),
  );
  render(<SellPage />);
  await waitFor(() => expect(fetchJourney).toHaveBeenCalledWith('journey-1'));
  expect(
    (
      (await screen.findByLabelText(
        'When might you sell?',
      )) as HTMLSelectElement
    ).value,
  ).toBe('3–6 months');
  expect(
    (
      screen.getByLabelText(
        'What matters most about selling?',
      ) as HTMLInputElement
    ).value,
  ).toBe('Understand value');
  fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
  expect(
    ((await screen.findByLabelText('Street address *')) as HTMLInputElement)
      .value,
  ).toBe('123 Main Street');
});

test('saving anonymously offers a mobile sheet, and dismissal keeps device-bound progress', async () => {
  storedJourneyId.mockReturnValue('journey-1');
  fetchJourney.mockResolvedValue(journey({ status: 'plan_ready' }));
  updateStatus.mockResolvedValue(journey({ status: 'paused_inactive' }));
  render(<SellPage />);
  await screen.findByText('Your Seller Explorer summary');
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue later' }));
  await waitFor(() => expect(updateStatus).toHaveBeenCalledWith('journey-1', 'paused_inactive'));
  const dialog = await screen.findByRole('dialog', { name: 'Save your progress to your account' });
  expect(dialog.className).toContain('rounded-t-2xl');
  fireEvent.click(screen.getByRole('button', { name: 'Keep exploring' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(requestReview).not.toHaveBeenCalled();
});

test('save-for-later persists edited situation answers before offering sign-in', async () => {
  storedJourneyId.mockReturnValue('journey-1');
  fetchJourney.mockResolvedValue(journey({ status: 'details_in_progress' }));
  updateJourney.mockResolvedValue(journey({ status: 'details_in_progress', primary_goal: 'Move next spring' }));
  updateStatus.mockResolvedValue(journey({ status: 'paused_inactive', primary_goal: 'Move next spring' }));
  render(<SellPage />);
  fireEvent.change(await screen.findByLabelText('What matters most about selling?'), {
    target: { value: 'Move next spring' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue later' }));
  await waitFor(() => expect(updateJourney).toHaveBeenCalledWith(
    'journey-1', expect.objectContaining({ primary_goal: 'Move next spring' }),
  ));
  expect(await screen.findByRole('dialog', { name: 'Save your progress to your account' })).toBeTruthy();
});

test('notice-link registration preserves the seller return through required onboarding', async () => {
  storedJourneyId.mockReturnValue('journey-1');
  fetchJourney.mockResolvedValue(journey({ status: 'plan_ready' }));
  updateStatus.mockResolvedValue(journey({ status: 'paused_inactive' }));
  render(<SellPage />);
  await screen.findByText('Your Seller Explorer summary');
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue later' }));
  await screen.findByRole('dialog', { name: 'Save your progress to your account' });
  fireEvent.click(screen.getByRole('button', { name: 'Keep exploring' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to save to your account' }));

  expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fsell');
  expect(getPostLoginPath('client', '/sell', false)).toBe('/onboarding');
  expect(afterOnboardingDestination()).toBe('/sell');
  expect(afterOnboardingDestination()).toBe('/');
});

test('signing in resumes the anonymous journey and attaches it through the resume API', async () => {
  storedJourneyId.mockReturnValue('journey-1');
  fetchJourney.mockResolvedValue(journey());
  resumeJourney.mockResolvedValue(
    journey({ user_id: 'user-1', status: 'details_in_progress' }),
  );
  render(<SellPage />);
  await waitFor(() => expect(fetchJourney).toHaveBeenCalled());
  act(() => {
    useAuthStore.setState({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: null,
    });
  });
  await waitFor(() => expect(resumeJourney).toHaveBeenCalledWith('journey-1'));
});

test('failed attachment after account switch hides stale details and offers a fresh exploration', async () => {
  storedJourneyId.mockReturnValue('journey-1');
  fetchJourney.mockResolvedValue(journey({ status: 'plan_ready' }));
  let rejectAttachment!: (reason?: unknown) => void;
  resumeJourney.mockImplementation(() => new Promise((_resolve, reject) => {
    rejectAttachment = reject;
  }));
  render(<SellPage />);
  await screen.findByText('Your Seller Explorer summary');

  act(() => {
    useAuthStore.setState({
      accessToken: 'another-account-token',
      refreshToken: 'another-account-refresh',
      user: {
        user_id: 'another-user',
        email: 'other@example.com',
        first_name: 'Other',
        last_name: 'Seller',
        role: 'client',
      },
    });
  });
  expect(screen.queryByText('Your Seller Explorer summary')).toBeNull();
  expect(screen.getByText('Checking your saved exploration…')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start exploring' })).toBeNull();
  await act(async () => rejectAttachment(new Error('Journey belongs to another account')));
  await screen.findByRole('alert');
  expect(screen.getByText(/Start a new exploration below/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Start exploring' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Start exploring' }));
  expect((screen.getByLabelText('Street address *') as HTMLInputElement).value).toBe('');
  expect(requestReview).not.toHaveBeenCalled();
});

test('anonymous Plan request is dismissible and does not submit after sign-in', async () => {
  storedJourneyId.mockReturnValue('journey-1');
  fetchJourney.mockResolvedValue(journey({ status: 'plan_ready' }));
  requestReview.mockResolvedValue({
    seller_lead_id: 'seller-lead-1',
    seller_journey_id: 'journey-1',
    property_id: 'property-1',
    status: 'consultation_requested',
    assigned_agent_id: null,
    representation_status: 'none',
    created_at: '2026-08-15T00:00:00Z',
  });
  render(<SellPage />);
  await screen.findByText('Your Seller Explorer summary');
  expect(screen.queryByText('Request a staff-prepared Seller Plan')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Request a free Seller Plan' }),
  );
  expect(screen.getByRole('dialog', { name: 'Sign in to request your free Seller Plan' })).toBeTruthy();
  expect(requestReview).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep exploring' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(requestReview).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Request a free Seller Plan' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Fsell');
  expect(requestReview).not.toHaveBeenCalled();
});

test('handoff omits contact fields already known from the signed-in account', async () => {
  useAuthStore.setState({
    accessToken: 'token',
    refreshToken: 'refresh',
    user: {
      user_id: 'user-1',
      email: 'ada@example.com',
      first_name: 'Ada',
      last_name: 'Homeowner',
      role: 'client',
    },
  });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(
    journey({ user_id: 'user-1', status: 'plan_ready' }),
  );
  render(<SellPage />);
  await screen.findByText('Your Seller Explorer summary');
  fireEvent.click(
    screen.getByRole('button', { name: 'Request a free Seller Plan' }),
  );
  expect(screen.queryByLabelText('First name *')).toBeNull();
  expect(screen.queryByLabelText('Email')).toBeNull();
  expect(screen.getByText(/We already have the property/i)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('What would you like help with? *'), {
    target: { value: 'Please help me plan a move.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Seller Plan request' }));
  await waitFor(() => expect(requestReview).toHaveBeenCalledWith('journey-1', {
    first_name: undefined,
    last_name: undefined,
    email: undefined,
    phone: undefined,
    request: 'Please help me plan a move.',
  }));
});
