import api from '@/lib/axios';
import {
  approvePublicListingVisibility, attestPublicListingProperty,
  fetchPublicListingOwnership, fetchPublicListingPropertyMapping,
  linkPublicListing, reassignPublicListing, revokePublicListingVisibility,
  unlinkPublicListing,
} from '@/services/sellerListingOwnershipService';

jest.mock('@/lib/axios', () => ({ __esModule: true, default: {
  get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(),
} }));
const client = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
  (client.get as jest.Mock).mockResolvedValue({ data: {} });
  (client.post as jest.Mock).mockResolvedValue({ data: {} });
  (client.put as jest.Mock).mockResolvedValue({ data: {} });
  (client.delete as jest.Mock).mockResolvedValue({ data: {} });
});

test('uses exact A0-A routes and request bodies, including DELETE body and atomic reassignment', async () => {
  const base = '/seller-transactions/transaction-1/public-listing-ownership';
  await fetchPublicListingOwnership('transaction-1');
  await fetchPublicListingPropertyMapping('listing-1');
  await attestPublicListingProperty('transaction-1', {
    listing_id: 'listing-1', expected_mapping_revision: 0,
    verification_basis: 'signed agreement', evidence_reference: 'agreement-1', reason: 'Reviewed',
  });
  await linkPublicListing('transaction-1', {
    listing_id: 'listing-1', expected_revision: 0, reason: 'Associate',
  });
  await unlinkPublicListing('transaction-1', { expected_revision: 1, reason: 'Unlink' });
  await reassignPublicListing('transaction-1', {
    listing_id: 'listing-1', from_transaction_id: 'transaction-2',
    expected_from_revision: 3, expected_revision: 2, reason: 'Transfer',
  });
  await approvePublicListingVisibility('transaction-1', { expected_revision: 4, reason: 'Approved' });
  await revokePublicListingVisibility('transaction-1', { expected_revision: 5, reason: 'Withdrawn' });

  expect((client.get as jest.Mock).mock.calls.map(([url]) => url)).toEqual([
    base, '/listings/listing-1/property-mapping',
  ]);
  expect((client.post as jest.Mock).mock.calls).toEqual([
    [`${base}/attestation`, { listing_id: 'listing-1', expected_mapping_revision: 0,
      verification_basis: 'signed agreement', evidence_reference: 'agreement-1', reason: 'Reviewed' }],
    [`${base}/reassignment`, { listing_id: 'listing-1', from_transaction_id: 'transaction-2',
      expected_from_revision: 3, expected_revision: 2, reason: 'Transfer' }],
    [`${base}/visibility-approval`, { expected_revision: 4, reason: 'Approved' }],
    [`${base}/visibility-revocation`, { expected_revision: 5, reason: 'Withdrawn' }],
  ]);
  expect((client.put as jest.Mock).mock.calls).toEqual([
    [base, { listing_id: 'listing-1', expected_revision: 0, reason: 'Associate' }],
  ]);
  expect((client.delete as jest.Mock).mock.calls).toEqual([
    [base, { data: { expected_revision: 1, reason: 'Unlink' } }],
  ]);
});
