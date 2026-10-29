import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicListingAssociation from '@/components/seller/PublicListingAssociation';
import { fetchListingById, searchListings } from '@/services/listingsService';
import {
  approvePublicListingVisibility, attestPublicListingProperty,
  fetchPublicListingOwnership, fetchPublicListingPropertyMapping,
  linkPublicListing, reassignPublicListing, revokePublicListingVisibility,
  unlinkPublicListing,
  type PropertyMapping, type PublicListingOwnershipDetail,
} from '@/services/sellerListingOwnershipService';
import type { ApiListing, SellerTransaction } from '@/types/api';

jest.mock('@/services/listingsService', () => ({
  fetchListingById: jest.fn(), searchListings: jest.fn(),
}));
jest.mock('@/services/sellerListingOwnershipService', () => ({
  approvePublicListingVisibility: jest.fn(), attestPublicListingProperty: jest.fn(),
  fetchPublicListingOwnership: jest.fn(), fetchPublicListingPropertyMapping: jest.fn(),
  linkPublicListing: jest.fn(), reassignPublicListing: jest.fn(),
  revokePublicListingVisibility: jest.fn(), unlinkPublicListing: jest.fn(),
}));

const ownershipRead = fetchPublicListingOwnership as jest.MockedFunction<typeof fetchPublicListingOwnership>;
const mappingRead = fetchPublicListingPropertyMapping as jest.MockedFunction<typeof fetchPublicListingPropertyMapping>;
const inventoryRead = searchListings as jest.MockedFunction<typeof searchListings>;
const listingRead = fetchListingById as jest.MockedFunction<typeof fetchListingById>;
const attest = attestPublicListingProperty as jest.MockedFunction<typeof attestPublicListingProperty>;
const link = linkPublicListing as jest.MockedFunction<typeof linkPublicListing>;
const unlink = unlinkPublicListing as jest.MockedFunction<typeof unlinkPublicListing>;
const reassign = reassignPublicListing as jest.MockedFunction<typeof reassignPublicListing>;
const approve = approvePublicListingVisibility as jest.MockedFunction<typeof approvePublicListingVisibility>;
const revoke = revokePublicListingVisibility as jest.MockedFunction<typeof revokePublicListingVisibility>;

const transaction = {
  id: 'transaction-1', property_id: 'property-1', seller_client_id: 'seller-1',
  representation_type: 'brokerage', representation_status: 'active',
  status: 'open', stage: 'active_listing', portal_activated_at: '2026-10-28T00:00:00Z',
  closed_at: null, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z',
} as SellerTransaction;
const listing = {
  id: 'listing-1', title: 'Fictional listing', address: '1 Main Street', unit: null,
  city: 'Toronto', state: 'ON', zip: 'M1M 1M1', mls_number: 'C1234567', status: 'active',
} as ApiListing;
const unmapped: PropertyMapping = {
  listing_id: listing.id, property_id: null, mapping_revision: 0,
  attested_at: null, verification_basis: null, evidence_reference: null, reason: null,
};
const mapped: PropertyMapping = {
  ...unmapped, property_id: transaction.property_id, mapping_revision: 1,
  attested_at: '2026-10-28T00:00:00Z', verification_basis: 'signed agreement',
  evidence_reference: 'agreement-1', reason: 'Reviewed',
};
const empty: PublicListingOwnershipDetail = {
  ownership: {
    transaction_id: transaction.id, property_id: transaction.property_id,
    internal_listing_id: null, listing_id: null, revision: 0, listing_status: null,
    seller_url_visible: false, suspension_reason: null, seller_visibility_approved_at: null,
  },
  history: [],
};
const linked: PublicListingOwnershipDetail = {
  ownership: {
    ...empty.ownership, internal_listing_id: 'internal-1', listing_id: listing.id,
    revision: 1, listing_status: 'active', suspension_reason: 'approval_required',
  },
  history: [{ action: 'seller_listing_ownership.linked', occurred_at: '2026-10-28T00:00:00Z',
    actor_user_id: 'admin-1', old_value: null,
    new_value: { public_listing_id: listing.id },
    event_metadata: { reason: 'Brokerage review' } }],
};
const approved: PublicListingOwnershipDetail = {
  ...linked, ownership: { ...linked.ownership, revision: 2, seller_url_visible: true,
    suspension_reason: null, seller_visibility_approved_at: '2026-10-28T01:00:00Z' },
};

function prepare({
  detail = empty,
  mapping = unmapped,
  listings = [listing],
}: {
  detail?: PublicListingOwnershipDetail;
  mapping?: PropertyMapping;
  listings?: ApiListing[];
} = {}) {
  jest.clearAllMocks();
  ownershipRead.mockResolvedValue(detail);
  mappingRead.mockResolvedValue(mapping);
  inventoryRead.mockResolvedValue({ items: listings, total: listings.length, page: 1, page_size: 20 });
  listingRead.mockResolvedValue(listing);
  attest.mockResolvedValue(mapped);
  link.mockResolvedValue(linked.ownership);
  unlink.mockResolvedValue(empty.ownership);
  reassign.mockResolvedValue(linked.ownership);
  approve.mockResolvedValue(approved.ownership);
  revoke.mockResolvedValue(linked.ownership);
  const changed = jest.fn().mockResolvedValue(undefined);
  render(<PublicListingAssociation transaction={transaction} onChanged={changed} onClose={jest.fn()} />);
  return changed;
}

async function choose() {
  fireEvent.click(await screen.findByRole('button', { name: /Fictional listing.*1 Main Street/i }));
  await screen.findByText(/Attested property:/i);
}

function confirm(name: RegExp) {
  fireEvent.click(screen.getByRole('checkbox', { name }));
}

async function openSection(name: string) {
  fireEvent.click(await screen.findByText(name));
}

test('shows the exact transaction property and truthful zero-listing state', async () => {
  prepare({ listings: [] });
  expect(await screen.findByText(/No active public listings match this search/i)).toBeTruthy();
  expect(screen.getByText(transaction.id)).toBeTruthy();
  expect(screen.getByText(transaction.property_id)).toBeTruthy();
  expect(screen.getByText(/canonical property ID, but not its address/i)).toBeTruthy();
  expect(screen.getByText(/No public listing linked/i)).toBeTruthy();
  expect(attest).not.toHaveBeenCalled();
});

test('requires complete evidence and records attestation without linking', async () => {
  prepare();
  await choose();
  fireEvent.click(screen.getByRole('button', { name: 'Record property attestation' }));
  expect(screen.getByRole('alert').textContent).toContain('verification basis, evidence reference, and reason');
  expect(attest).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Verification basis' }), { target: { value: ' signed agreement ' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Evidence reference' }), { target: { value: ' agreement-1 ' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Attestation reason' }), { target: { value: ' Reviewed ' } });
  confirm(/I reviewed evidence for this exact listing/i);
  fireEvent.click(screen.getByRole('button', { name: 'Record property attestation' }));
  await waitFor(() => expect(attest).toHaveBeenCalledWith(transaction.id, {
    listing_id: listing.id, expected_mapping_revision: 0,
    verification_basis: 'signed agreement', evidence_reference: 'agreement-1', reason: 'Reviewed',
  }));
  expect(link).not.toHaveBeenCalled();
  expect(approve).not.toHaveBeenCalled();
  expect(screen.getByText(/application has not independently authenticated/i)).toBeTruthy();
});

test('links an attested exact listing with revision and keeps seller URL unapproved', async () => {
  const changed = prepare({ mapping: mapped });
  ownershipRead.mockResolvedValueOnce(empty).mockResolvedValue(linked);
  await choose();
  await openSection('3. Link or replace current public listing');
  fireEvent.change(screen.getByRole('textbox', { name: 'Link or replacement reason' }), { target: { value: ' Broker review ' } });
  confirm(/I confirm the selected listing ID/i);
  fireEvent.click(screen.getByRole('button', { name: 'Link public listing' }));
  await waitFor(() => expect(link).toHaveBeenCalledWith(transaction.id, {
    listing_id: listing.id, expected_revision: 0, reason: 'Broker review',
  }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(approve).not.toHaveBeenCalled();
  expect(await screen.findByText(/seller portal URL remains unapproved/i)).toBeTruthy();
});

test('replaces a current link using the latest ownership revision and clears approval in UI copy', async () => {
  const replacement = { ...listing, id: 'listing-2', address: '2 Main Street' };
  prepare({ detail: approved, mapping: { ...mapped, listing_id: replacement.id }, listings: [replacement] });
  fireEvent.click(await screen.findByRole('button', { name: /Fictional listing.*2 Main Street/i }));
  await screen.findByText(/Attested property:/i);
  await openSection('3. Link or replace current public listing');
  fireEvent.change(screen.getByRole('textbox', { name: 'Link or replacement reason' }), { target: { value: 'New listing' } });
  confirm(/I confirm the selected listing ID/i);
  fireEvent.click(screen.getByRole('button', { name: 'Replace public listing' }));
  await waitFor(() => expect(link).toHaveBeenCalledWith(transaction.id, {
    listing_id: replacement.id, expected_revision: 2, reason: 'New listing',
  }));
  expect(approve).not.toHaveBeenCalled();
});

test('approves seller URL separately and supports independent revocation', async () => {
  prepare({ detail: linked });
  ownershipRead.mockResolvedValueOnce(linked).mockResolvedValue(approved);
  fireEvent.change(await screen.findByRole('textbox', { name: 'Approval reason' }), { target: { value: ' Reviewed URL ' } });
  confirm(/I reviewed this eligible association/i);
  fireEvent.click(screen.getByRole('button', { name: 'Approve seller URL' }));
  await waitFor(() => expect(approve).toHaveBeenCalledWith(transaction.id, {
    expected_revision: 1, reason: 'Reviewed URL',
  }));
  expect(link).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getAllByText(/Seller portal URL approved and currently visible/i)).toHaveLength(2));
  fireEvent.change(screen.getByRole('textbox', { name: 'Revocation reason' }), { target: { value: 'Withdrawn' } });
  confirm(/I confirm immediate revocation/i);
  fireEvent.click(screen.getByRole('button', { name: 'Revoke seller URL' }));
  await waitFor(() => expect(revoke).toHaveBeenCalledWith(transaction.id, {
    expected_revision: 2, reason: 'Withdrawn',
  }));
  expect(unlink).not.toHaveBeenCalled();
  expect(screen.getByText(/cannot erase a public URL someone previously copied/i)).toBeTruthy();
});

test('shows suspended approval and blocks approval for an ineligible listing', async () => {
  prepare({ detail: {
    ...approved,
    ownership: { ...approved.ownership, listing_status: 'off_market',
      seller_url_visible: false, suspension_reason: 'listing_ineligible' },
  } });
  expect(await screen.findByText(/Status: off_market/i)).toBeTruthy();
  expect(screen.getAllByText(/Previously approved, now suspended/i).length).toBeGreaterThan(0);
  expect(screen.getByText('Stored seller URL approval: Approved')).toBeTruthy();
  expect(screen.getByText('Effective seller URL visibility: Hidden')).toBeTruthy();
  expect(screen.getByText(/Association eligibility: Ineligible/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Approve seller URL' }).hasAttribute('disabled')).toBe(true);
  expect(approve).not.toHaveBeenCalled();
});

test('unlinks only after reason and confirmation, preserving audit history', async () => {
  prepare({ detail: linked });
  await openSection('Unlink current public listing');
  fireEvent.click(screen.getByRole('button', { name: 'Unlink public listing' }));
  expect(screen.getByRole('alert').textContent).toContain('Enter an unlink reason');
  expect(unlink).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Unlink reason' }), { target: { value: 'Seller instructed' } });
  confirm(/I confirm removal of this transaction/i);
  fireEvent.click(screen.getByRole('button', { name: 'Unlink public listing' }));
  await waitFor(() => expect(unlink).toHaveBeenCalledWith(transaction.id, {
    expected_revision: 1, reason: 'Seller instructed',
  }));
  await openSection('Ownership audit history (1)');
  expect(screen.getByText(/Brokerage review/i)).toBeTruthy();
});

test('uses the atomic reassignment contract only for a matching canonical property', async () => {
  prepare();
  const source = { ...linked, ownership: { ...linked.ownership, transaction_id: 'source-1', revision: 7 } };
  ownershipRead.mockImplementation(async (id) => id === 'source-1' ? source : empty);
  await openSection('Atomic reassignment from another transaction');
  fireEvent.change(screen.getByRole('textbox', { name: 'Source transaction ID' }), { target: { value: 'source-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review source ownership' }));
  await screen.findByText(/Source revision: 7/i);
  fireEvent.change(screen.getByRole('textbox', { name: 'Reassignment reason' }), { target: { value: 'New representation' } });
  confirm(/I confirm the exact source, destination/i);
  fireEvent.click(screen.getByRole('button', { name: 'Reassign public listing' }));
  await waitFor(() => expect(reassign).toHaveBeenCalledWith(transaction.id, {
    listing_id: listing.id, from_transaction_id: 'source-1',
    expected_from_revision: 7, expected_revision: 0, reason: 'New representation',
  }));
  expect(approve).not.toHaveBeenCalled();
});

test('blocks a different-property reassignment before submission', async () => {
  prepare();
  const source = { ...linked, ownership: { ...linked.ownership, transaction_id: 'source-2', property_id: 'property-2' } };
  ownershipRead.mockImplementation(async (id) => id === 'source-2' ? source : empty);
  await openSection('Atomic reassignment from another transaction');
  fireEvent.change(screen.getByRole('textbox', { name: 'Source transaction ID' }), { target: { value: 'source-2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review source ownership' }));
  expect(await screen.findByText(/Canonical property IDs differ/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Reassign public listing' }).hasAttribute('disabled')).toBe(true);
});

test.each([
  ['Listing has no attested mapping to this transaction property', 'Compare the exact canonical property IDs'],
  ['Listing belongs to another transaction', 'Use atomic reassignment'],
  ['Public listing is not active and displayable', 'Check the listing and representation status'],
  ['Active representation and an open seller portal are required', 'Check the listing and representation status'],
])('shows actionable backend rejection: %s', async (backendDetail, guidance) => {
  prepare({ mapping: mapped });
  link.mockRejectedValue({ response: { status: 409, data: { detail: backendDetail } } });
  await choose();
  await openSection('3. Link or replace current public listing');
  fireEvent.change(screen.getByRole('textbox', { name: 'Link or replacement reason' }), { target: { value: 'Review' } });
  confirm(/I confirm the selected listing ID/i);
  fireEvent.click(screen.getByRole('button', { name: 'Link public listing' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain(backendDetail);
  expect(alert.textContent).toContain(guidance);
});

test('stale revision refreshes state and clears confirmation without retrying', async () => {
  prepare({ mapping: mapped });
  link.mockRejectedValue({ response: { status: 409, data: { detail: 'Stale ownership revision' } } });
  await choose();
  await openSection('3. Link or replace current public listing');
  fireEvent.change(screen.getByRole('textbox', { name: 'Link or replacement reason' }), { target: { value: 'Review' } });
  confirm(/I confirm the selected listing ID/i);
  fireEvent.click(screen.getByRole('button', { name: 'Link public listing' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Review and confirm the action again');
  expect(ownershipRead.mock.calls.length).toBeGreaterThan(1);
  expect(screen.getByRole('checkbox', { name: /I confirm the selected listing ID/i })).toHaveProperty('checked', false);
  expect(link).toHaveBeenCalledTimes(1);
});

test('reports a completed mutation accurately when refreshing details fails', async () => {
  prepare({ mapping: mapped });
  ownershipRead.mockResolvedValueOnce(empty).mockRejectedValueOnce(new Error('Network unavailable'));
  await choose();
  await openSection('3. Link or replace current public listing');
  fireEvent.change(screen.getByRole('textbox', { name: 'Link or replacement reason' }), { target: { value: 'Review' } });
  confirm(/I confirm the selected listing ID/i);
  fireEvent.click(screen.getByRole('button', { name: 'Link public listing' }));
  expect((await screen.findByRole('alert')).textContent).toContain('The action completed, but current details could not be refreshed');
  expect(await screen.findByText(/Association details are unavailable/i)).toBeTruthy();
  expect(link).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Link public listing' })).toBeNull();
});

test('prevents duplicate link submissions while the first request is pending', async () => {
  prepare({ mapping: mapped });
  let finish!: (value: typeof linked.ownership) => void;
  link.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await choose();
  await openSection('3. Link or replace current public listing');
  fireEvent.change(screen.getByRole('textbox', { name: 'Link or replacement reason' }), { target: { value: 'Review' } });
  confirm(/I confirm the selected listing ID/i);
  const button = screen.getByRole('button', { name: 'Link public listing' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(link).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Linking…' }).hasAttribute('disabled')).toBe(true);
  finish(linked.ownership);
  await screen.findByRole('status', { name: '' });
});
