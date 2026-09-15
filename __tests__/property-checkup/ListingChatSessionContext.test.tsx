/**
 * The context restore-on-mount behavior is the actual fix for: "Ask a Lucy
 * representative" while signed out opens the chat's login gate, which
 * navigates to a real /login page — unmounting this provider and losing
 * whatever was only held in React state. On the next mount (returning from
 * login), the provider must pick the request back up from localStorage.
 */

import { render, screen } from '@testing-library/react';

import { savePendingRepresentativeRequest } from '@/lib/pendingRepresentativeRequest';
import {
  ListingChatSessionProvider,
  useListingChatSession,
} from '@/components/listings/detail/ListingChatSessionContext';

beforeEach(() => {
  localStorage.clear();
});

function Probe() {
  const { pendingRepresentativeRequest, representativeRequestStatus } = useListingChatSession();
  return (
    <div>
      <span data-testid="rule-id">{pendingRepresentativeRequest?.ruleId ?? 'none'}</span>
      <span data-testid="message">{pendingRepresentativeRequest?.message ?? 'none'}</span>
      <span data-testid="status">{representativeRequestStatus}</span>
    </div>
  );
}

describe('ListingChatSessionProvider restoring a pending representative request', () => {
  it('picks up a request left in storage for this listing on mount', () => {
    savePendingRepresentativeRequest('listing-1', 'septic_system', 'Is the septic system serviced?');

    render(
      <ListingChatSessionProvider listingId="listing-1">
        <Probe />
      </ListingChatSessionProvider>,
    );

    expect(screen.getByTestId('rule-id').textContent).toBe('septic_system');
    expect(screen.getByTestId('message').textContent).toBe('Is the septic system serviced?');
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });

  it('does not restore a request stored for a different listing', () => {
    savePendingRepresentativeRequest('listing-2', 'septic_system', 'Is the septic system serviced?');

    render(
      <ListingChatSessionProvider listingId="listing-1">
        <Probe />
      </ListingChatSessionProvider>,
    );

    expect(screen.getByTestId('rule-id').textContent).toBe('none');
    expect(screen.getByTestId('status').textContent).toBe('idle');
  });

  it('starts idle with nothing pending when storage is empty', () => {
    render(
      <ListingChatSessionProvider listingId="listing-1">
        <Probe />
      </ListingChatSessionProvider>,
    );

    expect(screen.getByTestId('rule-id').textContent).toBe('none');
    expect(screen.getByTestId('status').textContent).toBe('idle');
  });
});
