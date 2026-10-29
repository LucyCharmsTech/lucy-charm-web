import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SellerShowings from '@/components/seller/SellerShowings';
import {
  listSellerShowings,
  respondToShowingAccess,
  type SellerShowing,
} from '@/services/sellerBuyerShowingService';

jest.mock('@/services/sellerBuyerShowingService', () => {
  const actual = jest.requireActual('@/services/sellerBuyerShowingService');
  return { ...actual, listSellerShowings: jest.fn(), respondToShowingAccess: jest.fn() };
});

const list = listSellerShowings as jest.MockedFunction<
  typeof listSellerShowings
>;
const respond = respondToShowingAccess as jest.MockedFunction<typeof respondToShowingAccess>;
const row = (
  id: string,
  source: SellerShowing['source'],
  status: SellerShowing['status'],
  starts_at: string,
  label = 'Property showing',
): SellerShowing => ({ id, source, status, starts_at, label });

beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue([]);
});

test('renders seller-safe buyer and offline S5 showings with status and time groups', async () => {
  list.mockResolvedValue([
    row(
      'buyer:association-1',
      'buyer_request',
      'requested',
      '2099-06-01T14:00:00Z',
      'Open house',
    ),
    row(
      'appointment:offline-1',
      'seller_appointment',
      'completed',
      '2020-06-01T14:00:00Z',
    ),
    row(
      'buyer:association-2',
      'buyer_request',
      'cancelled',
      '2020-07-01T14:00:00Z',
    ),
  ]);
  render(<SellerShowings transactionId="transaction-1" />);
  expect(await screen.findByText('Open house')).toBeTruthy();
  expect(screen.getAllByText('Property showing')).toHaveLength(2);
  expect(screen.getByText('Upcoming and proposed')).toBeTruthy();
  expect(screen.getByText('Past and completed')).toBeTruthy();
  expect(screen.getByText(/not confirmed/)).toBeTruthy();
  expect(screen.getByText('Completed')).toBeTruthy();
  expect(screen.getByText('Cancelled')).toBeTruthy();
  expect(
    document.querySelector('[data-showing-id="buyer:association-1"]'),
  ).toBeTruthy();
  expect(
    document.querySelector('[data-showing-id="appointment:offline-1"]'),
  ).toBeTruthy();
  expect(document.body.textContent).not.toContain('buyer@example.com');
  expect(list).toHaveBeenCalledWith('transaction-1');
});

test('uses the backend unified projection without adding private or duplicate rows', async () => {
  list.mockResolvedValue([
    row(
      'buyer:association-1',
      'buyer_request',
      'completed',
      '2020-06-01T14:00:00Z',
    ),
  ]);
  render(<SellerShowings transactionId="transaction-1" />);
  expect(await screen.findAllByText('Property showing')).toHaveLength(1);
  expect(screen.queryByText('Private buyer showing')).toBeNull();
  expect(screen.queryByText('appointment:duplicate')).toBeNull();
});

test('empty, refresh, and lost authorization clear the showing feed', async () => {
  list
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      row(
        'buyer:association-1',
        'buyer_request',
        'confirmed',
        '2099-06-01T14:00:00Z',
      ),
    ])
    .mockRejectedValueOnce({ response: { status: 403 } });
  render(<SellerShowings transactionId="transaction-1" />);
  expect(await screen.findByText(/No showings have been shared/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh showings' }));
  expect(await screen.findByText('Property showing')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh showings' }));
  await waitFor(() =>
    expect(screen.queryByText('Property showing')).toBeNull(),
  );
  expect(screen.getByRole('alert')).toBeTruthy();
});

test('seller confirms exact shared time without changing buyer booking', async () => {
  const shared: SellerShowing = {
    ...row('buyer:association-1', 'buyer_request', 'requested', '2099-06-01T14:00:00Z'),
    time_kind: 'proposed', access_policy: 'required', access_state: 'awaiting_response',
    access_revision: 0, policy_revision: 1, association_revision: 2, schedule_revision: 0,
    proposed_time: '2099-06-01T14:00:00Z', can_respond: true,
  };
  list.mockResolvedValue([shared]);
  respond.mockResolvedValue({ policy: 'required', policy_revision: 1, state: 'approved',
    response_revision: 1, association_revision: 2, schedule_revision: 0,
    proposed_time: shared.proposed_time!, change_explanation: null,
    requested_time: null, can_respond: true, can_confirm: true });
  render(<SellerShowings transactionId="transaction-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm property access for this time' }));
  await waitFor(() => expect(respond).toHaveBeenCalledWith('transaction-1', 'association-1', 'approve', {
    expected_revision: 0, expected_association_revision: 2, expected_policy_revision: 1,
    expected_schedule_revision: 0, proposed_time: '2099-06-01T14:00:00Z',
    explanation: null, requested_time: null,
  }));
  expect(screen.getByText(/Proposed time; the appointment is not confirmed/)).toBeTruthy();
});

test('seller time request explains that it does not change the buyer appointment; staff controls remain hidden', async () => {
  list.mockResolvedValue([{ ...row('buyer:association-2', 'buyer_request', 'requested', '2099-06-01T14:00:00Z'),
    access_policy: 'required', access_state: 'change_requested', access_revision: 1,
    policy_revision: 1, association_revision: 2, schedule_revision: 0,
    proposed_time: '2099-06-01T14:00:00Z', can_respond: true }]);
  render(<SellerShowings transactionId="transaction-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Request a different time' }));
  expect(screen.getByText(/does not change the buyer appointment/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send time request' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Record administrative access exception' })).toBeNull();
});
