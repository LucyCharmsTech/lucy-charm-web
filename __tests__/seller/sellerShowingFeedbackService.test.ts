import api from '@/lib/axios';
import {
  actOnShowingFeedback, createShowingFeedback, editShowingFeedback,
  listPublishedShowingFeedback, listShowingFeedbackHistory, listStaffShowingFeedback,
  showingFeedbackError,
} from '@/services/sellerShowingFeedbackService';

jest.mock('@/lib/axios', () => ({ __esModule: true, default: {
  get: jest.fn(), post: jest.fn(), patch: jest.fn(),
} }));
const client = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  (client.get as jest.Mock).mockResolvedValue({ data: [] });
  (client.post as jest.Mock).mockResolvedValue({ data: {} });
  (client.patch as jest.Mock).mockResolvedValue({ data: {} });
});

test('uses exact transaction-scoped S6 routes, separate staff and seller DTOs, and revisions', async () => {
  await listStaffShowingFeedback('transaction-1');
  await listShowingFeedbackHistory('transaction-1', 'feedback-1');
  await listPublishedShowingFeedback('transaction-1');
  await createShowingFeedback('transaction-1', 'showing-1', 'Seller-safe summary');
  await editShowingFeedback('transaction-1', 'feedback-1', 4, 'Corrected summary');
  await actOnShowingFeedback('transaction-1', 'feedback-1', 'submit', 5);
  await actOnShowingFeedback('transaction-1', 'feedback-1', 'publish', 6);
  await actOnShowingFeedback('transaction-1', 'feedback-1', 'withdraw', 7);
  expect((client.get as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
    '/seller-transactions/transaction-1/showing-feedback/staff',
    '/seller-transactions/transaction-1/showing-feedback/staff/feedback-1/history',
    '/seller-transactions/transaction-1/showing-feedback',
  ]);
  expect((client.post as jest.Mock).mock.calls).toEqual([
    ['/seller-transactions/transaction-1/showing-feedback/staff',
      { appointment_id: 'showing-1', summary: 'Seller-safe summary' }],
    ['/seller-transactions/transaction-1/showing-feedback/staff/feedback-1/submit', { expected_revision: 5 }],
    ['/seller-transactions/transaction-1/showing-feedback/staff/feedback-1/publish', { expected_revision: 6 }],
    ['/seller-transactions/transaction-1/showing-feedback/staff/feedback-1/withdraw', { expected_revision: 7 }],
  ]);
  expect((client.patch as jest.Mock).mock.calls).toEqual([
    ['/seller-transactions/transaction-1/showing-feedback/staff/feedback-1',
      { expected_revision: 4, summary: 'Corrected summary' }],
  ]);
});

test('maps concurrency, authorization, validation and transport failures to useful safe copy', () => {
  expect(showingFeedbackError({ response: { status: 409 } })).toContain('changed');
  expect(showingFeedbackError({ response: { status: 403 } })).toContain('no longer available');
  expect(showingFeedbackError({ response: { status: 422 } })).toContain('not eligible');
  expect(showingFeedbackError(new Error('offline'))).toContain('could not be loaded');
});

test('buyer-origin creation sends exactly one authoritative association ID', async () => {
  await createShowingFeedback('transaction-1', { buyer_showing_association_id: 'association-1' }, 'Reviewed summary');
  expect((client.post as jest.Mock).mock.calls[0]).toEqual([
    '/seller-transactions/transaction-1/showing-feedback/staff',
    { buyer_showing_association_id: 'association-1', summary: 'Reviewed summary' },
  ]);
  expect(showingFeedbackError({ response: { status: 409, data: { detail: 'This visit uses its exact S5 appointment for feedback' } } }))
    .toContain('exact S5 appointment');
});
