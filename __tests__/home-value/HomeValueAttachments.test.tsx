import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HomeValueAttachments } from '@/components/homeValue/HomeValueAttachments';
import { HomeValueReviewerAttachments } from '@/components/homeValue/HomeValueReviewerAttachments';
import { deleteDocument, fetchDocuments } from '@/services/documentService';
import type { AppDocument } from '@/types/api';

jest.mock('@/components/documents/ClientDocumentCard', () => ({
  __esModule: true, default: () => <span>Document card</span>,
}));
jest.mock('@/components/documents/DocumentUploadButton', () => ({
  __esModule: true, default: () => <span>Upload control</span>,
}));
jest.mock('@/services/documentService', () => ({
  fetchDocuments: jest.fn(), deleteDocument: jest.fn(),
  downloadDocumentFile: jest.fn(), formatBytes: jest.fn(), isStaffDocument: jest.fn(),
}));

const mockFetch = fetchDocuments as jest.MockedFunction<typeof fetchDocuments>;
const mockDelete = deleteDocument as jest.MockedFunction<typeof deleteDocument>;
const document = { id: 'd1', original_filename: 'front.jpg', category: 'property_photo' } as AppDocument;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue([document]);
});

test('owner confirms deletion and cannot send duplicate requests while it is pending', async () => {
  let finishRemoval: () => void = () => {};
  mockDelete.mockReturnValue(new Promise<AppDocument>((resolve) => { finishRemoval = () => resolve(document); }));
  render(<HomeValueAttachments requestId="r1" />);
  await waitFor(() => screen.getByText('Document card'));
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
  expect(mockDelete).not.toHaveBeenCalled();
  const confirmation = screen.getByRole('dialog', { name: 'Remove attachment?' });
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Remove attachment' }));
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect((screen.getAllByRole('button', { name: 'Remove attachment' })[0] as HTMLButtonElement).disabled).toBe(true);
  finishRemoval();
  await waitFor(() => expect(screen.getByText('Attachment removed.')).toBeTruthy());
  expect(mockFetch).toHaveBeenCalledWith('home_value_request', 'r1');
});

test('reviewer attachment list fetches only its mounted request', async () => {
  render(<HomeValueReviewerAttachments requestId="r2" />);
  await waitFor(() => screen.getByText(/front.jpg/));
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith('home_value_request', 'r2');
});
