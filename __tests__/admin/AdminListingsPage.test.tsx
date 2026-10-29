import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminListingsPage from '@/app/admin/listings/page';
import { fetchAllListingsAdmin } from '@/services/portalService';
import type { ApiListing } from '@/types/api';

jest.mock('@/services/portalService', () => ({ fetchAllListingsAdmin: jest.fn() }));
jest.mock('@/components/admin/IdxFeedHealth', () => ({ __esModule: true, default: () => <p>Feed health</p> }));
jest.mock('@/components/admin/AddPublicListingForm', () => ({
  __esModule: true,
  default: ({ onCreated }: { onCreated: () => Promise<void> }) => (
    <button type="button" onClick={() => void onCreated()}>Refresh after creation</button>
  ),
}));
jest.mock('@/components/ListingCard', () => ({
  __esModule: true,
  default: ({ insightsHref }: { insightsHref: string }) => <a href={insightsHref}>Listing details</a>,
}));
jest.mock('@/lib/listingAdapter', () => ({ apiListingToItem: jest.fn(() => ({})) }));

const listings = fetchAllListingsAdmin as jest.MockedFunction<typeof fetchAllListingsAdmin>;

beforeEach(() => jest.clearAllMocks());

test('keeps the empty catalog view and refreshes to the existing detail navigation', async () => {
  listings
    .mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 100 })
    .mockResolvedValue({ items: [{ id: 'listing-1' } as ApiListing], total: 1, page: 1, page_size: 100 });
  render(<AdminListingsPage />);
  expect(await screen.findByText('No listings in the catalog.')).toBeTruthy();
  expect(screen.getByText('Feed health')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh after creation' }));
  await waitFor(() => expect(listings).toHaveBeenCalledTimes(2));
  expect((await screen.findByRole('link', { name: 'Listing details' })).getAttribute('href'))
    .toBe('/admin/listings/listing-1');
  expect(screen.getByText('1 total')).toBeTruthy();
});

test('reports catalog failures without removing the creation action', async () => {
  listings.mockRejectedValue({ response: { data: { detail: 'Catalog temporarily unavailable' } } });
  render(<AdminListingsPage />);
  expect((await screen.findByRole('alert')).textContent).toContain('Catalog temporarily unavailable');
  expect(screen.getByRole('button', { name: 'Refresh after creation' })).toBeTruthy();
});
