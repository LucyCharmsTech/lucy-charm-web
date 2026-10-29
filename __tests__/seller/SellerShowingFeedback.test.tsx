import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SellerShowingFeedback from '@/components/seller/SellerShowingFeedback';
import {
  listPublishedShowingFeedback, type PublishedShowingFeedback,
} from '@/services/sellerShowingFeedbackService';

jest.mock('@/services/sellerShowingFeedbackService', () => {
  const actual = jest.requireActual('@/services/sellerShowingFeedbackService');
  return { ...actual, listPublishedShowingFeedback: jest.fn() };
});
const list = listPublishedShowingFeedback as jest.MockedFunction<typeof listPublishedShowingFeedback>;
const approved: PublishedShowingFeedback = {
  id: 'feedback-1', summary: 'The approved seller summary.',
  showing_at: '2099-06-01T14:00:00Z', published_at: '2099-06-02T14:00:00Z',
};

beforeEach(() => { jest.clearAllMocks(); list.mockResolvedValue([]); });

test('seller sees only the transaction-scoped published DTO, with a truthful empty state', async () => {
  list.mockResolvedValueOnce([approved]);
  const view = render(<SellerShowingFeedback transactionId="transaction-1" />);
  expect(await screen.findByText('The approved seller summary.')).toBeTruthy();
  expect(list).toHaveBeenCalledWith('transaction-1');
  expect(screen.getByText(/Showing ·/)).toBeTruthy();
  expect(screen.getByText('Approved summary')).toBeTruthy();
  expect(screen.queryByText(/buyer identity|raw buyer comment|internal note/i)).toBeNull();
  view.unmount();
  render(<SellerShowingFeedback transactionId="transaction-2" />);
  expect(await screen.findByText('No approved showing feedback is available yet.')).toBeTruthy();
  expect(screen.queryByText('The approved seller summary.')).toBeNull();
});

test('focus and visibility revalidation remove corrected or withdrawn summaries without resetting another form', async () => {
  list.mockResolvedValueOnce([approved]).mockResolvedValueOnce([])
    .mockResolvedValueOnce([approved]).mockResolvedValueOnce([]);
  render(<><input aria-label="Unrelated document filename" defaultValue="draft.pdf" />
    <SellerShowingFeedback transactionId="transaction-1" /></>);
  expect(await screen.findByText('The approved seller summary.')).toBeTruthy();
  const input = screen.getByLabelText('Unrelated document filename');
  fireEvent.change(input, { target: { value: 'chosen.pdf' } });
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByText('The approved seller summary.')).toBeNull());
  expect(input).toHaveProperty('value', 'chosen.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh feedback' }));
  expect(await screen.findByText('The approved seller summary.')).toBeTruthy();
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(screen.queryByText('The approved seller summary.')).toBeNull());
  expect(input).toHaveProperty('value', 'chosen.pdf');
});

test('authorization loss clears a previously rendered summary and reports an error', async () => {
  list.mockResolvedValueOnce([approved]).mockRejectedValueOnce({ response: { status: 403 } });
  render(<SellerShowingFeedback transactionId="transaction-1" />);
  expect(await screen.findByText('The approved seller summary.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh feedback' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('no longer available'));
  expect(screen.queryByText('The approved seller summary.')).toBeNull();
});

test('a transaction switch discards late feedback from the old account', async () => {
  let finishOld!: (rows: PublishedShowingFeedback[]) => void;
  list.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValueOnce([]);
  const view = render(<SellerShowingFeedback key="old" transactionId="transaction-1" />);
  await waitFor(() => expect(list).toHaveBeenCalledWith('transaction-1'));
  view.rerender(<SellerShowingFeedback key="new" transactionId="transaction-2" />);
  expect(await screen.findByText('No approved showing feedback is available yet.')).toBeTruthy();
  finishOld([approved]);
  await waitFor(() => expect(screen.queryByText('The approved seller summary.')).toBeNull());
  expect(list).toHaveBeenLastCalledWith('transaction-2');
});
