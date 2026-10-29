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
const mockScrollIntoView = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/services/sellerJourneyService', () => ({
  clearStoredSellerJourneyId: jest.fn(),
  createSellerJourney: jest.fn(),
  fetchSellerJourney: jest.fn(),
  getStoredSellerJourneyId: jest.fn(),
  listMySellerJourneys: jest.fn(),
  requestProfessionalReview: jest.fn(),
  resumeSellerJourney: jest.fn(),
  storeSellerJourneyId: jest.fn(),
  updateSellerJourney: jest.fn(),
  updateSellerJourneyStatus: jest.fn(),
}));
jest.mock('@/services/sellerService', () => ({
  fetchSellerPlan: jest.fn(),
  respondToSellerPlan: jest.fn(),
}));
jest.mock('@/services/sellerAppointmentService', () => ({ fetchSellerAppointment: jest.fn() }));
jest.mock('@/services/sellerPlanPdfService', () => ({
  fetchPublishedSellerPlan: jest.fn(),
  fetchPublishedSellerPlanPdf: jest.fn(),
  downloadPdfBlob: jest.fn(),
}));
jest.mock('@/components/documents/PdfCanvasPreview', () => function Preview() { return <p>Secure PDF preview</p>; });
jest.mock('@/components/seller/ExploringSellerDocuments', () => function Documents({ journeyId }: { journeyId: string }) { return <p>Documents for {journeyId}</p>; });
jest.mock('@/components/seller/SellerAppointments', () => function Appointments({ scope }: { scope: { journeyId: string } }) { return <p>Appointments for {scope.journeyId}</p>; });

import { fetchSellerPlan, respondToSellerPlan } from '@/services/sellerService';
import { fetchSellerAppointment } from '@/services/sellerAppointmentService';
import { fetchPublishedSellerPlan, fetchPublishedSellerPlanPdf } from '@/services/sellerPlanPdfService';

import {
  clearStoredSellerJourneyId,
  createSellerJourney,
  fetchSellerJourney,
  getStoredSellerJourneyId,
  listMySellerJourneys,
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
const listJourneys = listMySellerJourneys as jest.MockedFunction<typeof listMySellerJourneys>;
const clearJourneyId = clearStoredSellerJourneyId as jest.MockedFunction<typeof clearStoredSellerJourneyId>;
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
const fetchPlan = fetchSellerPlan as jest.MockedFunction<typeof fetchSellerPlan>;
const fetchAppointment = fetchSellerAppointment as jest.MockedFunction<typeof fetchSellerAppointment>;
const respondPlan = respondToSellerPlan as jest.MockedFunction<typeof respondToSellerPlan>;
const fetchPublication = fetchPublishedSellerPlan as jest.MockedFunction<typeof fetchPublishedSellerPlan>;
const fetchPublicationContent = fetchPublishedSellerPlanPdf as jest.MockedFunction<typeof fetchPublishedSellerPlanPdf>;

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
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: mockScrollIntoView,
  });
  sessionStorage.clear();
  window.history.replaceState({}, '', '/sell');
  storedJourneyId.mockReturnValue(null);
  listJourneys.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
  fetchPlan.mockResolvedValue({ status: 'requested', information_request: null, information_response: null, revision: 0 });
  fetchPublication.mockRejectedValue({ response: { status: 404 } });
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, hasHydrated: true });
});

test('authenticated returning seller can navigate Overview, Plan and journey-specific Documents', async () => {
  useAuthStore.setState({ accessToken: 'account-token', user: { user_id: 'user-1', role: 'client' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(journey({ user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'new' }));
  render(<SellPage />);
  expect(await screen.findByText('Your Seller Explorer summary')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
  expect(screen.getByRole('region', { name: 'Seller overview' })).toBeTruthy();
  expect(screen.getByText('123 Main Street')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Contact the team' }).getAttribute('href')).toBe('/contact?from=sell');
  expect(screen.queryByRole('button', { name: 'Buying' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
  expect(screen.getByText('Documents for journey-1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'My Seller Plan' }));
  expect(screen.getByText('Your Seller Explorer summary')).toBeTruthy();
});

test('an appointment notification opens the exact owned journey appointment view', async () => {
  window.history.replaceState({}, '', '/sell?appointment=appointment-1');
  useAuthStore.setState({ accessToken: 'account-token', user: { user_id: 'user-1', role: 'client' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  fetchAppointment.mockResolvedValue({ id: 'appointment-1', journey_id: 'journey-2' } as Awaited<ReturnType<typeof fetchSellerAppointment>>);
  fetchJourney.mockResolvedValue(journey({ id: 'journey-2', user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'new' }));
  render(<SellPage />);
  expect(await screen.findByText('Appointments for journey-2')).toBeTruthy();
  expect(fetchAppointment).toHaveBeenCalledWith('appointment-1');
  expect(fetchJourney).toHaveBeenCalledWith('journey-2');
  expect(screen.getByRole('button', { name: 'Appointments' }).getAttribute('aria-current')).toBe('page');
});

test('switching between account-owned homes changes the document journey scope', async () => {
  useAuthStore.setState({ accessToken: 'account-token', user: { user_id: 'user-1', role: 'client' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  listJourneys.mockResolvedValue({ items: [
    { id: 'journey-1', property_id: 'property-1', property_address: '123 Main Street', property_unit: null, property_city: 'Toronto', property_region: 'ON', status: 'professional_review_requested', professional_review_status: 'new', created_at: '', updated_at: '' },
    { id: 'journey-2', property_id: 'property-2', property_address: '456 Other Street', property_unit: null, property_city: 'Toronto', property_region: 'ON', status: 'professional_review_requested', professional_review_status: 'new', created_at: '', updated_at: '' },
  ], total: 2, page: 1, page_size: 20 });
  fetchJourney.mockImplementation(async (id) => journey({ id, user_id: 'user-1', property_address: id === 'journey-1' ? '123 Main Street' : '456 Other Street', status: 'professional_review_requested', professional_review_status: 'new' }));
  render(<SellPage />);
  await screen.findByText('Your saved explorations');
  fireEvent.click(screen.getAllByRole('button', { name: 'Review or continue' })[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Documents' }));
  expect(screen.getByText('Documents for journey-1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'My explorations' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Review or continue' })[1]);
  fireEvent.click(await screen.findByRole('button', { name: 'Documents' }));
  expect(screen.getByText('Documents for journey-2')).toBeTruthy();
  expect(screen.queryByText('Documents for journey-1')).toBeNull();
});

test('starts with a low-pressure private exploration, not a listing submission', () => {
  render(<SellPage />);
  expect(screen.getByRole('link', { name: 'Contact the team' }).getAttribute('href')).toBe('/contact?from=sell');
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
  await waitFor(() => expect(resumeJourney).toHaveBeenCalledWith('journey-1'));
  await act(async () => rejectAttachment(new Error('Journey belongs to another account')));
  await screen.findByRole('alert');
  expect(screen.getByText(/Choose one of your account explorations below/i)).toBeTruthy();
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
  const confirmation = await screen.findByRole('status');
  expect(confirmation.textContent).toContain('Your Seller Plan');
  expect(confirmation.textContent).toContain('already submitted');
  expect(confirmation.textContent).toContain('does not create a listing or representation agreement');
  expect(document.activeElement).toBe(confirmation);
  expect(mockScrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  expect(screen.queryByRole('button', { name: 'Submit Seller Plan request' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Request a free Seller Plan' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Update my details' })).toBeTruthy();
  expect(requestReview).toHaveBeenCalledTimes(1);
});

test('an already-submitted Seller Plan stays visibly confirmed after reload', async () => {
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
  resumeJourney.mockResolvedValue(journey({
    user_id: 'user-1',
    status: 'professional_review_requested',
  }));

  render(<SellPage />);

  await screen.findByText('Your Seller Plan');
  const confirmation = screen.getByText('Your Seller Plan').closest('[role="status"]');
  expect(confirmation).not.toBeNull();
  expect(confirmation?.textContent).toContain('already submitted');
  expect(document.activeElement).toBe(confirmation);
  expect(screen.queryByRole('button', { name: 'Request a free Seller Plan' })).toBeNull();
  expect(requestReview).not.toHaveBeenCalled();
});

test('a signed-in seller on another device discovers the submitted Plan and saved property without local storage', async () => {
  useAuthStore.setState({
    accessToken: 'account-token', refreshToken: 'refresh',
    user: { user_id: 'user-1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Seller', role: 'client' },
  });
  listJourneys.mockResolvedValue({
    items: [{
      id: 'journey-1', property_id: 'property-1', property_address: '123 Main Street',
      property_unit: null, property_city: 'Toronto', property_region: 'ON',
      status: 'professional_review_requested', professional_review_status: 'qualified',
      seller_plan_status: 'requested',
      created_at: '2026-08-15T00:00:00Z', updated_at: '2026-08-15T00:00:00Z',
    }], total: 1, page: 1, page_size: 20,
  });
  fetchJourney.mockResolvedValue(journey({
    user_id: 'user-1', status: 'professional_review_requested',
    professional_review_status: 'qualified',
  }));

  render(<SellPage />);
  expect(await screen.findByText('Your saved explorations')).toBeTruthy();
  expect(screen.getByText(/123 Main Street, Toronto, ON/)).toBeTruthy();
  expect(screen.getByText(/Seller Plan: Request received/)).toBeTruthy();
  expect(storedJourneyId).toHaveReturnedWith(null);
  fireEvent.click(screen.getByRole('button', { name: 'Review or continue' }));
  expect(await screen.findByText('Your Seller Plan')).toBeTruthy();
  expect(await screen.findByText('Current status: Request received')).toBeTruthy();
  expect(requestReview).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Update my details' }));
  expect((screen.getByLabelText('Street address *') as HTMLInputElement).value).toBe('123 Main Street');
  expect((screen.getByLabelText('Street address *') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('A little about your situation')).toBeTruthy();
  expect(updateJourney).not.toHaveBeenCalled();
});

test('cross-device restoration shows Ready only for an authorized current PDF publication', async () => {
  useAuthStore.setState({
    accessToken: 'account-token', refreshToken: 'refresh',
    user: { user_id: 'user-1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Seller', role: 'client' },
  });
  listJourneys.mockResolvedValue({
    items: [{
      id: 'journey-1', property_id: 'property-1', property_address: '123 Main Street',
      property_unit: null, property_city: 'Toronto', property_region: 'ON',
      status: 'professional_review_requested', professional_review_status: 'qualified',
      seller_plan_status: 'ready',
      created_at: '2026-08-15T00:00:00Z', updated_at: '2026-08-15T00:00:00Z',
    }], total: 1, page: 1, page_size: 20,
  });
  fetchJourney.mockResolvedValue(journey({
    user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'qualified',
  }));
  fetchPlan.mockResolvedValue({ status: 'ready', information_request: null, information_response: null, revision: 5 });
  fetchPublication.mockResolvedValue({
    version_id: 'version-2', version_number: 2, published_at: '2026-10-26T10:00:00Z',
    filename: 'Seller Plan.pdf', size_bytes: 100,
  });
  render(<SellPage />);
  expect(await screen.findByText('Your saved explorations')).toBeTruthy();
  expect(storedJourneyId).toHaveReturnedWith(null);
  fireEvent.click(screen.getByRole('button', { name: 'Review or continue' }));
  expect(await screen.findByText('Current status: Ready — PDF published')).toBeTruthy();
  expect(screen.getByText('Your completed Seller Plan is available below.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Download Seller Plan PDF' })).toBeTruthy();
  expect(fetchPublication).toHaveBeenCalledWith('journey-1');
});

test('published PDF remains Ready when S2 progress cannot load, with a separate progress error', async () => {
  useAuthStore.setState({ accessToken: 'account-token', user: { user_id: 'user-1', role: 'client' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(journey({ user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'qualified' }));
  fetchPlan.mockRejectedValueOnce(new Error('S2 unavailable'));
  fetchPublication.mockResolvedValueOnce({ version_id: 'version-2', version_number: 2, published_at: '2026-10-26T10:00:00Z', filename: 'Plan.pdf', size_bytes: 100 });
  render(<SellPage />);
  expect(await screen.findByText('Current status: Ready — PDF published')).toBeTruthy();
  expect(screen.getByText(/Current Plan progress could not be loaded/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Download Seller Plan PDF' })).toBeTruthy();
});

test('focus revalidation clears an open preview and withdrawal removes PDF access', async () => {
  useAuthStore.setState({ accessToken: 'account-token', user: { user_id: 'user-1', role: 'client' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(journey({ user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'qualified' }));
  fetchPublication.mockResolvedValueOnce({ version_id: 'version-2', version_number: 2, published_at: '2026-10-26T10:00:00Z', filename: 'Plan.pdf', size_bytes: 100 });
  fetchPublicationContent.mockResolvedValueOnce(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
  render(<SellPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'View Seller Plan PDF' }));
  expect(await screen.findByText('Secure PDF preview')).toBeTruthy();
  fireEvent.focus(window);
  expect(screen.queryByText('Secure PDF preview')).toBeNull();
  expect(await screen.findByText('No published Seller Plan PDF is currently available.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Download Seller Plan PDF' })).toBeNull();
  expect(fetchPublication).toHaveBeenCalledTimes(2);
});

test('a late publication response cannot restore access after focus revalidation', async () => {
  useAuthStore.setState({ accessToken: 'account-token', user: { user_id: 'user-1', role: 'client' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(journey({ user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'qualified' }));
  let resolveOld!: (value: Awaited<ReturnType<typeof fetchPublishedSellerPlan>>) => void;
  fetchPublication.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  render(<SellPage />);
  await waitFor(() => expect(fetchPublication).toHaveBeenCalledTimes(1));
  fireEvent.focus(window);
  expect(await screen.findByText('No published Seller Plan PDF is currently available.')).toBeTruthy();
  resolveOld({ version_id: 'stale-version', version_number: 1, published_at: '2026-10-26T10:00:00Z', filename: 'Old.pdf', size_bytes: 100 });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Download Seller Plan PDF' })).toBeNull());
});

test('workflow ready without an accessible publication does not present a downloadable PDF', async () => {
  useAuthStore.setState({
    accessToken: 'account-token', refreshToken: 'refresh',
    user: { user_id: 'user-1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Seller', role: 'client' },
  });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(journey({
    user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'qualified',
  }));
  fetchPlan.mockResolvedValue({ status: 'ready', information_request: null, information_response: null, revision: 5 });
  render(<SellPage />);
  expect(await screen.findByText('Current status: Published PDF unavailable')).toBeTruthy();
  expect(screen.getByText('Your request remains on file, but no published PDF is currently available.')).toBeTruthy();
  expect(screen.getByText('No published Seller Plan PDF is currently available.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Download Seller Plan PDF' })).toBeNull();
});

test('returning seller sees a specific staff question and can respond without resubmitting the Plan', async () => {
  useAuthStore.setState({
    accessToken: 'account-token', refreshToken: 'refresh',
    user: { user_id: 'user-1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Seller', role: 'client' },
  });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(journey({
    user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'new',
  }));
  fetchPlan.mockResolvedValue({
    status: 'needs_information', information_request: 'What year was the kitchen updated?',
    information_response: null, revision: 4,
  });
  respondPlan.mockResolvedValue({
    status: 'needs_information', information_request: 'What year was the kitchen updated?',
    information_response: '2020', revision: 5,
  });
  render(<SellPage />);
  expect(await screen.findByText('What year was the kitchen updated?')).toBeTruthy();
  expect(screen.getByText('Current status: Information requested')).toBeTruthy();
  expect(screen.getByText('Staff needs a little more information to continue preparing your Seller Plan.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Your response'), { target: { value: '2020' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send response' }));
  await waitFor(() => expect(respondPlan).toHaveBeenCalledWith('journey-1', 4, '2020'));
  expect(requestReview).not.toHaveBeenCalled();
});

test('failed authoritative Plan fetch never labels an old lead stage as current Plan status', async () => {
  useAuthStore.setState({
    accessToken: 'account-token', refreshToken: 'refresh',
    user: { user_id: 'user-1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Seller', role: 'client' },
  });
  storedJourneyId.mockReturnValue('journey-1');
  resumeJourney.mockResolvedValue(journey({
    user_id: 'user-1', status: 'professional_review_requested', professional_review_status: 'qualified',
  }));
  fetchPlan.mockRejectedValueOnce(new Error('unavailable'));
  render(<SellPage />);
  expect(await screen.findByText('Current status: Unavailable')).toBeTruthy();
  expect(screen.getByText('Your Seller Plan')).toBeTruthy();
  expect(screen.queryByText('Current status: Qualified')).toBeNull();
});

test('starting another property is explicit and creates a fresh journey rather than editing an existing request', async () => {
  useAuthStore.setState({
    accessToken: 'account-token', refreshToken: 'refresh',
    user: { user_id: 'user-1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Seller', role: 'client' },
  });
  listJourneys.mockResolvedValue({
    items: [{
      id: 'journey-1', property_id: 'property-1', property_address: '123 Main Street',
      property_unit: null, property_city: 'Toronto', property_region: 'ON',
      status: 'professional_review_requested', professional_review_status: 'consultation_requested',
      created_at: '2026-08-15T00:00:00Z', updated_at: '2026-08-15T00:00:00Z',
    }], total: 1, page: 1, page_size: 20,
  });
  createJourney.mockResolvedValue(journey({ id: 'journey-2', user_id: 'user-1' }));
  updateStatus.mockResolvedValue(journey({ id: 'journey-2', user_id: 'user-1', status: 'details_in_progress' }));
  render(<SellPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Explore another property' }));
  expect(clearJourneyId).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText('Street address *') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Street address *'), { target: { value: '456 New Street' } });
  fireEvent.change(screen.getByLabelText('City *'), { target: { value: 'Toronto' } });
  fireEvent.change(screen.getByLabelText('Province / state *'), { target: { value: 'ON' } });
  fireEvent.change(screen.getByLabelText('Postal / ZIP code *'), { target: { value: 'M5V 1A1' } });
  fireEvent.click(screen.getByLabelText('My home'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(createJourney).toHaveBeenCalledTimes(1));
  expect(updateJourney).not.toHaveBeenCalled();
  expect(requestReview).not.toHaveBeenCalled();
});

test('a failed status transition retries the newly created journey rather than duplicating it', async () => {
  createJourney.mockResolvedValue(journey());
  updateStatus.mockRejectedValueOnce(new Error('temporary failure'))
    .mockResolvedValueOnce(journey({ status: 'details_in_progress' }));
  updateJourney.mockResolvedValue(journey());
  render(<SellPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start exploring' }));
  fireEvent.change(screen.getByLabelText('Street address *'), { target: { value: '123 Main Street' } });
  fireEvent.change(screen.getByLabelText('City *'), { target: { value: 'Toronto' } });
  fireEvent.change(screen.getByLabelText('Province / state *'), { target: { value: 'ON' } });
  fireEvent.change(screen.getByLabelText('Postal / ZIP code *'), { target: { value: 'M5V 1A1' } });
  fireEvent.click(screen.getByLabelText('My home'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText('A little about your situation');
  expect(createJourney).toHaveBeenCalledTimes(1);
  expect(updateJourney).toHaveBeenCalledTimes(1);
  expect(requestReview).not.toHaveBeenCalled();
});

test('account discovery failure blocks accidental new exploration until retry succeeds', async () => {
  useAuthStore.setState({
    accessToken: 'account-token', refreshToken: 'refresh',
    user: { user_id: 'user-1', email: 'ada@example.com', first_name: 'Ada', last_name: 'Seller', role: 'client' },
  });
  listJourneys.mockRejectedValueOnce(new Error('offline'));
  render(<SellPage />);
  expect(await screen.findByText(/could not check your saved explorations/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start exploring' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry saved explorations' }));
  expect(await screen.findByRole('button', { name: 'Start exploring' })).toBeTruthy();
  expect(screen.queryByText(/could not check your saved explorations/i)).toBeNull();
});
