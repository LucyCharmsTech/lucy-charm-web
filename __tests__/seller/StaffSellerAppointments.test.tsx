import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffSellerAppointments from '@/components/seller/StaffSellerAppointments';
import {
  actOnSellerAppointment, createSellerAppointment, listAppointmentChanges, listAppointmentHistory,
  listSellerAppointments, resolveAppointmentChange,
  type SellerAppointment, type SellerAppointmentChange,
} from '@/services/sellerAppointmentService';

jest.mock('@/services/sellerAppointmentService', () => {
  const actual = jest.requireActual('@/services/sellerAppointmentService');
  return { ...actual, actOnSellerAppointment: jest.fn(), createSellerAppointment: jest.fn(),
    listAppointmentChanges: jest.fn(), listAppointmentHistory: jest.fn(), listSellerAppointments: jest.fn(), resolveAppointmentChange: jest.fn() };
});
const list = listSellerAppointments as jest.MockedFunction<typeof listSellerAppointments>;
const changes = listAppointmentChanges as jest.MockedFunction<typeof listAppointmentChanges>;
const history = listAppointmentHistory as jest.MockedFunction<typeof listAppointmentHistory>;
const create = createSellerAppointment as jest.MockedFunction<typeof createSellerAppointment>;
const act = actOnSellerAppointment as jest.MockedFunction<typeof actOnSellerAppointment>;
const resolve = resolveAppointmentChange as jest.MockedFunction<typeof resolveAppointmentChange>;

const item = (status: SellerAppointment['status']): SellerAppointment => ({
  id: 'appointment-1', journey_id: 'journey-1', transaction_id: null, kind: 'consultation',
  seller_details: 'Discuss next steps', status, visible_to_seller: true,
  property_timezone: 'America/Toronto', proposed_at: '2099-06-01T14:00:00Z',
  scheduled_at: status === 'confirmed' ? '2099-06-01T14:00:00Z' : null,
  revision: 3, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
});
const change: SellerAppointmentChange = {
  id: 'change-1', appointment_id: 'appointment-1', message: 'Please move this appointment',
  preferred_at: '2099-06-02T15:00:00Z', status: 'pending', resolution_note: null,
  created_at: '2026-01-01T00:00:00Z', handled_at: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue([]);
  changes.mockResolvedValue([]);
  history.mockResolvedValue([]);
  create.mockResolvedValue(item('requested'));
  act.mockResolvedValue(item('confirmed'));
  resolve.mockResolvedValue(item('confirmed'));
});

test('represented staff showing panel manages only S5 showings and creates the showing kind', async () => {
  list.mockResolvedValue([
    { ...item('confirmed'), journey_id: null, transaction_id: 'transaction-1', kind: 'showing' },
    { ...item('confirmed'), id: 'consultation-1', journey_id: null, transaction_id: 'transaction-1' },
  ]);
  render(<StaffSellerAppointments scope={{ transactionId: 'transaction-1' }} role="agent" showingOnly />);
  expect(await screen.findAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'S5 showing appointments' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Property timezone (IANA)'), { target: { value: 'America/Toronto' } });
  fireEvent.change(screen.getByLabelText('Proposed property-local date and time'), { target: { value: '2099-06-01T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save appointment request' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith({ transactionId: 'transaction-1' },
    expect.objectContaining({ kind: 'showing' })));
});

test('staff creation uses exact journey scope, explicit property time and separate confirmation', async () => {
  render(<StaffSellerAppointments scope={{ journeyId: 'journey-1' }} role="agent" />);
  await screen.findByText('No appointments for this record yet.');
  const save = screen.getByRole('button', { name: 'Save appointment request' });
  expect(save).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('Property timezone (IANA)'), { target: { value: 'America/Toronto' } });
  fireEvent.change(screen.getByLabelText('Proposed property-local date and time'), { target: { value: '2099-06-01T10:00' } });
  expect(save).toHaveProperty('disabled', false);
  fireEvent.click(save);
  await waitFor(() => expect(create).toHaveBeenCalledWith({ journeyId: 'journey-1' }, expect.objectContaining({
    kind: 'consultation', property_timezone: 'America/Toronto', proposed_local_at: '2099-06-01T10:00:00-04:00', visible_to_seller: true,
  })));
  expect(await screen.findByText(/proposed time is not yet confirmed/)).toBeTruthy();
  expect(screen.getByLabelText('Proposed property-local date and time')).toHaveProperty('value', '');
});

test('failed creation preserves entered details and shows a safe error', async () => {
  create.mockRejectedValue({ response: { status: 422 } });
  render(<StaffSellerAppointments scope={{ journeyId: 'journey-1' }} role="superadmin" />);
  await screen.findByText('No appointments for this record yet.');
  fireEvent.change(screen.getByLabelText('Property timezone (IANA)'), { target: { value: 'America/Toronto' } });
  fireEvent.change(screen.getByLabelText('Proposed property-local date and time'), { target: { value: '2099-06-01T10:00' } });
  fireEvent.change(screen.getByLabelText('Seller-facing details (optional)'), { target: { value: 'Keep these details' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save appointment request' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Check the time'));
  expect(screen.getByLabelText('Seller-facing details (optional)')).toHaveProperty('value', 'Keep these details');
  expect(screen.getByLabelText('Proposed property-local date and time')).toHaveProperty('value', '2099-06-01T10:00');
});

test.each([
  ['requested', 'Confirm proposed time', 'confirm'],
  ['requested', 'Cancel appointment', 'cancel'],
  ['confirmed', 'Mark completed', 'complete'],
] as const)('%s appointment offers explicit %s decision with revision', async (status, label, action) => {
  list.mockResolvedValue([item(status)]);
  render(<StaffSellerAppointments scope={{ journeyId: 'journey-1' }} role="agent" />);
  fireEvent.click(await screen.findByRole('button', { name: label }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
  await waitFor(() => expect(act).toHaveBeenCalledWith('appointment-1', action, 3));
});

test('accept explicitly confirms a replacement time, while reject sends no new time', async () => {
  list.mockResolvedValue([item('confirmed')]);
  changes.mockResolvedValue([change]);
  const view = render(<StaffSellerAppointments scope={{ transactionId: 'transaction-1' }} role="superadmin" />);
  fireEvent.change(await screen.findByLabelText('New confirmed property-local time (required to accept)'), { target: { value: '2099-06-02T11:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Accept and confirm new time' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
  await waitFor(() => expect(resolve).toHaveBeenCalledWith('appointment-1', 'change-1', {
    expected_revision: 3, decision: 'accepted', confirmed_local_at: '2099-06-02T11:00:00-04:00',
  }));
  expect(list).toHaveBeenCalledWith({ transactionId: 'transaction-1' }, true);
  view.unmount();
  resolve.mockClear();
  render(<StaffSellerAppointments scope={{ journeyId: 'journey-1' }} role="agent" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reject request' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
  await waitFor(() => expect(resolve).toHaveBeenCalledWith('appointment-1', 'change-1', {
    expected_revision: 3, decision: 'rejected',
  }));
});

test('stale revision closes confirmation and reloads, and reassignment removes prior staff data', async () => {
  list.mockResolvedValueOnce([item('requested')]).mockResolvedValueOnce([item('requested')]).mockRejectedValueOnce({ response: { status: 403 } });
  act.mockRejectedValue({ response: { status: 409 } });
  render(<StaffSellerAppointments scope={{ journeyId: 'journey-1' }} role="agent" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm proposed time' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save decision' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('changed'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveProperty('textContent', expect.stringContaining('no longer available')));
  expect(screen.queryByRole('button', { name: 'Confirm proposed time' })).toBeNull();
});

test('ordinary roles receive no staff controls or staff requests', () => {
  const { container } = render(<StaffSellerAppointments scope={{ journeyId: 'journey-1' }} role="client" />);
  expect(container.textContent).toBe('');
  expect(list).not.toHaveBeenCalled();
});
