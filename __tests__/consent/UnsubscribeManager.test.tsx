import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UnsubscribeManager } from '@/components/consent/UnsubscribeManager';
import {
  fetchUnsubscribeState,
  resubscribeStream,
  unsubscribeStream,
} from '@/services/unsubscribeService';

/**
 * The unsubscribe page, which has to work with no session at all.
 *
 * These cover the parts the client asked for by name: a separate choice per
 * stream, a stop-all, showing what was turned off, and an undo for the
 * accidental tap.
 */

let searchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

jest.mock('@/services/unsubscribeService', () => {
  const actual = jest.requireActual('@/services/unsubscribeService');
  return {
    ...actual,
    fetchUnsubscribeState: jest.fn(),
    unsubscribeStream: jest.fn(),
    resubscribeStream: jest.fn(),
  };
});

const mockFetch = fetchUnsubscribeState as jest.MockedFunction<typeof fetchUnsubscribeState>;
const mockUnsubscribe = unsubscribeStream as jest.MockedFunction<typeof unsubscribeStream>;
const mockResubscribe = resubscribeStream as jest.MockedFunction<typeof resubscribeStream>;

const ALL_ON = {
  email: 'buyer@example.com',
  streams: {
    marketing: true,
    listing_alert: true,
    product_update: true,
    saved_search_alert: true,
  },
  stop_all: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  searchParams = new URLSearchParams('token=valid-token');
  mockFetch.mockResolvedValue(ALL_ON);
});

test('shows every stream separately, with its current state', async () => {
  render(<UnsubscribeManager />);

  await waitFor(() => expect(screen.getByText('Email preferences')).toBeTruthy());

  expect(screen.getByText('Lucy updates and offers')).toBeTruthy();
  expect(screen.getByText('New listing alerts')).toBeTruthy();
  expect(screen.getByText('Product news')).toBeTruthy();
  expect(screen.getByText('Daily saved-search matches')).toBeTruthy();
  // One "Unsubscribe" button per stream, because each choice is independent.
  expect(screen.getAllByRole('button', { name: 'Unsubscribe' })).toHaveLength(4);
});

test('names the address the link resolved to, and says no sign-in is needed', async () => {
  render(<UnsubscribeManager />);

  await waitFor(() => expect(screen.getByText('buyer@example.com')).toBeTruthy());
  expect(screen.getByText(/do not need to sign in/)).toBeTruthy();
});

test('unsubscribing one stream leaves the rest on', async () => {
  mockUnsubscribe.mockResolvedValue({
    ...ALL_ON,
    streams: { ...ALL_ON.streams, marketing: false },
  });
  render(<UnsubscribeManager />);
  await waitFor(() => expect(screen.getByText('Email preferences')).toBeTruthy());

  fireEvent.click(screen.getAllByRole('button', { name: 'Unsubscribe' })[0]);

  await waitFor(() =>
    expect(mockUnsubscribe).toHaveBeenCalledWith('valid-token', 'marketing'),
  );
  // Confirms what was turned off — a client requirement.
  expect(screen.getByRole('status').textContent).toContain('switched off');
  expect(screen.getAllByRole('button', { name: 'Unsubscribe' })).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Resubscribe' })).toBeTruthy();
});

test('an accidental unsubscribe can be undone one stream at a time', async () => {
  mockFetch.mockResolvedValue({
    ...ALL_ON,
    streams: { ...ALL_ON.streams, marketing: false },
  });
  mockResubscribe.mockResolvedValue(ALL_ON);
  render(<UnsubscribeManager />);
  await waitFor(() => expect(screen.getByText('Email preferences')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Resubscribe' }));

  await waitFor(() =>
    expect(mockResubscribe).toHaveBeenCalledWith('valid-token', 'marketing'),
  );
  expect(screen.getByRole('status').textContent).toContain('switched back on');
});

test('the stop-all control switches off everything promotional', async () => {
  mockUnsubscribe.mockResolvedValue({
    email: 'buyer@example.com',
    streams: {
      marketing: false,
      listing_alert: false,
      product_update: false,
      saved_search_alert: false,
    },
    stop_all: true,
  });
  render(<UnsubscribeManager />);
  await waitFor(() => expect(screen.getByText('Email preferences')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Stop all promotional emails' }));

  await waitFor(() =>
    expect(mockUnsubscribe).toHaveBeenCalledWith('valid-token', 'all_promotional'),
  );
  // With nothing left on, the control is replaced by a statement of the fact,
  // and by the reassurance that service email still arrives.
  expect(screen.getByText(/not receiving any promotional emails/)).toBeTruthy();
  expect(screen.getByText(/still get service emails/)).toBeTruthy();
});

test('a stop_all link applies immediately on arrival, so the footer is one click', async () => {
  searchParams = new URLSearchParams('token=valid-token&stop_all=1');
  mockUnsubscribe.mockResolvedValue({
    email: 'buyer@example.com',
    streams: {
      marketing: false,
      listing_alert: false,
      product_update: false,
      saved_search_alert: false,
    },
    stop_all: true,
  });

  render(<UnsubscribeManager />);

  await waitFor(() =>
    expect(mockUnsubscribe).toHaveBeenCalledWith('valid-token', 'all_promotional'),
  );
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toContain('now switched off');
});

test('a link with no token explains itself instead of calling the API', async () => {
  searchParams = new URLSearchParams();

  render(<UnsubscribeManager />);

  expect(screen.getByText('We could not open this link')).toBeTruthy();
  expect(screen.getByText(/missing its token/)).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
});

test('a rejected token shows a recoverable message, not a blank page', async () => {
  mockFetch.mockRejectedValue({
    response: { status: 400, data: { detail: 'This unsubscribe link is not valid.' } },
  });

  render(<UnsubscribeManager />);

  await waitFor(() =>
    expect(screen.getByText('We could not open this link')).toBeTruthy(),
  );
  expect(screen.getByText(/not valid/)).toBeTruthy();
});

test('a failed change keeps the page usable and reports the error', async () => {
  mockUnsubscribe.mockRejectedValue(new Error('network'));
  render(<UnsubscribeManager />);
  await waitFor(() => expect(screen.getByText('Email preferences')).toBeTruthy());

  fireEvent.click(screen.getAllByRole('button', { name: 'Unsubscribe' })[0]);

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('could not save');
  // Still on, because the change did not take.
  expect(screen.getAllByRole('button', { name: 'Unsubscribe' })).toHaveLength(4);
});
