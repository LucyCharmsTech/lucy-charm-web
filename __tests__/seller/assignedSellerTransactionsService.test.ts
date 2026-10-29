import api from '@/lib/axios';
import { fetchAssignedSellerTransactions } from '@/services/sellerService';

jest.mock('@/lib/axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

test('Agent discovery calls only the E3-A assigned index with bounded page parameters', async () => {
  const response = { items: [], total: 0, page: 2, page_size: 20 };
  (api.get as jest.Mock).mockResolvedValue({ data: response });
  expect(await fetchAssignedSellerTransactions(2, 20)).toEqual(response);
  expect(api.get).toHaveBeenCalledWith('/seller-transactions/assigned', {
    params: { page: 2, size: 20 },
  });
  expect(api.get).not.toHaveBeenCalledWith('/seller-transactions/mine', expect.anything());
  expect(api.get).not.toHaveBeenCalledWith('/seller-transactions/', expect.anything());
});
