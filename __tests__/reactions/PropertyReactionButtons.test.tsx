import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PropertyReactionButtons } from '@/components/reactions/PropertyReactionButtons';
import {
  clearMyReaction,
  fetchMyReaction,
  setMyReaction,
} from '@/services/propertyReactionsService';

/**
 * Controls 6.10 and 6.11. The client's description is the specification:
 * "A buyer picks one, it replaces whatever they picked before, and they can
 * change or clear it at any time — one state per property, always reversible."
 */

jest.mock('@/services/propertyReactionsService', () => {
  const actual = jest.requireActual('@/services/propertyReactionsService');
  return {
    ...actual,
    fetchMyReaction: jest.fn(),
    setMyReaction: jest.fn(),
    clearMyReaction: jest.fn(),
  };
});

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

let authed = true;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ accessToken: authed ? 'token' : null }),
}));

const mockFetch = fetchMyReaction as jest.MockedFunction<typeof fetchMyReaction>;
const mockSet = setMyReaction as jest.MockedFunction<typeof setMyReaction>;
const mockClear = clearMyReaction as jest.MockedFunction<typeof clearMyReaction>;

const LISTING = 'listing-1';

function row(reaction: 'love' | 'maybe' | 'not_for_me') {
  return {
    id: 'r1',
    listing_id: LISTING,
    reaction,
    reacted_at: '2026-09-05T00:00:00Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  authed = true;
  mockFetch.mockResolvedValue(null);
  mockSet.mockImplementation(async (_id, reaction) => row(reaction));
  mockClear.mockResolvedValue(undefined);
});

const button = (name: string) => screen.getByRole('button', { name });

test('shows exactly the three reactions', async () => {
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  expect(button('Love')).toBeTruthy();
  expect(button('Maybe')).toBeTruthy();
  expect(button('Not for me')).toBeTruthy();
  expect(screen.getAllByRole('button')).toHaveLength(3);
});

test('renders nothing at all for a signed-out visitor', () => {
  authed = false;
  const { container } = render(<PropertyReactionButtons listingId={LISTING} />);

  // Plain DOM assertion — this repo does not load jest-dom.
  expect(container.innerHTML).toBe('');
  expect(mockFetch).not.toHaveBeenCalled();
});

test('picking one sends it and marks it active', async () => {
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  fireEvent.click(button('Maybe'));

  await waitFor(() => expect(mockSet).toHaveBeenCalledWith(LISTING, 'maybe'));
  expect(button('Maybe').getAttribute('aria-pressed')).toBe('true');
  expect(button('Love').getAttribute('aria-pressed')).toBe('false');
});

test('picking a second replaces the first — never two at once', async () => {
  mockFetch.mockResolvedValue(row('maybe'));
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() =>
    expect(button('Maybe').getAttribute('aria-pressed')).toBe('true'),
  );

  fireEvent.click(button('Love'));

  await waitFor(() =>
    expect(button('Love').getAttribute('aria-pressed')).toBe('true'),
  );
  expect(button('Maybe').getAttribute('aria-pressed')).toBe('false');
  expect(button('Not for me').getAttribute('aria-pressed')).toBe('false');
});

test('pressing the active one again clears it', async () => {
  // "Change or clear it at any time" — a second press is how you get back to
  // no reaction, without a fourth button for it.
  mockFetch.mockResolvedValue(row('love'));
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() =>
    expect(button('Love').getAttribute('aria-pressed')).toBe('true'),
  );

  fireEvent.click(button('Love'));

  await waitFor(() => expect(mockClear).toHaveBeenCalledWith(LISTING));
  expect(button('Love').getAttribute('aria-pressed')).toBe('false');
  expect(mockSet).not.toHaveBeenCalled();
});

test('Love says the home was saved to favourites', async () => {
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  fireEvent.click(button('Love'));

  await waitFor(() => expect(screen.getByText(/Saved to your favourites/)).toBeTruthy());
});

test('Not for me offers an undo, as asked for by name', async () => {
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  fireEvent.click(button('Not for me'));

  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  expect(screen.getByRole('status').textContent).toContain('Hidden from your browsing');
  expect(button('Undo')).toBeTruthy();
});

test('the undo clears the reaction and removes itself', async () => {
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  fireEvent.click(button('Not for me'));
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());

  fireEvent.click(button('Undo'));

  await waitFor(() => expect(mockClear).toHaveBeenCalledWith(LISTING));
  expect(screen.queryByRole('status')).toBeNull();
  expect(button('Not for me').getAttribute('aria-pressed')).toBe('false');
});

test('the parent is told what changed, so a list can drop a hidden card', async () => {
  const onChange = jest.fn();
  render(<PropertyReactionButtons listingId={LISTING} onChange={onChange} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  fireEvent.click(button('Not for me'));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('not_for_me'));

  fireEvent.click(button('Undo'));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
});

test('an existing reaction is shown on load', async () => {
  mockFetch.mockResolvedValue(row('not_for_me'));
  render(<PropertyReactionButtons listingId={LISTING} />);

  await waitFor(() =>
    expect(button('Not for me').getAttribute('aria-pressed')).toBe('true'),
  );
});

test('a failed save is reported and the state does not move', async () => {
  mockSet.mockRejectedValue(new Error('network'));
  render(<PropertyReactionButtons listingId={LISTING} />);
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());

  fireEvent.click(button('Maybe'));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(button('Maybe').getAttribute('aria-pressed')).toBe('false');
});

test('a failed read leaves the buttons usable rather than blocking', async () => {
  mockFetch.mockRejectedValue(new Error('network'));
  render(<PropertyReactionButtons listingId={LISTING} />);

  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  expect(button('Love')).toBeTruthy();
  expect(button('Love').getAttribute('aria-pressed')).toBe('false');
});
