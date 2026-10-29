import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import StaffBuyerShowings from '@/components/seller/StaffBuyerShowings';
import {
  listSellerAppointments,
  type SellerAppointment,
} from '@/services/sellerAppointmentService';
import { fetchAllShowingRequestsAdmin, fetchShowingRequestsByAgent } from '@/services/showingService';
import { fetchMyAgentProfile } from '@/services/portalService';
import {
  associateBuyerShowing,
  decideBuyerShowing,
  listBuyerShowingAssociations,
  listBuyerShowingHistory,
  type BuyerShowingAssociation,
} from '@/services/sellerBuyerShowingService';
import type { ShowingRequest } from '@/types/api';

jest.mock('@/services/sellerAppointmentService', () => {
  const actual = jest.requireActual('@/services/sellerAppointmentService');
  return { ...actual, listSellerAppointments: jest.fn() };
});
jest.mock('@/services/showingService', () => ({
  fetchAllShowingRequestsAdmin: jest.fn(),
  fetchShowingRequestsByAgent: jest.fn(),
}));
jest.mock('@/services/portalService', () => ({ fetchMyAgentProfile: jest.fn() }));
jest.mock('@/services/sellerBuyerShowingService', () => {
  const actual = jest.requireActual('@/services/sellerBuyerShowingService');
  return {
    ...actual,
    associateBuyerShowing: jest.fn(),
    decideBuyerShowing: jest.fn(),
    listBuyerShowingAssociations: jest.fn(),
    listBuyerShowingHistory: jest.fn(),
  };
});

const listRequests = fetchAllShowingRequestsAdmin as jest.MockedFunction<
  typeof fetchAllShowingRequestsAdmin
>;
const listAgentRequests = fetchShowingRequestsByAgent as jest.MockedFunction<
  typeof fetchShowingRequestsByAgent
>;
const myAgentProfile = fetchMyAgentProfile as jest.MockedFunction<typeof fetchMyAgentProfile>;
const listAppointments = listSellerAppointments as jest.MockedFunction<
  typeof listSellerAppointments
>;
const listAssociations = listBuyerShowingAssociations as jest.MockedFunction<
  typeof listBuyerShowingAssociations
>;
const associate = associateBuyerShowing as jest.MockedFunction<
  typeof associateBuyerShowing
>;
const decide = decideBuyerShowing as jest.MockedFunction<
  typeof decideBuyerShowing
>;
const history = listBuyerShowingHistory as jest.MockedFunction<
  typeof listBuyerShowingHistory
>;

const request = {
  id: 'request-1',
  listing_id: 'listing-1',
  status: 'completed',
  scheduled_at: '2026-01-02T00:00:00Z',
} as ShowingRequest;
const appointment = {
  id: 'appointment-1',
  transaction_id: 'transaction-1',
  kind: 'showing',
  status: 'completed',
} as SellerAppointment;
const linked = (
  revision = 1,
  shared_at: string | null = null,
): BuyerShowingAssociation => ({
  id: 'association-1',
  showing_request_id: 'request-1',
  listing_id: 'listing-1',
  transaction_id: 'transaction-1',
  same_as_appointment_id: null,
  revision,
  linked_at: '2026-01-01T00:00:00Z',
  unlinked_at: null,
  shared_at,
  seller_visible: shared_at !== null,
});

beforeEach(() => {
  jest.clearAllMocks();
  listRequests.mockResolvedValue({
    items: [request],
    page: 1,
    page_size: 25,
    total: 1,
  });
  myAgentProfile.mockResolvedValue({ id: 'agent-1' } as Awaited<ReturnType<typeof fetchMyAgentProfile>>);
  listAgentRequests.mockResolvedValue([request]);
  listAppointments.mockResolvedValue([appointment]);
  listAssociations.mockResolvedValue([]);
  history.mockResolvedValue([]);
});

test('seller cannot load staff association controls', () => {
  const { rerender } = render(
    <StaffBuyerShowings transactionId="transaction-1" role="client" />,
  );
  expect(
    screen.queryByRole('button', { name: 'Associate privately' }),
  ).toBeNull();
  rerender(<StaffBuyerShowings transactionId="transaction-1" role="seller" />);
  expect(listRequests).not.toHaveBeenCalled();
  expect(listAgentRequests).not.toHaveBeenCalled();
  expect(listAssociations).not.toHaveBeenCalled();
});

test('Agent uses only their own request queue and can associate, share, withdraw, and review history', async () => {
  let current: BuyerShowingAssociation[] = [];
  listAssociations.mockImplementation(async () => current);
  associate.mockImplementation(async () => {
    current = [linked()];
    return current[0];
  });
  decide.mockImplementation(async (_txn, _request, action) => {
    current = [linked(action === 'share' ? 2 : 3,
      action === 'share' ? '2026-01-03T00:00:00Z' : null)];
    return current[0];
  });
  history.mockResolvedValue([{ action: 'seller_buyer_showing.associated',
    occurred_at: '2026-01-01T00:00:00Z', actor_user_id: 'agent-1',
    old_value: null, new_value: { revision: 1 },
    event_metadata: { reason: 'Exact listing checked' } }]);
  render(<StaffBuyerShowings transactionId="transaction-1" role="agent" />);
  expect(await screen.findByText(/your own buyer showing queue/)).toBeTruthy();
  expect(myAgentProfile).toHaveBeenCalledTimes(1);
  expect(listAgentRequests).toHaveBeenCalledWith('agent-1');
  expect(listRequests).not.toHaveBeenCalled();
  fireEvent.change(await screen.findByLabelText('Buyer showing request'), { target: { value: 'request-1' } });
  fireEvent.change(screen.getByLabelText('Audit reason'), { target: { value: 'Exact listing checked' } });
  fireEvent.click(screen.getByRole('button', { name: 'Associate privately' }));
  await waitFor(() => expect(associate).toHaveBeenCalledWith('transaction-1', 'request-1', {
    expected_revision: 0, reason: 'Exact listing checked', same_as_appointment_id: null,
  }));
  expect(await screen.findByText(/Association saved privately/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Unlink association' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Audit reason'), { target: { value: 'Neutral schedule reviewed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Share with seller' }));
  await waitFor(() => expect(decide).toHaveBeenCalledWith('transaction-1', 'request-1', 'share', {
    expected_revision: 1, reason: 'Neutral schedule reviewed',
  }));
  fireEvent.change(screen.getByLabelText('Audit reason'), { target: { value: 'Access revoked' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Withdraw sharing' }));
  await waitFor(() => expect(decide).toHaveBeenCalledWith('transaction-1', 'request-1', 'withdraw', {
    expected_revision: 2, reason: 'Access revoked',
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Review audit history' }));
  expect(await screen.findByText(/seller_buyer_showing.associated/)).toBeTruthy();
});

test('Agent candidate list excludes associations for requests outside their own queue', async () => {
  listAssociations.mockResolvedValue([{ ...linked(), showing_request_id: 'other-agent-request' }]);
  render(<StaffBuyerShowings transactionId="transaction-1" role="agent" />);
  await screen.findByText(/your own buyer showing queue/);
  await screen.findByRole('option', { name: /request-1/ });
  expect(listAgentRequests).toHaveBeenCalledWith('agent-1');
  expect(screen.queryByRole('option', { name: /other-agent-request/ })).toBeNull();
});

test('Super Admin selects an authorized request, associates privately, then separately shares and withdraws', async () => {
  let current: BuyerShowingAssociation[] = [];
  listAssociations.mockImplementation(async () => current);
  associate.mockImplementation(async () => {
    current = [linked()];
    return current[0];
  });
  decide.mockImplementation(async (_txn, _request, action) => {
    current = [
      linked(
        action === 'share' ? 2 : 3,
        action === 'share' ? '2026-01-03T00:00:00Z' : null,
      ),
    ];
    return current[0];
  });
  render(
    <StaffBuyerShowings transactionId="transaction-1" role="superadmin" />,
  );
  fireEvent.change(await screen.findByLabelText('Buyer showing request'), {
    target: { value: 'request-1' },
  });
  fireEvent.change(screen.getByLabelText('Audit reason'), {
    target: { value: 'Exact listing reviewed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Associate privately' }));
  await waitFor(() =>
    expect(associate).toHaveBeenCalledWith('transaction-1', 'request-1', {
      expected_revision: 0,
      reason: 'Exact listing reviewed',
      same_as_appointment_id: null,
    }),
  );
  expect(await screen.findByText(/Association saved privately/)).toBeTruthy();
  expect(screen.getByText(/Private/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Audit reason'), {
    target: { value: 'Share approved' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Share with seller' }));
  await waitFor(() =>
    expect(decide).toHaveBeenCalledWith('transaction-1', 'request-1', 'share', {
      expected_revision: 1,
      reason: 'Share approved',
    }),
  );
  expect(
    await screen.findByText(/Feedback still requires separate approval/),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Audit reason'), {
    target: { value: 'Sharing revoked' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw sharing' }));
  await waitFor(() =>
    expect(decide).toHaveBeenCalledWith(
      'transaction-1',
      'request-1',
      'withdraw',
      { expected_revision: 2, reason: 'Sharing revoked' },
    ),
  );
});

test('verified same visit supplies only an exact S5 appointment ID', async () => {
  associate.mockResolvedValue(linked());
  render(
    <StaffBuyerShowings transactionId="transaction-1" role="superadmin" />,
  );
  fireEvent.change(await screen.findByLabelText('Buyer showing request'), {
    target: { value: 'request-1' },
  });
  fireEvent.click(screen.getByLabelText(/I independently verified/));
  fireEvent.change(screen.getByLabelText('Exact S5 showing appointment'), {
    target: { value: 'appointment-1' },
  });
  fireEvent.change(screen.getByLabelText('Audit reason'), {
    target: { value: 'Same physical visit verified' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Associate privately' }));
  await waitFor(() =>
    expect(associate).toHaveBeenCalledWith('transaction-1', 'request-1', {
      expected_revision: 0,
      reason: 'Same physical visit verified',
      same_as_appointment_id: 'appointment-1',
    }),
  );
});

test('displays backend conflict and historical audit without guessing a replacement revision', async () => {
  associate.mockRejectedValue({
    response: {
      status: 409,
      data: { detail: 'Conflicting showing association' },
    },
  });
  history.mockResolvedValue([
    {
      action: 'seller_buyer_showing.associated',
      occurred_at: '2026-01-01T00:00:00Z',
      actor_user_id: 'admin-1',
      old_value: null,
      new_value: { revision: 1 },
      event_metadata: { reason: 'Reviewed' },
    },
  ]);
  render(
    <StaffBuyerShowings transactionId="transaction-1" role="superadmin" />,
  );
  fireEvent.change(await screen.findByLabelText('Buyer showing request'), {
    target: { value: 'request-1' },
  });
  fireEvent.change(screen.getByLabelText('Audit reason'), {
    target: { value: 'Try exact request' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Associate privately' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Conflicting showing association',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Review audit history' }));
  expect(
    await screen.findByText(/seller_buyer_showing.associated/),
  ).toBeTruthy();
  expect(associate).toHaveBeenCalledTimes(1);
});

test('a late audit response cannot appear under another selected request', async () => {
  listRequests.mockResolvedValue({
    items: [request, { ...request, id: 'request-2' }],
    page: 1,
    page_size: 25,
    total: 2,
  });
  let finish!: (
    events: Awaited<ReturnType<typeof listBuyerShowingHistory>>,
  ) => void;
  history.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <StaffBuyerShowings transactionId="transaction-1" role="superadmin" />,
  );
  fireEvent.change(await screen.findByLabelText('Buyer showing request'), {
    target: { value: 'request-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review audit history' }));
  await waitFor(() =>
    expect(history).toHaveBeenCalledWith('transaction-1', 'request-1'),
  );
  fireEvent.change(screen.getByLabelText('Buyer showing request'), {
    target: { value: 'request-2' },
  });
  await act(async () =>
    finish([
      {
        action: 'old-request-only',
        occurred_at: '2026-01-01T00:00:00Z',
        actor_user_id: null,
        old_value: null,
        new_value: null,
        event_metadata: null,
      },
    ]),
  );
  expect(screen.queryByText('old-request-only')).toBeNull();
});
