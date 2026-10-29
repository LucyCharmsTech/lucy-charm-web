import api from '@/lib/axios';
import {
  associateBuyerShowing,
  decideBuyerShowing,
  listBuyerShowingAssociations,
  listBuyerShowingHistory,
  listSellerShowings,
} from '@/services/sellerBuyerShowingService';

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));
const client = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  for (const method of ['get', 'put', 'post', 'delete'] as const) {
    (client[method] as jest.Mock).mockResolvedValue({ data: [] });
  }
});

test('uses scoped authorized reads and explicit audited association decisions', async () => {
  await listSellerShowings('transaction-1');
  await listBuyerShowingAssociations('transaction-1');
  await listBuyerShowingHistory('transaction-1', 'request-1');
  await associateBuyerShowing('transaction-1', 'request-1', {
    expected_revision: 0,
    reason: 'Verified',
    same_as_appointment_id: null,
  });
  await decideBuyerShowing('transaction-1', 'request-1', 'share', {
    expected_revision: 1,
    reason: 'Approved',
  });
  await decideBuyerShowing('transaction-1', 'request-1', 'withdraw', {
    expected_revision: 2,
    reason: 'Withdrawn',
  });
  await decideBuyerShowing('transaction-1', 'request-1', 'unlink', {
    expected_revision: 3,
    reason: 'Unlinked',
  });
  const base = '/seller-transactions/transaction-1';
  expect((client.get as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
    `${base}/showings`,
    `${base}/buyer-showings`,
    `${base}/buyer-showings/request-1/history`,
  ]);
  expect(client.put).toHaveBeenCalledWith(`${base}/buyer-showings/request-1`, {
    expected_revision: 0,
    reason: 'Verified',
    same_as_appointment_id: null,
  });
  expect(client.post).toHaveBeenCalledWith(
    `${base}/buyer-showings/request-1/share`,
    { expected_revision: 1, reason: 'Approved' },
  );
  expect(client.post).toHaveBeenCalledWith(
    `${base}/buyer-showings/request-1/withdraw`,
    { expected_revision: 2, reason: 'Withdrawn' },
  );
  expect(client.delete).toHaveBeenCalledWith(
    `${base}/buyer-showings/request-1`,
    { data: { expected_revision: 3, reason: 'Unlinked' } },
  );
});
