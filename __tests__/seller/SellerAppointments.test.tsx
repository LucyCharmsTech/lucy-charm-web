import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SellerAppointments from '@/components/seller/SellerAppointments';
import {
  listAppointmentChanges, listSellerAppointments, requestAppointmentChange,
  type SellerAppointment,
} from '@/services/sellerAppointmentService';

jest.mock('@/services/sellerAppointmentService', () => {
  const actual = jest.requireActual('@/services/sellerAppointmentService');
  return { ...actual, listSellerAppointments: jest.fn(), listAppointmentChanges: jest.fn(), requestAppointmentChange: jest.fn() };
});
const list = listSellerAppointments as jest.MockedFunction<typeof listSellerAppointments>;
const changes = listAppointmentChanges as jest.MockedFunction<typeof listAppointmentChanges>;
const request = requestAppointmentChange as jest.MockedFunction<typeof requestAppointmentChange>;

const appointment = (id: string, status: SellerAppointment['status'], instant: string, extra: Partial<SellerAppointment> = {}): SellerAppointment => ({
  id, journey_id: 'journey-1', transaction_id: null, kind: 'consultation', seller_details: 'Discuss the home',
  status, visible_to_seller: true, property_timezone: 'America/Toronto', proposed_at: instant,
  scheduled_at: status === 'confirmed' || status === 'completed' ? instant : null,
  revision: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra,
});
const future = '2099-06-01T14:00:00Z';

beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue([]);
  changes.mockResolvedValue([]);
  request.mockResolvedValue({ id: 'change-1', appointment_id: 'future', message: 'Please change the time', preferred_at: null, status: 'pending', resolution_note: null, created_at: future, handled_at: null });
});

test('represented appointment panel keeps other kinds while showing cards move to Showings', async () => {
  list.mockResolvedValue([
    appointment('consultation-1', 'confirmed', future, { journey_id: null, transaction_id: 'transaction-1' }),
    appointment('photography-1', 'confirmed', future, { journey_id: null, transaction_id: 'transaction-1', kind: 'photography' }),
    appointment('showing-1', 'confirmed', future, { journey_id: null, transaction_id: 'transaction-1', kind: 'showing' }),
  ]);
  render(<SellerAppointments scope={{ transactionId: 'transaction-1' }} contactHref="#message-agent" excludeShowings />);
  expect(await screen.findAllByRole('article')).toHaveLength(2);
  expect(screen.getByText('Consultation')).toBeTruthy();
  expect(screen.getByText('Photography')).toBeTruthy();
  expect(screen.queryByText('Showing')).toBeNull();
});

test('shows next appointment first, history, all statuses and property timezone while excluding internal rows', async () => {
  list.mockResolvedValue([
    appointment('later', 'requested', '2099-07-01T14:00:00Z'),
    appointment('past', 'completed', '2020-01-01T14:00:00Z'),
    appointment('future', 'confirmed', future),
    appointment('cancelled', 'cancelled', '2020-02-01T14:00:00Z'),
    appointment('internal', 'confirmed', future, { visible_to_seller: false, seller_details: 'Internal details' }),
  ]);
  render(<SellerAppointments scope={{ journeyId: 'journey-1' }} contactHref="/contact?from=sell" />);
  expect(await screen.findByText('Next appointment')).toBeTruthy();
  const cards = screen.getAllByRole('article');
  expect(cards.map((node) => node.textContent)).toEqual(expect.arrayContaining([
    expect.stringContaining('confirmed'), expect.stringContaining('requested'),
    expect.stringContaining('completed'), expect.stringContaining('cancelled'),
  ]));
  expect(cards[0].textContent).toContain('Jun');
  expect(screen.getAllByText('Property timezone: America/Toronto')).toHaveLength(4);
  expect(screen.queryByText('Internal details')).toBeNull();
  expect(list).toHaveBeenCalledWith({ journeyId: 'journey-1' });
});

test('change request does not alter confirmed booking, prevents a second submission and confirms only after API success', async () => {
  list.mockResolvedValue([appointment('future', 'confirmed', future)]);
  let resolve!: (value: Awaited<ReturnType<typeof requestAppointmentChange>>) => void;
  request.mockImplementation(() => new Promise((done) => { resolve = done; }));
  render(<SellerAppointments scope={{ journeyId: 'journey-1' }} contactHref="/contact" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Appointment details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Request a change' }));
  fireEvent.change(screen.getByLabelText('What needs to change?'), { target: { value: 'Please change the time' } });
  const submit = screen.getByRole('button', { name: 'Send change request' });
  fireEvent.click(submit);
  fireEvent.click(submit);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/Change request saved/)).toBeNull();
  expect(screen.getByText(/Jun 1/)).toBeTruthy();
  resolve({ id: 'change-1', appointment_id: 'future', message: 'Please change the time', preferred_at: null, status: 'pending', resolution_note: null, created_at: future, handled_at: null });
  expect(await screen.findByText(/Change request saved/)).toBeTruthy();
  expect(request).toHaveBeenCalledWith('future', expect.objectContaining({ expected_revision: 2, message: 'Please change the time', idempotency_key: expect.any(String) }));
});

test('optional preferred time is sent with an explicit property offset; a pending request preserves the booking', async () => {
  list.mockResolvedValue([appointment('future', 'confirmed', future)]);
  changes.mockResolvedValue([{ id: 'change-1', appointment_id: 'future', message: 'Change please', preferred_at: null, status: 'pending', resolution_note: null, created_at: future, handled_at: null }]);
  const view = render(<SellerAppointments scope={{ transactionId: 'transaction-1' }} contactHref="#message-agent" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Appointment details' }));
  expect(screen.getByText(/confirmed booking remains unchanged/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Request a change' })).toBeNull();
  expect(list).toHaveBeenCalledWith({ transactionId: 'transaction-1' });
  view.unmount();
  changes.mockResolvedValue([]);
  render(<SellerAppointments scope={{ journeyId: 'journey-1' }} contactHref="/contact" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Appointment details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Request a change' }));
  fireEvent.change(screen.getByLabelText('What needs to change?'), { target: { value: 'Another time please' } });
  fireEvent.change(screen.getByLabelText('Preferred local time (optional)'), { target: { value: '2099-06-02T11:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send change request' }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('future', expect.objectContaining({ preferred_local_at: '2099-06-02T11:00:00-04:00' })));
});

test('authorization loss clears old account data and stale revision reports recovery', async () => {
  list.mockResolvedValueOnce([appointment('future', 'confirmed', future)]).mockRejectedValueOnce({ response: { status: 403 } });
  render(<SellerAppointments scope={{ journeyId: 'journey-1' }} contactHref="/contact" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('no longer available'));
  expect(screen.queryByRole('article')).toBeNull();
});

test('a journey switch discards late data from the previous account scope', async () => {
  let finishOld!: (rows: SellerAppointment[]) => void;
  list.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValueOnce([appointment('new-appointment', 'requested', future, { journey_id: 'journey-2', seller_details: 'New account appointment' })]);
  const view = render(<SellerAppointments key="old" scope={{ journeyId: 'journey-1' }} contactHref="/contact" />);
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  view.rerender(<SellerAppointments key="new" scope={{ journeyId: 'journey-2' }} contactHref="/contact" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Appointment details' }));
  expect(await screen.findByText('New account appointment')).toBeTruthy();
  finishOld([appointment('old-appointment', 'confirmed', future, { seller_details: 'Old account appointment' })]);
  await waitFor(() => expect(screen.queryByText('Old account appointment')).toBeNull());
  expect(list).toHaveBeenLastCalledWith({ journeyId: 'journey-2' });
});

test('a stale change request refreshes the appointment and explains that no reschedule occurred', async () => {
  list.mockResolvedValue([appointment('future', 'confirmed', future)]);
  request.mockRejectedValue({ response: { status: 409 } });
  render(<SellerAppointments scope={{ journeyId: 'journey-1' }} contactHref="/contact" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Appointment details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Request a change' }));
  fireEvent.change(screen.getByLabelText('What needs to change?'), { target: { value: 'Please change the time' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send change request' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('changed'));
  expect(screen.getByText(/Jun 1/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Send change request' })).toBeNull();
});
