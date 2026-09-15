/**
 * The expanded Property Checkup panel: loading -> result / zero-match /
 * unavailable, the two buyer actions, and the Deeper Property Review flow.
 * See docs/property_checkup.md and Clarifications Part 1 §4, §5, §7, §8.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useAuthStore } from '@/stores/authStore';
import type { PropertyCheckup } from '@/types/api';

jest.mock('@/services/propertyCheckupService', () => ({
  fetchPropertyCheckup: jest.fn(),
  fetchMyCheckupQuestions: jest.fn(),
  addPropertyCheckupQuestion: jest.fn(),
  deletePropertyCheckupQuestion: jest.fn(),
  requestDeeperReview: jest.fn(),
}));
jest.mock('@/services/savedListingsService', () => ({
  checkListingSaved: jest.fn().mockResolvedValue({ saved: false, saved_listing_id: null }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/components/listings/detail/ListingChatSessionContext', () => ({
  useListingChatSession: jest.fn(),
}));

import {
  addPropertyCheckupQuestion,
  deletePropertyCheckupQuestion,
  fetchMyCheckupQuestions,
  fetchPropertyCheckup,
  requestDeeperReview,
} from '@/services/propertyCheckupService';
import { useListingChatSession } from '@/components/listings/detail/ListingChatSessionContext';
import PropertyCheckupPanel from '@/components/listings/detail/PropertyCheckupPanel';

const mockFetch = fetchPropertyCheckup as jest.MockedFunction<typeof fetchPropertyCheckup>;
const mockFetchMyQuestions = fetchMyCheckupQuestions as jest.MockedFunction<
  typeof fetchMyCheckupQuestions
>;
const mockAddQuestion = addPropertyCheckupQuestion as jest.Mock;
const mockDeleteQuestion = deletePropertyCheckupQuestion as jest.Mock;
const mockRequestReview = requestDeeperReview as jest.Mock;
const mockUseListingChatSession = useListingChatSession as jest.Mock;
const mockRequestRepresentative = jest.fn();

function checkupWithItems(overrides: Partial<PropertyCheckup> = {}): PropertyCheckup {
  return {
    listing_id: 'listing-1',
    zero_match: false,
    generated_at: '2026-01-01T00:00:00Z',
    rules_version: 'CA-ON-2026.08.1',
    first_view_limit: 5,
    items: [
      {
        rule_id: 'septic_system',
        listing_states: 'Private septic system',
        worth_verifying: 'System age, service and inspection history',
        why_it_matters: 'This can help confirm the system has been properly maintained.',
        priority: 1,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  mockFetchMyQuestions.mockResolvedValue([]);
  mockUseListingChatSession.mockReturnValue({
    aiSessionId: null,
    setAiSessionId: jest.fn(),
    pendingRepresentativeRequest: null,
    representativeRequestStatus: 'idle',
    askedRepresentativeRuleIds: new Set(),
    requestRepresentative: mockRequestRepresentative,
    resolveRepresentativeRequest: jest.fn(),
  });
});

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    listing_id: 'listing-1',
    source_rule_id: 'septic_system',
    question_text: 'System age, service and inspection history',
    kind: 'saved' as const,
    showing_request_id: null,
    status: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('loading and error states', () => {
  it('shows a loading state before the checkup resolves', async () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByRole('status', { name: /loading property checkup/i });
  });

  it('shows the unavailable state on a fetch failure, never a guessed result', async () => {
    mockFetch.mockRejectedValue(new Error('503'));
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/temporarily unavailable/i);
  });

  it('shows the neutral zero-match copy, distinct from the unavailable copy', async () => {
    mockFetch.mockResolvedValue(checkupWithItems({ items: [], zero_match: true }));
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/nothing additional stands out/i);
    expect(screen.queryByText(/temporarily unavailable/i)).toBeNull();
  });
});

describe('rendered items', () => {
  it('renders the listing_states, worth_verifying, and why_it_matters copy exactly as returned, each with its approved label', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);

    await screen.findByText(/Listing states: Private septic system/);
    screen.getByText(/Worth verifying: System age, service and inspection history/);
    screen.getByText(/Why it matters: This can help confirm the system has been properly maintained\./);
  });

  it('never shows the internal priority number to the buyer', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);
    // Priority is an internal ranking value only (spec B) — must not leak
    // as visible "P1" / "1" text anywhere in the item.
    expect(screen.queryByText(/^P1$/)).toBeNull();
  });
});

describe('"View full checkup"', () => {
  function manyItems(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      rule_id: `rule_${i}`,
      listing_states: `Listing state ${i}`,
      worth_verifying: `Worth verifying ${i}`,
      why_it_matters: `Why it matters ${i}`,
      priority: 1,
    }));
  }

  it('does not appear when there is nothing beyond the first view', async () => {
    mockFetch.mockResolvedValue(checkupWithItems({ items: manyItems(5), first_view_limit: 5 }));
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Listing state 0/);
    await screen.findByText(/Listing states: Listing state 4/);
    expect(screen.queryByRole('button', { name: /view full checkup/i })).toBeNull();
  });

  it('caps the first view and reveals the rest on tap', async () => {
    mockFetch.mockResolvedValue(checkupWithItems({ items: manyItems(7), first_view_limit: 5 }));
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Listing state 0/);
    await screen.findByText(/Listing states: Listing state 4/);
    expect(screen.queryByText(/Listing states: Listing state 5/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /view full checkup/i }));

    await screen.findByText(/Listing states: Listing state 5/);
    await screen.findByText(/Listing states: Listing state 6/);
    expect(screen.queryByRole('button', { name: /view full checkup/i })).toBeNull();
  });
});

describe('"Property Checkup updated since your last visit"', () => {
  it('stays hidden the first time this browser ever sees the listing', async () => {
    mockFetch.mockResolvedValue(checkupWithItems({ generated_at: '2026-01-01T00:00:00Z' }));
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);
    expect(screen.queryByText(/updated since your last visit/i)).toBeNull();
  });

  it('appears on a later open whose generated_at differs from the one last recorded', async () => {
    mockFetch.mockResolvedValue(checkupWithItems({ generated_at: '2026-01-01T00:00:00Z' }));
    const { unmount } = render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);
    unmount();

    mockFetch.mockResolvedValue(checkupWithItems({ generated_at: '2026-02-01T00:00:00Z' }));
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);
    await screen.findByText(/updated since your last visit/i);
  });
});

describe('signed-out "Save question"', () => {
  it('saves locally without calling the API when signed out', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save question/i }));
    });

    expect(mockAddQuestion).not.toHaveBeenCalled();
    await screen.findByText(/saved on this device/i);
  });

  it('does not show "Add to showing questions" when signed out', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);
    expect(
      screen.queryByRole('button', { name: /add to showing questions/i }),
    ).toBeNull();
  });

  it('clicking a saved question again un-saves it, without calling the API', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    const button = screen.getByRole('button', { name: /save question/i });
    await act(async () => fireEvent.click(button));
    await screen.findByText(/saved on this device/i);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: /saved on this device/i })));

    expect(mockDeleteQuestion).not.toHaveBeenCalled();
    await screen.findByText(/^save question$/i);
  });
});

describe('"Ask a Lucy representative"', () => {
  it('is available even when signed out', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);
    screen.getByRole('button', { name: /^ask a lucy representative$/i });
  });

  it('queues the request with the rule id and the property + question attached, no retyping', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    fireEvent.click(screen.getByRole('button', { name: /^ask a lucy representative$/i }));

    expect(mockRequestRepresentative).toHaveBeenCalledWith(
      'septic_system',
      'Private septic system: System age, service and inspection history?',
    );
  });

  it('shows "Asking…" and is disabled while this item\'s request is pending, not marked done optimistically', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockUseListingChatSession.mockReturnValue({
      aiSessionId: null,
      setAiSessionId: jest.fn(),
      pendingRepresentativeRequest: { ruleId: 'septic_system', message: 'anything' },
      representativeRequestStatus: 'pending',
      askedRepresentativeRuleIds: new Set(),
      requestRepresentative: mockRequestRepresentative,
      resolveRepresentativeRequest: jest.fn(),
    });
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    const button = screen.getByRole('button', { name: /asking…/i });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText(/^asked a lucy representative$/i)).toBeNull();
  });

  it('only shows "Asked" once the widget actually reports success for this item\'s rule', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockUseListingChatSession.mockReturnValue({
      aiSessionId: null,
      setAiSessionId: jest.fn(),
      pendingRepresentativeRequest: null,
      representativeRequestStatus: 'idle',
      askedRepresentativeRuleIds: new Set(['septic_system']),
      requestRepresentative: mockRequestRepresentative,
      resolveRepresentativeRequest: jest.fn(),
    });
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    const button = screen.getByRole('button', { name: /asked a lucy representative/i });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('offers a retry, not a dead end, when the escalation fails', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockUseListingChatSession.mockReturnValue({
      aiSessionId: null,
      setAiSessionId: jest.fn(),
      pendingRepresentativeRequest: { ruleId: 'septic_system', message: 'Private septic system: System age, service and inspection history?' },
      representativeRequestStatus: 'error',
      askedRepresentativeRuleIds: new Set(),
      requestRepresentative: mockRequestRepresentative,
      resolveRepresentativeRequest: jest.fn(),
    });
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    const button = screen.getByRole('button', { name: /could not reach a representative.*retry/i });
    expect(button.hasAttribute('disabled')).toBe(false);

    fireEvent.click(button);
    expect(mockRequestRepresentative).toHaveBeenCalledWith(
      'septic_system',
      'Private septic system: System age, service and inspection history?',
    );
  });
});

describe('signed-in buyer actions', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      user: { user_id: 'u1', email: 'buyer@example.com', first_name: 'B', last_name: 'Buyer' },
    });
  });

  it('calls the API and shows "Saved for later" when signed in', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockAddQuestion.mockResolvedValue({ id: 'question-1' });
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save question/i }));
    });

    expect(mockAddQuestion).toHaveBeenCalledWith({
      listing_id: 'listing-1',
      source_rule_id: 'septic_system',
      kind: 'saved',
    });
    await screen.findByText(/saved for later/i);
  });

  it('adds to showing questions using the rule id, never invented text', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockAddQuestion.mockResolvedValue({ id: 'question-1' });
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add to showing questions/i }));
    });

    expect(mockAddQuestion).toHaveBeenCalledWith({
      listing_id: 'listing-1',
      source_rule_id: 'septic_system',
      kind: 'showing_question',
    });
  });

  it('shows a saved question as green/checked, and un-saving calls delete with its id', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockAddQuestion.mockResolvedValue({ id: 'question-1' });
    mockDeleteQuestion.mockResolvedValue(undefined);
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save question/i }));
    });
    const savedButton = await screen.findByRole('button', { name: /saved for later/i });
    expect(savedButton.className).toMatch(/emerald/);
    expect(savedButton.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      fireEvent.click(savedButton);
    });

    expect(mockDeleteQuestion).toHaveBeenCalledWith('question-1');
    await screen.findByText(/^save question$/i);
  });

  it('un-adding a showing question calls delete with its id and reverts the button', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockAddQuestion.mockResolvedValue({ id: 'showing-question-1' });
    mockDeleteQuestion.mockResolvedValue(undefined);
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /add to showing questions/i }));
    });
    const addedButton = await screen.findByRole('button', { name: /added to showing questions/i });
    expect(addedButton.className).toMatch(/emerald/);

    await act(async () => {
      fireEvent.click(addedButton);
    });

    expect(mockDeleteQuestion).toHaveBeenCalledWith('showing-question-1');
    await screen.findByText(/^add to showing questions$/i);
  });
});

describe('state survives a refresh (hydration from the database)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      user: { user_id: 'u1', email: 'buyer@example.com', first_name: 'B', last_name: 'Buyer' },
    });
  });

  it('renders a previously saved question as already saved on first paint', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockFetchMyQuestions.mockResolvedValue([question({ id: 'saved-1', kind: 'saved' })]);

    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);

    const button = await screen.findByRole('button', { name: /saved for later/i });
    expect(button.className).toMatch(/emerald/);
    // Not a fresh add — the row already existed.
    expect(mockAddQuestion).not.toHaveBeenCalled();
  });

  it('renders a previously added showing question as already added', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockFetchMyQuestions.mockResolvedValue([
      question({ id: 'showing-1', kind: 'showing_question', status: 'open' }),
    ]);

    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);

    const button = await screen.findByRole('button', { name: /added to showing questions/i });
    expect(button.className).toMatch(/emerald/);
  });

  it('un-saving a hydrated row deletes it by its real database id', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockFetchMyQuestions.mockResolvedValue([question({ id: 'saved-1', kind: 'saved' })]);
    mockDeleteQuestion.mockResolvedValue(undefined);

    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    const button = await screen.findByRole('button', { name: /saved for later/i });

    await act(async () => fireEvent.click(button));

    expect(mockDeleteQuestion).toHaveBeenCalledWith('saved-1');
    await screen.findByText(/^save question$/i);
  });

  it('leaves both buttons idle when the buyer has actioned nothing yet', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockFetchMyQuestions.mockResolvedValue([]);

    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);

    await screen.findByText(/Listing states: Private septic system/);
    screen.getByRole('button', { name: /^save question$/i });
    screen.getByRole('button', { name: /^add to showing questions$/i });
  });

  it('never calls the hydration endpoint while signed out', async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
    mockFetch.mockResolvedValue(checkupWithItems());

    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);

    await screen.findByText(/Listing states: Private septic system/);
    expect(mockFetchMyQuestions).not.toHaveBeenCalled();
  });

  it('still renders the checkup when hydration fails', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    mockFetchMyQuestions.mockRejectedValue(new Error('500'));

    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);

    await screen.findByText(/Listing states: Private septic system/);
    screen.getByRole('button', { name: /^save question$/i });
  });
});

describe('Deeper Property Review', () => {
  it('prompts sign-in instead of the request form when signed out', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);
    screen.getByText(/sign in to request a deeper property review/i);
  });

  it('submits and shows the exact approved confirmation copy', async () => {
    useAuthStore.setState({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      user: { user_id: 'u1', email: 'buyer@example.com', first_name: 'B', last_name: 'Buyer' },
    });
    mockFetch.mockResolvedValue(checkupWithItems());
    mockRequestReview.mockResolvedValue({});
    render(<PropertyCheckupPanel listingId="listing-1" onClose={jest.fn()} />);
    await screen.findByText(/Listing states: Private septic system/);

    fireEvent.click(screen.getByRole('button', { name: /request a deeper property review/i }));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(mockRequestReview).toHaveBeenCalledWith({ listing_id: 'listing-1' }));
    await screen.findByText(/your request has been received/i);
  });
});

describe('close control', () => {
  it('calls onClose when the close button is clicked', async () => {
    mockFetch.mockResolvedValue(checkupWithItems());
    const onClose = jest.fn();
    render(<PropertyCheckupPanel listingId="listing-1" onClose={onClose} />);
    await screen.findByText(/Listing states: Private septic system/);
    fireEvent.click(screen.getByRole('button', { name: /close property checkup/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
