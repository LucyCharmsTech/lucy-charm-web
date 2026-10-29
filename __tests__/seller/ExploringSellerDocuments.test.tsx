import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExploringSellerDocuments from '@/components/seller/ExploringSellerDocuments';
import {
  fetchSharedJourneyDocumentContent, getSharedJourneyDocument, listRequestedJourneyDocuments,
  listSharedJourneyDocuments, uploadRequestedJourneyDocument,
  type SellerJourneyDocument,
} from '@/services/sellerJourneyDocumentService';
import { downloadPdfBlob } from '@/services/sellerPlanPdfService';

jest.mock('@/services/sellerJourneyDocumentService', () => ({
  fetchSharedJourneyDocumentContent: jest.fn(), getSharedJourneyDocument: jest.fn(),
  listRequestedJourneyDocuments: jest.fn(), listSharedJourneyDocuments: jest.fn(),
  uploadRequestedJourneyDocument: jest.fn(), journeyDocumentError: () => 'Document unavailable. Refresh.',
}));
jest.mock('@/components/seller/PublishedSellerPlan', () => function PublishedPlan({ publication }: { publication: { value: { version_id: string } } }) {
  return <p>Published PDF version {publication.value.version_id}</p>;
});
jest.mock('@/components/seller/JourneyDocumentPreview', () => function Preview() { return <p>Protected document preview</p>; });
jest.mock('@/services/sellerPlanPdfService', () => ({ downloadPdfBlob: jest.fn() }));

const listShared = listSharedJourneyDocuments as jest.MockedFunction<typeof listSharedJourneyDocuments>;
const listRequested = listRequestedJourneyDocuments as jest.MockedFunction<typeof listRequestedJourneyDocuments>;
const detail = getSharedJourneyDocument as jest.MockedFunction<typeof getSharedJourneyDocument>;
const content = fetchSharedJourneyDocumentContent as jest.MockedFunction<typeof fetchSharedJourneyDocumentContent>;
const upload = uploadRequestedJourneyDocument as jest.MockedFunction<typeof uploadRequestedJourneyDocument>;
const download = downloadPdfBlob as jest.MockedFunction<typeof downloadPdfBlob>;
const shared = { id: 'doc-1', category: 'other', description: 'Guide', filename: 'guide.pdf', status: 'accepted' as const, shared_at: '2026-10-27T00:00:00Z', client_reason: null };
const request = { id: 'req-1', category: 'property_photo', description: 'Photo please', filename: null, status: 'requested' as const, shared_at: null, client_reason: null };
beforeEach(() => {
  jest.clearAllMocks(); listShared.mockResolvedValue([]); listRequested.mockResolvedValue([]);
  detail.mockResolvedValue(shared); content.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
  upload.mockResolvedValue({ ...request, status: 'uploaded' });
});

test('empty journey has distinct shared and requested sections', async () => {
  render(<ExploringSellerDocuments journeyId="journey-1" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  expect(await screen.findByText('No documents have been shared for this home yet.')).toBeTruthy();
  expect(screen.getByText('No documents have been requested for this home.')).toBeTruthy();
  expect(listShared).toHaveBeenCalledWith('journey-1');
});

test('only server-listed shared file and exact current Plan version appear; request stays separate', async () => {
  listShared.mockResolvedValue([shared]); listRequested.mockResolvedValue([request]);
  render(<ExploringSellerDocuments journeyId="journey-1" publication={{ kind: 'available', value: { version_id: 'v-2', version_number: 2, filename: 'Plan.pdf', size_bytes: 20, published_at: '2026-10-27T00:00:00Z' } }} onPublicationRefresh={jest.fn()} />);
  expect(await screen.findByText('guide.pdf')).toBeTruthy();
  expect(screen.getByText('Published PDF version v-2')).toBeTruthy();
  expect(screen.getByText('Photo please')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  await waitFor(() => expect(detail).toHaveBeenCalledWith('journey-1', 'doc-1'));
  await waitFor(() => expect(content).toHaveBeenCalledWith('journey-1', 'doc-1'));
  expect(await screen.findByText('Protected document preview')).toBeTruthy();
});

test('revoked document clears preview and reloads the authorized list', async () => {
  listShared.mockResolvedValue([shared]);
  detail.mockRejectedValueOnce({ response: { status: 404 } });
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Protected document preview')).toBeNull();
  await waitFor(() => expect(listShared).toHaveBeenCalledTimes(2));
});

test('download rechecks current sharing and fetches authorized bytes', async () => {
  listShared.mockResolvedValue([shared]);
  render(<ExploringSellerDocuments journeyId="journey-1" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
  await waitFor(() => expect(download).toHaveBeenCalledWith(expect.any(Blob), 'guide.pdf'));
  expect(detail).toHaveBeenCalledWith('journey-1', 'doc-1');
  expect(content).toHaveBeenCalledWith('journey-1', 'doc-1');
});

test('requested upload requires an explicit submit and is only available for requested status', async () => {
  listRequested.mockResolvedValue([request, { ...request, id: 'req-2', status: 'replacement_needed', client_reason: 'Photo was blurry' }]);
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  expect(await screen.findByText(/Photo was blurry/)).toBeTruthy();
  expect(screen.getAllByLabelText('Select PDF or image')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Select PDF or image'), { target: { files: [new File(['%PDF-1.4'], 'photo.pdf', { type: 'application/pdf' })] } });
  expect(upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected file' }));
  await waitFor(() => expect(upload).toHaveBeenCalledWith('j', 'req-1', expect.any(File)));
});

test('PDF with an empty browser MIME type is submitted as PDF for server-side byte validation', async () => {
  listRequested.mockResolvedValueOnce([request]).mockResolvedValue([{ ...request, filename: 'home.pdf', status: 'uploaded' }]);
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText('Select PDF or image'), { target: { files: [new File(['%PDF-1.4'], 'home.pdf')] } });
  expect(upload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected file' }));
  await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  const submitted = upload.mock.calls[0][2];
  expect(submitted.name).toBe('home.pdf');
  expect(submitted.type).toBe('application/pdf');
  expect(await screen.findByText('Uploaded — pending staff review.')).toBeTruthy();
});

test.each([
  [new File(['text'], 'notes.txt', { type: 'text/plain' }), /Unsupported format/],
  [new File(['image'], 'photo.png'), /could not identify this image type/],
  [new File([], 'empty.pdf', { type: 'application/pdf' }), /file is empty/],
  [new File(['image'], 'photo.pdf', { type: 'image/png' }), /filename and file type do not match/],
  [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' }), /exceeds 10 MB/],
])('invalid selection stays local and explains the refusal', async (file, message) => {
  listRequested.mockResolvedValue([request]);
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText('Select PDF or image'), { target: { files: [file] } });
  expect(screen.getByRole('alert').textContent).toMatch(message);
  expect(upload).not.toHaveBeenCalled();
});

test('missing file and busy upload never send a duplicate request', async () => {
  listRequested.mockResolvedValue([request]);
  let finish!: (value: SellerJourneyDocument) => void;
  upload.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Upload selected file' }));
  expect(screen.getByRole('alert').textContent).toContain('Select a PDF or image');
  fireEvent.change(screen.getByLabelText('Select PDF or image'), { target: { files: [new File(['%PDF-1.4'], 'home.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected file' }));
  expect((screen.getByRole('button', { name: 'Uploading…' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('Document action in progress');
  fireEvent.click(screen.getByRole('button', { name: 'Uploading…' }));
  expect(upload).toHaveBeenCalledTimes(1);
  finish({ ...request, status: 'uploaded' });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Uploading…' })).toBeNull());
});

test('failed POST remains visible after document-list refresh', async () => {
  listRequested.mockResolvedValue([request]);
  upload.mockRejectedValueOnce({ response: { status: 422 } });
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText('Select PDF or image'), { target: { files: [new File(['bad bytes'], 'home.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected file' }));
  await waitFor(() => expect(listRequested).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('alert').textContent).toContain('Document unavailable. Refresh.');
  expect(upload).toHaveBeenCalledTimes(1);
});

test('confirmation waits for the refreshed request to be uploaded', async () => {
  let confirm!: (value: SellerJourneyDocument[]) => void;
  listRequested.mockResolvedValueOnce([request]).mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText('Select PDF or image'), { target: { files: [new File(['%PDF-1.4'], 'home.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected file' }));
  await waitFor(() => expect(listRequested).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Uploaded — pending staff review.')).toBeNull();
  confirm([{ ...request, filename: 'home.pdf', status: 'uploaded' }]);
  expect(await screen.findByText('Uploaded — pending staff review.')).toBeTruthy();
  expect(screen.getByText('Submitted: home.pdf')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Upload selected file' })).toBeNull();
});

test('a stale requested status after POST does not claim upload confirmation', async () => {
  listRequested.mockResolvedValue([request]);
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText('Select PDF or image'), { target: { files: [new File(['%PDF-1.4'], 'home.pdf', { type: 'application/pdf' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected file' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('current status could not be confirmed'));
  expect(screen.queryByText('Uploaded — pending staff review.')).toBeNull();
});

test('a request that stops accepting uploads loses its submit control after refresh', async () => {
  listRequested.mockResolvedValueOnce([request]).mockResolvedValue([{ ...request, status: 'accepted' }]);
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText('Select PDF or image'), { target: { files: [new File(['%PDF-1.4'], 'home.pdf', { type: 'application/pdf' })] } });
  expect(screen.getByText('Selected: home.pdf')).toBeTruthy();
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Upload selected file' })).toBeNull());
  expect(screen.queryByText('Selected: home.pdf')).toBeNull();
  expect((await screen.findByRole('alert')).textContent).toContain('selection was cleared');
  expect(upload).not.toHaveBeenCalled();
});

test.each(['focus', 'visibilitychange'])('%s before native file change keeps the input mounted during background refresh', async (eventName) => {
  let finishRefresh!: (value: SellerJourneyDocument[]) => void;
  listRequested.mockResolvedValueOnce([request])
    .mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }))
    .mockResolvedValue([{ ...request, filename: 'home.pdf', status: 'uploaded' }]);
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  const input = await screen.findByLabelText('Select PDF or image');
  fireEvent(eventName === 'focus' ? window : document, new Event(eventName));
  await waitFor(() => expect(listRequested).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('Select PDF or image')).toBe(input);
  expect(screen.getByText('Checking for document updates…')).toBeTruthy();
  fireEvent.change(input, { target: { files: [new File(['%PDF-1.4'], 'home.pdf', { type: 'application/pdf' })] } });
  expect(screen.getByText('Selected: home.pdf')).toBeTruthy();
  expect(upload).not.toHaveBeenCalled();
  finishRefresh([request]);
  await waitFor(() => expect(screen.queryByText('Checking for document updates…')).toBeNull());
  expect(screen.getByLabelText('Select PDF or image')).toBe(input);
  expect(screen.getByText('Selected: home.pdf')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Upload selected file' }));
  expect(await screen.findByText('Uploaded — pending staff review.')).toBeTruthy();
  expect(upload).toHaveBeenCalledTimes(1);
});

test('selection survives a successful list refresh and parent publication rerender', async () => {
  listRequested.mockResolvedValue([request]);
  const onPublicationRefresh = jest.fn();
  const { rerender } = render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={onPublicationRefresh} />);
  const input = await screen.findByLabelText('Select PDF or image');
  fireEvent.change(input, { target: { files: [new File(['%PDF-1.4'], 'home.pdf', { type: 'application/pdf' })] } });
  rerender(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'error' }} onPublicationRefresh={onPublicationRefresh} />);
  fireEvent.focus(window);
  await waitFor(() => expect(listRequested).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('Select PDF or image')).toBe(input);
  expect(screen.getByText('Selected: home.pdf')).toBeTruthy();
  expect(upload).not.toHaveBeenCalled();
});

test('focus revalidation closes a preview and removes a withdrawn shared document', async () => {
  listShared.mockResolvedValueOnce([shared]).mockResolvedValue([]);
  render(<ExploringSellerDocuments journeyId="j" publication={{ kind: 'unavailable' }} onPublicationRefresh={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View' }));
  expect(await screen.findByText('Protected document preview')).toBeTruthy();
  fireEvent.focus(window);
  expect(screen.queryByText('Protected document preview')).toBeNull();
  await waitFor(() => expect(screen.queryByText('guide.pdf')).toBeNull());
  expect(screen.queryByRole('button', { name: 'View' })).toBeNull();
  expect(detail).toHaveBeenCalledWith('j', 'doc-1');
  expect(content).toHaveBeenCalledWith('j', 'doc-1');
});
