import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffShowingFeedback from '@/components/seller/StaffShowingFeedback';
import { listSellerAppointments, type SellerAppointment } from '@/services/sellerAppointmentService';
import {
  actOnShowingFeedback, createShowingFeedback, editShowingFeedback,
  listShowingFeedbackHistory, listStaffShowingFeedback,
  type StaffShowingFeedback as StaffShowingFeedbackDto,
} from '@/services/sellerShowingFeedbackService';
import { listBuyerShowingAssociations, listSellerShowings } from '@/services/sellerBuyerShowingService';

jest.mock('@/services/sellerAppointmentService', () => {
  const actual = jest.requireActual('@/services/sellerAppointmentService');
  return { ...actual, listSellerAppointments: jest.fn() };
});
jest.mock('@/services/sellerShowingFeedbackService', () => {
  const actual = jest.requireActual('@/services/sellerShowingFeedbackService');
  return { ...actual, actOnShowingFeedback: jest.fn(), createShowingFeedback: jest.fn(),
    editShowingFeedback: jest.fn(), listShowingFeedbackHistory: jest.fn(), listStaffShowingFeedback: jest.fn() };
});
jest.mock('@/services/sellerBuyerShowingService', () => {
  const actual = jest.requireActual('@/services/sellerBuyerShowingService');
  return { ...actual, listBuyerShowingAssociations: jest.fn(), listSellerShowings: jest.fn() };
});

const listAppointments = listSellerAppointments as jest.MockedFunction<typeof listSellerAppointments>;
const listFeedback = listStaffShowingFeedback as jest.MockedFunction<typeof listStaffShowingFeedback>;
const listHistory = listShowingFeedbackHistory as jest.MockedFunction<typeof listShowingFeedbackHistory>;
const create = createShowingFeedback as jest.MockedFunction<typeof createShowingFeedback>;
const edit = editShowingFeedback as jest.MockedFunction<typeof editShowingFeedback>;
const act = actOnShowingFeedback as jest.MockedFunction<typeof actOnShowingFeedback>;
const listAssociations = listBuyerShowingAssociations as jest.MockedFunction<typeof listBuyerShowingAssociations>;
const listUnified = listSellerShowings as jest.MockedFunction<typeof listSellerShowings>;

const showing = (id: string, status: SellerAppointment['status'] = 'completed',
  changes: Partial<SellerAppointment> = {}): SellerAppointment => ({
  id, journey_id: null, transaction_id: 'transaction-1', kind: 'showing',
  seller_details: null, status, visible_to_seller: true, property_timezone: 'America/Toronto',
  proposed_at: '2099-06-01T14:00:00Z', scheduled_at: '2099-06-01T14:00:00Z',
  revision: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  ...changes,
});
const record = (status: StaffShowingFeedbackDto['status'], revision = 2,
  changes: Partial<StaffShowingFeedbackDto> = {}): StaffShowingFeedbackDto => ({
  id: 'feedback-1', transaction_id: 'transaction-1', appointment_id: 'showing-1',
  summary: 'Seller-safe summary', status, revision, content_revision: 1,
  approved_content_revision: status === 'published' ? 1 : null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  submitted_at: status === 'draft' ? null : '2026-01-01T00:00:00Z',
  published_at: status === 'published' ? '2026-01-02T00:00:00Z' : null,
  withdrawn_at: null, ...changes,
});

beforeEach(() => {
  jest.clearAllMocks();
  listAppointments.mockResolvedValue([showing('showing-1')]);
  listAssociations.mockResolvedValue([]);
  listUnified.mockResolvedValue([]);
  listFeedback.mockResolvedValue([]);
  listHistory.mockResolvedValue([]);
  create.mockResolvedValue(record('draft', 0));
  edit.mockResolvedValue(record('draft', 3));
  act.mockResolvedValue(record('pending_review', 3));
});

test('only exact completed transaction showings offer a private draft; duplicate clicks create once', async () => {
  listAppointments.mockResolvedValue([
    showing('showing-1'), showing('waiting', 'confirmed'), showing('cancelled', 'cancelled'),
    showing('other', 'completed', { transaction_id: 'transaction-2' }),
    showing('hidden', 'completed', { visible_to_seller: false }),
  ]);
  let finish!: (row: StaffShowingFeedbackDto) => void;
  create.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<StaffShowingFeedback transactionId="transaction-1" role="agent" />);
  expect(await screen.findAllByRole('article')).toHaveLength(4);
  expect(screen.getAllByText(/Complete this exact seller-visible showing/)).toHaveLength(3);
  expect(screen.queryByText('other')).toBeNull();
  const summary = screen.getAllByLabelText('Seller-safe summary')[0];
  fireEvent.change(summary, { target: { value: '  A concise seller summary  ' } });
  const save = screen.getByRole('button', { name: 'Save private draft' });
  fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith('transaction-1', 'showing-1', 'A concise seller summary');
  finish(record('draft', 0));
  expect(await screen.findByText(/Private feedback draft saved/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve and publish' })).toBeNull();
});

test('completed shared buyer association creates only buyer-source feedback', async () => {
  listAppointments.mockResolvedValue([]);
  listAssociations.mockResolvedValue([{ id: 'association-1', showing_request_id: 'request-1',
    listing_id: 'listing-1', transaction_id: 'transaction-1', same_as_appointment_id: null,
    revision: 2, linked_at: '2026-01-01T00:00:00Z', unlinked_at: null,
    shared_at: '2026-01-01T00:00:00Z', seller_visible: true }]);
  listUnified.mockResolvedValue([{ id: 'buyer:association-1', source: 'buyer_request',
    label: 'Property showing', starts_at: '2026-01-02T00:00:00Z', status: 'completed' }]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="agent" />);
  fireEvent.change(await screen.findByLabelText('Seller-safe summary'), { target: { value: 'Reviewed seller summary' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save private draft' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('transaction-1',
    { buyer_showing_association_id: 'association-1' }, 'Reviewed seller summary'));
  expect(screen.queryByRole('button', { name: 'Approve and publish' })).toBeNull();
});

test('unshared buyer source is ineligible and exact same visit keeps the S5 source', async () => {
  listAssociations.mockResolvedValue([{ id: 'association-1', showing_request_id: 'request-1',
    listing_id: 'listing-1', transaction_id: 'transaction-1', same_as_appointment_id: 'showing-1',
    revision: 1, linked_at: '2026-01-01T00:00:00Z', unlinked_at: null,
    shared_at: null, seller_visible: false }]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="agent" />);
  expect(await screen.findByText(/verified same visit/)).toBeTruthy();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.queryByLabelText('Seller-safe summary')).toBeNull();
  expect(create).not.toHaveBeenCalled();
});

test('Super Admin can audit and withdraw historical buyer feedback after association disappears', async () => {
  listAppointments.mockResolvedValue([]);
  listFeedback.mockResolvedValue([record('published', 5, {
    appointment_id: null, buyer_showing_association_id: 'association-1', source: 'buyer_request',
  })]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="superadmin" />);
  expect(await screen.findByText(/Historical feedback/)).toBeTruthy();
  expect(screen.queryByLabelText('Seller-safe summary')).toBeNull();
  expect(screen.getByText('Private feedback history')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw feedback' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Withdraw feedback' })[1]);
  await waitFor(() => expect(act).toHaveBeenCalledWith('transaction-1', 'feedback-1', 'withdraw', 5));
});

test('Agent submits a saved draft but has no publication or withdrawal control', async () => {
  listFeedback.mockResolvedValue([record('draft')]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="agent" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
  await waitFor(() => expect(act).toHaveBeenCalledWith('transaction-1', 'feedback-1', 'submit', 2));
  expect(screen.queryByRole('button', { name: 'Approve and publish' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Withdraw feedback' })).toBeNull();
});

test('even Super Admin sees no publication action for an incomplete or cancelled showing', async () => {
  listAppointments.mockResolvedValue([showing('showing-1', 'cancelled')]);
  listFeedback.mockResolvedValue([record('pending_review', 4)]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="superadmin" />);
  expect(await screen.findByText('Awaiting Super Admin review')).toBeTruthy();
  expect(screen.getByText(/Complete this exact seller-visible showing/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve and publish' })).toBeNull();
});

test('Super Admin alone approves the reviewed revision with confirmation and sees private history', async () => {
  listFeedback.mockResolvedValue([record('pending_review', 4)]);
  listHistory.mockResolvedValue([{ action: 'created', status: 'draft', revision: 0,
    content_revision: 1, summary: 'Previous private version', actor_user_id: 'staff-1',
    created_at: '2026-01-01T00:00:00Z' }]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="superadmin" />);
  fireEvent.click(await screen.findByText('Private feedback history'));
  expect(screen.getByText('Previous private version')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Approve and publish' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(act).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Approve and publish' })[1]);
  await waitFor(() => expect(act).toHaveBeenCalledWith('transaction-1', 'feedback-1', 'publish', 4));
});

test('correction warns that publication disappears and requires renewed review', async () => {
  listFeedback.mockResolvedValueOnce([record('published', 5)]).mockResolvedValue([record('draft', 6, {
    summary: 'Corrected summary', content_revision: 2, approved_content_revision: null,
  })]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="agent" />);
  fireEvent.change(await screen.findByLabelText('Seller-safe summary'), { target: { value: 'Corrected summary' } });
  fireEvent.click(screen.getByRole('button', { name: 'Correct published summary' }));
  expect(screen.getByRole('dialog').textContent).toContain('immediately removes');
  fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
  await waitFor(() => expect(edit).toHaveBeenCalledWith('transaction-1', 'feedback-1', 5, 'Corrected summary'));
  expect(await screen.findByText(/Correction saved as a private draft/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Submit for review' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve and publish' })).toBeNull();
});

test('Super Admin cannot approve a corrected private draft until it is submitted again', async () => {
  listFeedback.mockResolvedValueOnce([record('draft', 6, {
    summary: 'Corrected summary', content_revision: 2, approved_content_revision: null,
  })]).mockResolvedValue([record('pending_review', 7, {
    summary: 'Corrected summary', content_revision: 2, approved_content_revision: null,
  })]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="superadmin" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
  expect(screen.queryByRole('button', { name: 'Approve and publish' })).toBeNull();
  await waitFor(() => expect(act).toHaveBeenCalledWith('transaction-1', 'feedback-1', 'submit', 6));
  expect(await screen.findByRole('button', { name: 'Approve and publish' })).toBeTruthy();
});

test('withdrawal is Super Admin-only and uses a dangerous confirmation', async () => {
  listFeedback.mockResolvedValue([record('published', 5)]);
  render(<StaffShowingFeedback transactionId="transaction-1" role="superadmin" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Withdraw feedback' }));
  expect(screen.getByRole('dialog').textContent).toContain('New seller list and detail reads');
  fireEvent.click(screen.getAllByRole('button', { name: 'Withdraw feedback' })[1]);
  await waitFor(() => expect(act).toHaveBeenCalledWith('transaction-1', 'feedback-1', 'withdraw', 5));
});

test('a failed authoritative refresh does not claim publication was confirmed in the UI', async () => {
  listFeedback.mockResolvedValueOnce([record('pending_review', 4)])
    .mockRejectedValueOnce(new Error('network'));
  render(<StaffShowingFeedback transactionId="transaction-1" role="superadmin" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve and publish' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Approve and publish' })[1]);
  await waitFor(() => expect(act).toHaveBeenCalledWith('transaction-1', 'feedback-1', 'publish', 4));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('could not be loaded'));
  expect(screen.queryByText('Reviewed revision published to the seller.')).toBeNull();
});

test('stale and authorization failures refresh or clear privileged state', async () => {
  listFeedback.mockResolvedValueOnce([record('draft', 2)]).mockResolvedValueOnce([record('draft', 3)]).mockRejectedValueOnce({ response: { status: 403 } });
  edit.mockRejectedValue({ response: { status: 409 } });
  render(<StaffShowingFeedback transactionId="transaction-1" role="agent" />);
  fireEvent.change(await screen.findByLabelText('Seller-safe summary'), { target: { value: 'Changed draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft changes' }));
  await waitFor(() => expect(screen.getAllByRole('alert').some((node) =>
    node.textContent?.includes('latest version'))).toBe(true));
  expect(screen.getByRole('button', { name: 'Load latest summary' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh feedback' }));
  await waitFor(() => expect(screen.getAllByRole('alert').some((node) =>
    node.textContent?.includes('no longer available'))).toBe(true));
  expect(screen.queryByRole('article')).toBeNull();
});

test('ordinary roles never request staff feedback', () => {
  const view = render(<StaffShowingFeedback transactionId="transaction-1" role="client" />);
  expect(view.container.textContent).toBe('');
  expect(listAppointments).not.toHaveBeenCalled();
  expect(listFeedback).not.toHaveBeenCalled();
});
