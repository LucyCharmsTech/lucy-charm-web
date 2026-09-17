import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PreferencePromptCard } from '@/components/journey/PreferencePromptCard';
import {
  answerPreferencePrompt,
  dismissPreferencePrompt,
  fetchNextPreferencePrompt,
} from '@/services/preferencePromptService';
import type { PreferencePrompt } from '@/types/api';

/**
 * Control 6.9: *"Ask **one** optional useful question at a natural moment;
 * never repeat known information; explain the immediate benefit."*
 * Control 6.18: *"do not nag after dismissal."*
 *
 * The tests are mostly about what this must **not** become: a second
 * onboarding wizard.
 */

jest.mock('@/services/preferencePromptService', () => {
  const actual = jest.requireActual('@/services/preferencePromptService');
  return {
    ...actual,
    fetchNextPreferencePrompt: jest.fn(),
    answerPreferencePrompt: jest.fn(),
    dismissPreferencePrompt: jest.fn(),
  };
});

const mockFetch = fetchNextPreferencePrompt as jest.MockedFunction<
  typeof fetchNextPreferencePrompt
>;
const mockAnswer = answerPreferencePrompt as jest.MockedFunction<
  typeof answerPreferencePrompt
>;
const mockDismiss = dismissPreferencePrompt as jest.MockedFunction<
  typeof dismissPreferencePrompt
>;

const budget: PreferencePrompt = {
  key: 'budget',
  question: 'What price range are you looking in?',
  benefit: 'We will stop showing you homes outside it.',
  field: 'budget_max',
};

const parking: PreferencePrompt = {
  key: 'parking',
  question: 'Do you need parking?',
  benefit: 'We will filter out homes without it.',
  field: 'parking_required',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue(budget);
  mockAnswer.mockResolvedValue(null);
  mockDismiss.mockResolvedValue(null);
});

test('asks one question and always states the benefit', async () => {
  render(<PreferencePromptCard />);

  await waitFor(() =>
    expect(screen.getByText('What price range are you looking in?')).toBeTruthy(),
  );
  expect(screen.getByText('We will stop showing you homes outside it.')).toBeTruthy();
});

test('renders nothing when there is nothing to ask', async () => {
  // The normal state for an established account — ordinary, not an error.
  mockFetch.mockResolvedValue(null);
  const { container } = render(<PreferencePromptCard />);

  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  expect(container.innerHTML).toBe('');
});

test('a failed load stays silent rather than showing an error', async () => {
  // The prompt is optional by definition; an error for a nicety is worse than
  // nothing.
  mockFetch.mockRejectedValue(new Error('network'));
  const { container } = render(<PreferencePromptCard />);

  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  expect(container.innerHTML).toBe('');
});

test('answering sends the value and moves to whatever comes next', async () => {
  mockAnswer.mockResolvedValue(parking);
  render(<PreferencePromptCard />);
  await waitFor(() =>
    expect(screen.getByLabelText('What price range are you looking in?')).toBeTruthy(),
  );

  fireEvent.change(screen.getByLabelText('What price range are you looking in?'), {
    target: { value: '850000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(mockAnswer).toHaveBeenCalledWith('budget', 850000));
  await waitFor(() => expect(screen.getByText('Do you need parking?')).toBeTruthy());
});

test('a yes/no question gets buttons, not a text box', async () => {
  mockFetch.mockResolvedValue(parking);
  render(<PreferencePromptCard />);

  await waitFor(() => expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy());
  expect(screen.getByRole('button', { name: 'No' })).toBeTruthy();
  expect(screen.queryByRole('textbox')).toBeNull();
});

test('answering no sends false, not an empty value', async () => {
  mockFetch.mockResolvedValue(parking);
  render(<PreferencePromptCard />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'No' })).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'No' }));

  await waitFor(() => expect(mockAnswer).toHaveBeenCalledWith('parking', false));
});

test('"Not now" is always offered', async () => {
  render(<PreferencePromptCard />);

  await waitFor(() => expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy());
});

test('declining removes the card and does not ask again', async () => {
  // Control 6.18: "do not nag after dismissal."
  render(<PreferencePromptCard />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

  await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('budget'));
  await waitFor(() =>
    expect(screen.queryByText('What price range are you looking in?')).toBeNull(),
  );
});

test('declining shows the next question when there is one', async () => {
  mockDismiss.mockResolvedValue(parking);
  render(<PreferencePromptCard />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

  await waitFor(() => expect(screen.getByText('Do you need parking?')).toBeTruthy());
});

test('a failed save is reported and the question stays', async () => {
  mockAnswer.mockRejectedValue(new Error('network'));
  render(<PreferencePromptCard />);
  await waitFor(() =>
    expect(screen.getByLabelText('What price range are you looking in?')).toBeTruthy(),
  );

  fireEvent.change(screen.getByLabelText('What price range are you looking in?'), {
    target: { value: '850000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByText('What price range are you looking in?')).toBeTruthy();
});

test('Save is disabled until something is typed', async () => {
  render(<PreferencePromptCard />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy());

  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
});
