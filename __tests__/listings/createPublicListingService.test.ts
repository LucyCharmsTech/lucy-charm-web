import api from '@/lib/axios';
import { createPublicListing, type PublicListingCreate } from '@/services/listingsService';
import type { ApiListing } from '@/types/api';

jest.mock('@/lib/axios', () => ({ __esModule: true, default: { post: jest.fn() } }));

const post = api.post as jest.MockedFunction<typeof api.post>;

test('posts the exact create payload through the authenticated listings API', async () => {
  const payload: PublicListingCreate = {
    title: 'Fictional townhouse', price: 1250000, agent_id: 'agent-1',
    address: '12 Main Street', city: 'Toronto', state: 'ON', zip: 'M5V 1A1', country: 'CA',
  };
  const created = { id: 'listing-1' } as ApiListing;
  post.mockResolvedValueOnce({ data: created });

  await expect(createPublicListing(payload)).resolves.toBe(created);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith('/listings/', payload);
});
