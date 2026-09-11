import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FailedSubmissionsPage from '@/app/admin/failed-submissions/page';
import {
  dismissLog,
  fetchFailedContactSubmissions,
} from '@/services/systemLogService';
import type { SystemLog } from '@/types/api';

/**
 * Controls 2.10 and 5.10 — *"alert staff when recovery fails"*.
 *
 * The contact form already recorded failures so nothing was silently lost.
 * Without a screen the record existed and nobody knew, which is the same
 * silent lead loss moved one step later.
 */

jest.mock('@/services/systemLogService', () => {
  const actual = jest.requireActual('@/services/systemLogService');
  return {
    ...actual,
    fetchFailedContactSubmissions: jest.fn(),
    dismissLog: jest.fn(),
  };
});

const mockFetch = fetchFailedContactSubmissions as jest.MockedFunction<
  typeof fetchFailedContactSubmissions
>;
const mockDismiss = dismissLog as jest.MockedFunction<typeof dismissLog>;

function log(over: Partial<SystemLog> = {}): SystemLog {
  return {
    id: 'l1',
    level: 'error',
    source: 'lead_capture.contact_form',
    message: 'Contact form submission could not be persisted.',
    log_data: {
      first_name: 'Dana',
      last_name: 'Okafor',
      email: 'dana@example.com',
      phone: '+1 613 555 0100',
      topic: 'Buying',
      message_length: 48,
    },
    user_id: null,
    created_at: '2026-09-05T10:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue([log()]);
  mockDismiss.mockResolvedValue(log());
});

test('shows enough to honour the enquiry by hand', async () => {
  render(<FailedSubmissionsPage />);

  await waitFor(() => expect(screen.getByText('Dana Okafor')).toBeTruthy());
  expect(screen.getByText('dana@example.com')).toBeTruthy();
  expect(screen.getByText(/\+1 613 555 0100/)).toBeTruthy();
  expect(screen.getByText(/Buying/)).toBeTruthy();
});

test('the email is a mailto link, so following up is one click', async () => {
  render(<FailedSubmissionsPage />);

  await waitFor(() => expect(screen.getByText('dana@example.com')).toBeTruthy());
  expect(screen.getByText('dana@example.com').getAttribute('href')).toBe(
    'mailto:dana@example.com',
  );
});

test('counts what needs following up', async () => {
  render(<FailedSubmissionsPage />);

  await waitFor(() => expect(screen.getByText(/1 enquiry needs/)).toBeTruthy());
});

test('says the message body was not kept, because it was not', async () => {
  // Deliberate: only `message_length` is stored, to keep free-text PII out of
  // the log store. Staff must ask rather than assume they have it.
  render(<FailedSubmissionsPage />);

  await waitFor(() => expect(screen.getByText(/message itself was not kept/)).toBeTruthy());
});

test('an empty queue reads as good news, not as an empty table', async () => {
  mockFetch.mockResolvedValue([]);
  render(<FailedSubmissionsPage />);

  await waitFor(() =>
    expect(screen.getByText(/Every contact submission has saved successfully/)).toBeTruthy(),
  );
});

test('a record can be marked handled and leaves the list', async () => {
  render(<FailedSubmissionsPage />);
  await waitFor(() => expect(screen.getByText('Dana Okafor')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Mark handled' }));

  await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('l1'));
  await waitFor(() => expect(screen.queryByText('Dana Okafor')).toBeNull());
});

test('a partial record still renders rather than breaking the page', async () => {
  // `log_data` is a free-shaped JSON column; an older row may lack fields.
  mockFetch.mockResolvedValue([log({ log_data: { topic: 'Buying' } })]);
  render(<FailedSubmissionsPage />);

  await waitFor(() => expect(screen.getByText('Name not recorded')).toBeTruthy());
  expect(screen.getByText(/No email recorded/)).toBeTruthy();
});

test('a failed load is reported', async () => {
  mockFetch.mockRejectedValue(new Error('network'));
  render(<FailedSubmissionsPage />);

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('Could not load');
});

test('a failed dismiss is reported and the row stays', async () => {
  mockDismiss.mockRejectedValue(new Error('network'));
  render(<FailedSubmissionsPage />);
  await waitFor(() => expect(screen.getByText('Dana Okafor')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Mark handled' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByText('Dana Okafor')).toBeTruthy();
});
