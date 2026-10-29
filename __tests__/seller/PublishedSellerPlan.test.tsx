import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PublishedSellerPlan from '@/components/seller/PublishedSellerPlan';
import { downloadPdfBlob, fetchPublishedSellerPlanPdf } from '@/services/sellerPlanPdfService';

jest.mock('@/components/documents/PdfCanvasPreview', () => function Preview() { return <p>Authorized PDF preview</p>; });
jest.mock('@/services/sellerPlanPdfService', () => ({
  downloadPdfBlob: jest.fn(), fetchPublishedSellerPlanPdf: jest.fn(),
}));

const fetchContent = fetchPublishedSellerPlanPdf as jest.MockedFunction<typeof fetchPublishedSellerPlanPdf>;
const download = downloadPdfBlob as jest.MockedFunction<typeof downloadPdfBlob>;
const onRefresh = jest.fn();
const publication = {
  kind: 'available' as const,
  value: {
    version_id: 'version-2', version_number: 2,
    published_at: '2026-10-26T10:00:00Z', filename: 'Seller Plan.pdf', size_bytes: 100,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchContent.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
});

test('published metadata offers authenticated preview and download without object URLs or scanner details', async () => {
  render(<PublishedSellerPlan journeyId="journey-1" publication={publication} onRefresh={onRefresh} />);
  expect(screen.getByText('Your PDF is ready')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'View Seller Plan PDF' }).textContent).toBe('View Seller Plan');
  expect(screen.getByRole('button', { name: 'Download Seller Plan PDF' }).textContent).toBe('Download PDF');
  expect(screen.queryByText(/scan report|checksum|storage key/i)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View Seller Plan PDF' }));
  expect(await screen.findByText('Authorized PDF preview')).toBeTruthy();
  const dialog = screen.getByRole('dialog', { name: 'Seller Plan PDF preview' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(download).toHaveBeenCalledWith(expect.any(Blob), 'Seller Plan.pdf'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close preview' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Download Seller Plan PDF' }));
  await waitFor(() => expect(download).toHaveBeenCalledWith(expect.any(Blob), 'Seller Plan.pdf'));
  expect(fetchContent).toHaveBeenCalledTimes(3);
  expect(fetchContent).toHaveBeenCalledWith('journey-1', 'version-2');
});

test('withdrawal closes the preview and prevents stale PDF actions', async () => {
  const { rerender } = render(<PublishedSellerPlan journeyId="journey-1" publication={publication} onRefresh={onRefresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'View Seller Plan PDF' }));
  expect(await screen.findByRole('dialog', { name: 'Seller Plan PDF preview' })).toBeTruthy();
  rerender(<PublishedSellerPlan journeyId="journey-1" publication={{ kind: 'loading' }} onRefresh={onRefresh} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<PublishedSellerPlan journeyId="journey-1" publication={{ kind: 'unavailable' }} onRefresh={onRefresh} />);
  expect(screen.queryByRole('button', { name: 'Download Seller Plan PDF' })).toBeNull();
});

test('modal download rechecks the expected version and rejects a replaced PDF', async () => {
  fetchContent.mockResolvedValueOnce(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))
    .mockRejectedValueOnce({ response: { status: 409 } });
  const { rerender } = render(<PublishedSellerPlan journeyId="journey-1" publication={publication} onRefresh={onRefresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'View Seller Plan PDF' }));
  const dialog = await screen.findByRole('dialog', { name: 'Seller Plan PDF preview' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(onRefresh).toHaveBeenCalledWith(expect.stringContaining('changed')));
  expect(download).not.toHaveBeenCalled();
  expect(fetchContent).toHaveBeenNthCalledWith(2, 'journey-1', 'version-2');
  rerender(<PublishedSellerPlan journeyId="journey-1" publication={{ kind: 'loading' }} onRefresh={onRefresh} />);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('withdrawn or unavailable PDF never shows a stale Ready label or access controls', () => {
  render(<PublishedSellerPlan journeyId="journey-1" publication={{ kind: 'unavailable' }} onRefresh={onRefresh} />);
  expect(screen.getByText('No published Seller Plan PDF is currently available.')).toBeTruthy();
  expect(screen.queryByText(/Ready.*published/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Download Seller Plan PDF' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

test('content authorization or storage failure removes preview and refreshes publication state', async () => {
  fetchContent.mockRejectedValueOnce({ response: { status: 404 } });
  render(<PublishedSellerPlan journeyId="journey-1" publication={publication} onRefresh={onRefresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'View Seller Plan PDF' }));
  await waitFor(() => expect(onRefresh).toHaveBeenCalledWith(expect.stringContaining('could not be opened')));
  expect(screen.queryByText('Authorized PDF preview')).toBeNull();
  expect(onRefresh).toHaveBeenCalledTimes(1);
});

test('metadata storage error is presented without claiming readiness', () => {
  render(<PublishedSellerPlan journeyId="journey-1" publication={{ kind: 'error' }} onRefresh={onRefresh} />);
  expect(screen.getByText('We cannot check your published PDF right now.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Download Seller Plan PDF' })).toBeNull();
});

test('replacement between metadata and content retrieval refreshes without using stale bytes', async () => {
  fetchContent.mockRejectedValueOnce({ response: { status: 409 } });
  render(<PublishedSellerPlan journeyId="journey-1" publication={publication} onRefresh={onRefresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download Seller Plan PDF' }));
  await waitFor(() => expect(onRefresh).toHaveBeenCalledWith(expect.stringContaining('changed')));
  expect(fetchContent).toHaveBeenCalledWith('journey-1', 'version-2');
  expect(download).not.toHaveBeenCalled();
});
