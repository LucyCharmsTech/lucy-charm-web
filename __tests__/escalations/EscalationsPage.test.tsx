import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EscalationsPage from '@/app/admin/escalations/page';
import {
  fetchEscalationConversation,
  fetchEscalations,
  updateEscalationStatus,
} from '@/services/escalationService';
import type { AiEscalation, AiMessage } from '@/types/api';

/**
 * Control 4.17: *"Authorized staff can review flagged conversations, feedback,
 * source/version context and failed actions without exposing internal content
 * to clients."*
 *
 * The backend was complete and escalations were being raised all along — there
 * was no screen, so they accumulated unread.
 */

jest.mock('@/services/escalationService', () => {
  const actual = jest.requireActual('@/services/escalationService');
  return {
    ...actual,
    fetchEscalations: jest.fn(),
    fetchEscalationConversation: jest.fn(),
    updateEscalationStatus: jest.fn(),
  };
});

const mockList = fetchEscalations as jest.MockedFunction<typeof fetchEscalations>;
const mockConvo = fetchEscalationConversation as jest.MockedFunction<
  typeof fetchEscalationConversation
>;
const mockUpdate = updateEscalationStatus as jest.MockedFunction<
  typeof updateEscalationStatus
>;

function escalation(over: Partial<AiEscalation> = {}): AiEscalation {
  return {
    id: 'e1',
    session_id: '11111111-2222-3333-4444-555555555555',
    reason: 'legal',
    assigned_agent_id: null,
    assigned_at: null,
    status: 'pending',
    created_at: '2026-09-05T10:00:00Z',
    updated_at: '2026-09-05T10:00:00Z',
    ...over,
  };
}

function message(over: Partial<AiMessage> = {}): AiMessage {
  return {
    id: 'm1',
    session_id: '11111111-2222-3333-4444-555555555555',
    listing_id: null,
    role: 'assistant',
    message_text: 'I cannot advise on title questions.',
    confidence_score: 0.42,
    source_data: null,
    model_version: 'gpt-4o-mini',
    page_url: null,
    prompt_version: 'v7',
    escalation_flag: true,
    created_at: '2026-09-05T10:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue({
    page: 1,
    page_size: 20,
    total: 1,
    items: [escalation()],
  });
  mockConvo.mockResolvedValue([
    message({ id: 'm0', role: 'user', message_text: 'Who owns the driveway?' }),
    message(),
  ]);
  mockUpdate.mockImplementation(async (_id, status) => escalation({ status }));
});

test('lists escalations with a readable reason, not the raw code', async () => {
  render(<EscalationsPage />);

  await waitFor(() => expect(screen.getByText('Legal or title question')).toBeTruthy());
  expect(screen.queryByText('legal')).toBeNull();
});

test('says how many are still open — the point of the screen', async () => {
  render(<EscalationsPage />);

  await waitFor(() => expect(screen.getByText(/1 still open/)).toBeTruthy());
});

test('hides resolved and closed by default, and can show them', async () => {
  mockList.mockResolvedValue({
    page: 1,
    page_size: 20,
    total: 2,
    items: [
      escalation({ id: 'e1', status: 'pending' }),
      escalation({ id: 'e2', status: 'closed', reason: 'pricing' }),
    ],
  });
  render(<EscalationsPage />);

  await waitFor(() => expect(screen.getByText('Legal or title question')).toBeTruthy());
  expect(screen.queryByText('Pricing question')).toBeNull();

  fireEvent.click(screen.getByLabelText('Show resolved and closed'));

  expect(screen.getByText('Pricing question')).toBeTruthy();
});

test('an unassigned escalation is called out', async () => {
  render(<EscalationsPage />);

  await waitFor(() => expect(screen.getByText('Unassigned')).toBeTruthy());
});

test('status can be changed from the queue', async () => {
  render(<EscalationsPage />);
  await waitFor(() => expect(screen.getByText('Legal or title question')).toBeTruthy());

  fireEvent.change(
    screen.getByLabelText('Status for the Legal or title question escalation'),
    { target: { value: 'in_progress' } },
  );

  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('e1', 'in_progress'));
});

test('opening one shows the flagged conversation', async () => {
  render(<EscalationsPage />);
  await waitFor(() => expect(screen.getByText('Legal or title question')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Read' }));

  await waitFor(() => expect(screen.getByText('Who owns the driveway?')).toBeTruthy());
  expect(screen.getByText('I cannot advise on title questions.')).toBeTruthy();
});

test('the conversation shows source and version context', async () => {
  // 4.17 names it explicitly: a staff member reviewing a bad answer has to be
  // able to tell which instruction set produced it.
  render(<EscalationsPage />);
  await waitFor(() => expect(screen.getByText('Legal or title question')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Read' }));

  await waitFor(() => expect(screen.getByText(/gpt-4o-mini/)).toBeTruthy());
  expect(screen.getByText(/prompt v7/)).toBeTruthy();
});

test('an empty queue says so rather than showing a blank table', async () => {
  mockList.mockResolvedValue({ page: 1, page_size: 20, total: 0, items: [] });
  render(<EscalationsPage />);

  await waitFor(() => expect(screen.getByText(/Nothing open/)).toBeTruthy());
});

test('a failed load is reported', async () => {
  mockList.mockRejectedValue(new Error('network'));
  render(<EscalationsPage />);

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('Could not load');
});

test('a failed conversation load does not take down the queue', async () => {
  mockConvo.mockRejectedValue(new Error('network'));
  render(<EscalationsPage />);
  await waitFor(() => expect(screen.getByText('Legal or title question')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Read' }));

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Could not load that conversation'),
  );
  // Queue still there. `getAllBy` because the open panel repeats the reason
  // as its heading.
  expect(screen.getAllByText('Legal or title question').length).toBeGreaterThan(0);
});
