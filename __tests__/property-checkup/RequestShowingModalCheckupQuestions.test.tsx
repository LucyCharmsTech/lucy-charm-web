/**
 * The pending Property Checkup questions list inside "Request a Showing" —
 * only ever populated from the server-side "Add to showing questions" list
 * (signed-in only). "Save question" is a separate, personal bookmark
 * (Clarifications Part 2 §7) and must never appear here, even when the
 * buyer is signed in — the two actions have deliberately different jobs.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useAuthStore } from '@/stores/authStore';

jest.mock('@/services/showingService', () => ({
  submitShowingRequest: jest.fn(),
}));
jest.mock('@/services/propertyCheckupService', () => ({
  fetchShowingQuestions: jest.fn(),
  deletePropertyCheckupQuestion: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

import { fetchShowingQuestions, deletePropertyCheckupQuestion } from '@/services/propertyCheckupService';
import RequestShowingModal from '@/components/listings/detail/RequestShowingModal';

const mockFetchShowingQuestions = fetchShowingQuestions as jest.MockedFunction<
  typeof fetchShowingQuestions
>;
const mockDelete = deletePropertyCheckupQuestion as jest.Mock;

// jsdom does not implement <dialog>.showModal()/close().
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  mockFetchShowingQuestions.mockResolvedValue([]);
});

describe('signed out', () => {
  it('never fetches or shows a pending-questions list — "Add to showing questions" requires sign-in', () => {
    render(
      <RequestShowingModal open listingId="listing-1" listingTitle="123 Main St" onClose={jest.fn()} />,
    );
    expect(mockFetchShowingQuestions).not.toHaveBeenCalled();
    expect(screen.queryByText(/sending these questions/i)).toBeNull();
  });
});

describe('signed in', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      user: { user_id: 'u1', email: 'buyer@example.com', first_name: 'B', last_name: 'Buyer' },
    });
  });

  it('fetches and shows the server-side showing questions', async () => {
    mockFetchShowingQuestions.mockResolvedValue([
      {
        id: 'q1',
        listing_id: 'listing-1',
        source_rule_id: 'well_water',
        question_text: 'Is the water tested regularly?',
        kind: 'showing_question',
        showing_request_id: null,
        status: 'open',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);

    render(
      <RequestShowingModal open listingId="listing-1" listingTitle="123 Main St" onClose={jest.fn()} />,
    );

    await screen.findByText('Is the water tested regularly?');
  });

  it('lets the buyer remove a pending showing question before submitting', async () => {
    mockFetchShowingQuestions.mockResolvedValue([
      {
        id: 'q1',
        listing_id: 'listing-1',
        source_rule_id: 'well_water',
        question_text: 'Is the water tested regularly?',
        kind: 'showing_question',
        showing_request_id: null,
        status: 'open',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    mockDelete.mockResolvedValue(undefined);

    render(
      <RequestShowingModal open listingId="listing-1" listingTitle="123 Main St" onClose={jest.fn()} />,
    );
    await screen.findByText('Is the water tested regularly?');

    fireEvent.click(
      screen.getByRole('button', { name: /remove "is the water tested regularly\?" from this request/i }),
    );

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('q1'));
    await waitFor(() => expect(screen.queryByText('Is the water tested regularly?')).toBeNull());
  });
});
