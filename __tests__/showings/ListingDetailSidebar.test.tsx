import { fireEvent, render, screen } from '@testing-library/react';
import ListingDetailSidebar from '@/components/listings/detail/ListingDetailSidebar';
import { getListingDetail } from '@/components/listings/listingDetailData';

const openModal = jest.fn();
jest.mock('@/components/listings/detail/ShowingRequestModalContext', () => ({
  useShowingRequestModal: () => ({ open: false, openModal, closeModal: jest.fn() }),
}));
jest.mock('@/components/listings/detail/RequestShowingModal', () => ({
  __esModule: true,
  default: ({ listingId }: { listingId: string }) => (
    <div data-testid="showing-modal" data-listing-id={listingId} />
  ),
}));
jest.mock('@/components/listings/detail/ListingDetailAgentCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/listings/SaveListingButton', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/reactions/PropertyReactionButtons', () => ({
  PropertyReactionButtons: () => null,
}));

const previewListing = getListingDetail('1')!;
const liveId = '11111111-1111-1111-1111-00000000a001';

beforeEach(() => openModal.mockClear());

test('legacy mock listing cannot open a Showing request with its numeric ID', () => {
  render(<ListingDetailSidebar listing={previewListing} />);

  expect(screen.queryByRole('button', { name: 'Request a Showing' })).toBeNull();
  expect(screen.queryByTestId('showing-modal')).toBeNull();
  expect(screen.getByRole('link', { name: 'Browse available listings' }).getAttribute('href')).toBe('/listings');
});

test('database-backed listing passes its UUID to the Showing request modal', () => {
  render(<ListingDetailSidebar listing={{ ...previewListing, id: liveId }} />);

  fireEvent.click(screen.getByRole('button', { name: 'Request a Showing' }));
  expect(openModal).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('showing-modal').getAttribute('data-listing-id')).toBe(liveId);
});
