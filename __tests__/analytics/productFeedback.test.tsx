import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProductFeedbackPrompt } from '@/components/common/ProductFeedbackPrompt';
import { feedbackContextForPath } from '@/lib/productFeedback';
import { submitProductFeedback } from '@/services/productFeedbackService';
import { track } from '@/lib/analytics';

jest.mock('@/services/productFeedbackService', () => ({ submitProductFeedback: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const submit = submitProductFeedback as jest.Mock;
const capture = track as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  submit.mockResolvedValue({ id: 'saved', created: true });
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true, value: jest.fn().mockReturnValue('11111111-1111-4111-8111-111111111111'),
  });
});

test('real route families map to coarse contexts, never a raw URL or identifier', () => {
  expect(feedbackContextForPath('/listings')).toBe('search');
  expect(feedbackContextForPath('/listings/private-id')).toBe('listing');
  expect(feedbackContextForPath('/home-value')).toBe('home_value');
  expect(feedbackContextForPath('/contact')).toBe('contact');
  expect(feedbackContextForPath('/admin/work')).toBeNull();
  expect(feedbackContextForPath('/something-unknown')).toBeNull();
});

test('helpful response is saved once with no text and only coarse analytics', async () => {
  render(<ProductFeedbackPrompt context="listing" />);
  fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByText('Thanks for your feedback.')).toBeTruthy());
  expect(submit.mock.calls[0][0]).toEqual(expect.objectContaining({
    feedback_type: 'helpful', context: 'listing', helpful: false,
  }));
  expect(submit.mock.calls[0][0]).not.toHaveProperty('description');
  expect(capture).toHaveBeenCalledWith('product_feedback_helpful', {
    context: 'listing', helpful: false,
  });
  expect(screen.queryByRole('button', { name: 'Helpful' })).toBeNull();
});

test('problem description goes only to first-party API, never to analytics', async () => {
  render(<ProductFeedbackPrompt context="home_value" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report a problem' }));
  expect(screen.getByText(/Do not include passwords/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Description/), {
    target: { value: 'This private explanation is only for internal review.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send problem report' }));
  await waitFor(() => expect(screen.getByText('Problem report received.')).toBeTruthy());
  expect(submit.mock.calls[0][0]).toEqual(expect.objectContaining({
    feedback_type: 'problem', context: 'home_value', category: 'bug',
    description: 'This private explanation is only for internal review.',
  }));
  expect(capture).toHaveBeenCalledWith('product_problem_reported', {
    context: 'home_value', category: 'bug',
  });
  expect(JSON.stringify(capture.mock.calls)).not.toContain('private explanation');
});

test('analytics failure cannot undo a saved first-party problem report', async () => {
  capture.mockImplementation(() => { throw new Error('provider blocked'); });
  render(<ProductFeedbackPrompt context="contact" />);
  fireEvent.click(screen.getByRole('button', { name: 'Report a problem' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send problem report' }));
  await waitFor(() => expect(screen.getByText('Problem report received.')).toBeTruthy());
  expect(submit).toHaveBeenCalledTimes(1);
});
