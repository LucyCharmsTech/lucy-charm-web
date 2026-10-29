import api from '@/lib/axios';
import {
  actOnSellerAppointment, createSellerAppointment, fetchSellerAppointment, formatPropertyTime,
  listAppointmentChanges, listAppointmentHistory, listSellerAppointments,
  propertyLocalOptions, requestAppointmentChange, resolveAppointmentChange,
} from '@/services/sellerAppointmentService';

jest.mock('@/lib/axios', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const client = api as jest.Mocked<typeof api>;

beforeEach(() => jest.clearAllMocks());

test('journey and represented transaction requests use exact S5-A routes and revisions', async () => {
  (client.get as jest.Mock).mockResolvedValue({ data: [] });
  (client.post as jest.Mock).mockResolvedValue({ data: {} });
  await listSellerAppointments({ journeyId: 'journey-1' });
  await listSellerAppointments({ transactionId: 'transaction-1' });
  await listSellerAppointments({ journeyId: 'journey-1' }, true);
  await fetchSellerAppointment('appointment-1');
  await listAppointmentChanges('appointment-1');
  await listAppointmentChanges('appointment-1', true);
  await listAppointmentHistory('appointment-1');
  expect((client.get as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
    '/seller-appointments/journeys/journey-1',
    '/seller-appointments/transactions/transaction-1',
    '/seller-appointments/staff/journeys/journey-1',
    '/seller-appointments/appointment-1',
    '/seller-appointments/appointment-1/changes',
    '/seller-appointments/staff/appointment-1/changes',
    '/seller-appointments/staff/appointment-1/history',
  ]);
  await createSellerAppointment({ journeyId: 'journey-1' }, {
    kind: 'consultation', seller_details: null, visible_to_seller: true,
    property_timezone: 'America/Toronto', proposed_local_at: '2099-06-01T10:00:00-04:00',
  });
  await requestAppointmentChange('appointment-1', { expected_revision: 2, message: 'Please change this', idempotency_key: 'unique-key' });
  await actOnSellerAppointment('appointment-1', 'confirm', 2);
  await resolveAppointmentChange('appointment-1', 'change-1', {
    expected_revision: 3, decision: 'accepted', confirmed_local_at: '2099-06-02T11:00:00-04:00',
  });
  expect((client.post as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
    '/seller-appointments', '/seller-appointments/appointment-1/changes',
    '/seller-appointments/staff/appointment-1/confirm',
    '/seller-appointments/staff/appointment-1/changes/change-1/resolve',
  ]);
  expect((client.post as jest.Mock).mock.calls[0][1]).toMatchObject({ journey_id: 'journey-1', transaction_id: null });
  expect((client.post as jest.Mock).mock.calls[2][1]).toEqual({ expected_revision: 2 });
});

test('property-local time conversion handles normal times, DST gaps and repeated times', () => {
  expect(propertyLocalOptions('2026-01-10T10:00', 'America/Toronto')).toEqual(['2026-01-10T10:00:00-05:00']);
  expect(propertyLocalOptions('2026-03-08T02:30', 'America/Toronto')).toEqual([]);
  expect(propertyLocalOptions('2026-11-01T01:30', 'America/Toronto')).toEqual([
    '2026-11-01T01:30:00-04:00', '2026-11-01T01:30:00-05:00',
  ]);
  expect(propertyLocalOptions('2026-01-10T10:00', 'Invalid/Zone')).toEqual([]);
  expect(formatPropertyTime('2026-01-10T15:00:00Z', 'America/Toronto')).toContain('10:00');
  expect(formatPropertyTime('not-a-date', 'America/Toronto')).toBe('Time unavailable');
});
