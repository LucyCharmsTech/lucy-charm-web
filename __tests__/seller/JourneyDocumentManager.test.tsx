import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JourneyDocumentManager from '@/components/seller/JourneyDocumentManager';
import {
  listStaffJourneyDocuments, reviewStaffJourneyDocument, shareStaffJourneyDocument,
  uploadStaffJourneyDocument, type StaffJourneyDocument,
} from '@/services/sellerJourneyDocumentService';

jest.mock('@/services/sellerJourneyDocumentService', () => ({
  fetchStaffJourneyDocumentContent: jest.fn(), journeyDocumentError: () => 'Document changed. Reload.',
  listStaffJourneyDocuments: jest.fn(), requestSellerJourneyDocument: jest.fn(),
  reviewStaffJourneyDocument: jest.fn(), shareStaffJourneyDocument: jest.fn(),
  uploadStaffJourneyDocument: jest.fn(), withdrawStaffJourneyDocument: jest.fn(),
}));
jest.mock('@/components/seller/JourneyDocumentPreview', () => function Preview() { return <p>Private preview</p>; });
const list = listStaffJourneyDocuments as jest.MockedFunction<typeof listStaffJourneyDocuments>;
const review = reviewStaffJourneyDocument as jest.MockedFunction<typeof reviewStaffJourneyDocument>;
const share = shareStaffJourneyDocument as jest.MockedFunction<typeof shareStaffJourneyDocument>;
const upload = uploadStaffJourneyDocument as jest.MockedFunction<typeof uploadStaffJourneyDocument>;
const draft: StaffJourneyDocument = {
  id: 'doc-1', journey_id: 'journey-1', kind: 'staff_shared', status: 'uploaded',
  category: 'other', description: null, filename: 'draft.pdf', revision: 1,
  shared_at: null, withdrawn_at: null, reviewed_at: null, reviewed_by_user_id: null,
  shared_by_user_id: null, client_reason: null,
};
const oversizedFile = new File(['x'], 'large.pdf', { type: 'application/pdf' });
Object.defineProperty(oversizedFile, 'size', { value: 10 * 1024 * 1024 + 1 });
beforeEach(() => { jest.clearAllMocks(); list.mockResolvedValue([]); review.mockResolvedValue({ ...draft, status: 'accepted', revision: 2 }); });

test('ordinary accounts do not render staff controls or fetch staff metadata', () => {
  render(<JourneyDocumentManager journeyId="journey-1" role="client" />);
  expect(screen.queryByRole('region', { name: 'Journey documents' })).toBeNull();
  expect(list).not.toHaveBeenCalled();
});

test('private draft cannot be shared before a separate review', async () => {
  list.mockResolvedValue([draft]);
  render(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  expect(await screen.findByText('draft.pdf')).toBeTruthy();
  expect(screen.getByText(/uploaded · private/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share with seller' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await waitFor(() => expect(review).toHaveBeenCalledWith('journey-1', 'doc-1', 1, 'accepted'));
  expect(share).not.toHaveBeenCalled();
});

test('accepted private document has explicit Share action and revision', async () => {
  list.mockResolvedValue([{ ...draft, status: 'accepted', revision: 4, reviewed_at: '2026-10-27T00:00:00Z', reviewed_by_user_id: 'staff' }]);
  share.mockResolvedValue({ ...draft, status: 'accepted', revision: 5, shared_at: '2026-10-27T00:00:00Z' });
  render(<JourneyDocumentManager journeyId="journey-1" role="superadmin" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Share with seller' }));
  await waitFor(() => expect(share).toHaveBeenCalledWith('journey-1', 'doc-1', 4));
});

test('conflict reloads current rows before another action', async () => {
  list.mockResolvedValueOnce([draft]).mockResolvedValueOnce([]);
  review.mockRejectedValueOnce({ response: { status: 409 } });
  render(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  await waitFor(() => expect(screen.queryByText('draft.pdf')).toBeNull());
});

test('an uploaded seller request appears under Requested from seller for the assigned Agent', async () => {
  list.mockResolvedValue([{ ...draft, id: 'request-1', kind: 'requested_upload', description: 'Property details', filename: 'seller.pdf' }]);
  render(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  expect(await screen.findByText('seller.pdf')).toBeTruthy();
  expect(screen.getByText('Uploaded by seller · pending review')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'View submitted file' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Share with seller' })).toBeNull();
  expect(screen.getByText('No files uploaded for this journey.')).toBeTruthy();
});

test('styled selector shows the filename and size before a separate private upload', async () => {
  upload.mockResolvedValue(draft);
  render(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  expect(await screen.findByText('No file selected')).toBeTruthy();
  const button = screen.getByRole('button', { name: 'Upload privately' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(screen.getByText('Select a valid file to enable Upload privately.')).toBeTruthy();
  const file = new File([new Uint8Array(2048)], 'house-plan.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Select PDF or image to upload'), { target: { files: [file] } });
  expect(screen.getByText('house-plan.pdf (2 KB)')).toBeTruthy();
  expect(upload).not.toHaveBeenCalled();
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() => expect(upload).toHaveBeenCalledWith('journey-1', file, 'supporting_property_document', ''));
  await waitFor(() => expect(screen.getByText('No file selected')).toBeTruthy());
  expect(button.disabled).toBe(true);
  expect(screen.getByText('Private draft uploaded. Review it before sharing.')).toBeTruthy();
});

test.each([
  ['unsupported format', new File(['text'], 'notes.txt', { type: 'text/plain' }), /Choose a PDF, JPEG, PNG, or WebP file/],
  ['empty file', new File([], 'empty.pdf', { type: 'application/pdf' }), /Choose a file that is not empty/],
  ['oversize file', oversizedFile, /Choose a file no larger than 10 MB/],
])('%s remains visible but cannot be uploaded', async (_name, file, message) => {
  render(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  await screen.findByText('No file selected');
  fireEvent.change(screen.getByLabelText('Select PDF or image to upload'), { target: { files: [file] } });
  expect(screen.getByRole('alert').textContent).toMatch(message);
  expect((screen.getByRole('button', { name: 'Upload privately' }) as HTMLButtonElement).disabled).toBe(true);
  expect(upload).not.toHaveBeenCalled();
});

test('selection and file input survive a parent rerender and document-list refresh', async () => {
  list.mockResolvedValue([draft]);
  const view = render(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  await screen.findByText('draft.pdf');
  const input = screen.getByLabelText('Select PDF or image to upload');
  const file = new File(['%PDF-1.4'], 'selected.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
  view.rerender(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  expect(screen.getByText(/selected.pdf \(/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('Select PDF or image to upload')).toBe(input);
  expect(screen.getByText(/selected.pdf \(/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Upload privately' }) as HTMLButtonElement).disabled).toBe(false);
});

test('a pending upload disables file selection and prevents a duplicate POST', async () => {
  let finish!: (value: StaffJourneyDocument) => void;
  upload.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<JourneyDocumentManager journeyId="journey-1" role="agent" />);
  await screen.findByText('No file selected');
  const input = screen.getByLabelText('Select PDF or image to upload') as HTMLInputElement;
  const file = new File(['%PDF-1.4'], 'selected.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
  const button = screen.getByRole('button', { name: 'Upload privately' });
  fireEvent.click(button);
  expect(input.disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Working…' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  expect(upload).toHaveBeenCalledTimes(1);
  finish(draft);
  await waitFor(() => expect(screen.getByText('No file selected')).toBeTruthy());
});
