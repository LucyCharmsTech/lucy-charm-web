import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentPreviewDialog from '@/components/documents/DocumentPreviewDialog';
import { mintPreviewUrl, downloadDocumentFile } from '@/services/documentService';

jest.mock('@/services/documentService', () => ({
  mintPreviewUrl: jest.fn(),
  downloadDocumentFile: jest.fn(),
  DocumentError: class DocumentError extends Error {},
  documentErrorMessage: () => 'Preview unavailable.',
}));

const mockMint = mintPreviewUrl as jest.Mock;
const mockDownload = downloadDocumentFile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDownload.mockResolvedValue(undefined);
});

it('does not mark a document viewed until authorized preview content loads', async () => {
  mockMint.mockResolvedValue({ url: 'https://example.test/signed', content_type: 'image/png', expires_in: 300 });
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="photo.png" open onClose={jest.fn()} onReady={ready} />);
  const image = await screen.findByAltText('Document preview');
  expect(ready).not.toHaveBeenCalled();
  fireEvent.load(image);
  expect(ready).toHaveBeenCalledTimes(1);
});

it('failed mint or content load does not mark viewed; a later successful preview can', async () => {
  mockMint.mockRejectedValueOnce(new Error('denied'));
  mockMint.mockResolvedValue({ url: 'https://example.test/signed', content_type: 'image/png', expires_in: 300 });
  const ready = jest.fn();
  const failed = jest.fn();
  const props = { documentId: 'doc-1', filename: 'photo.png', onClose: jest.fn(), onReady: ready, onPreviewError: failed };
  const view = render(<DocumentPreviewDialog {...props} open />);
  await screen.findByRole('alert');
  expect(ready).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledTimes(1);
  view.rerender(<DocumentPreviewDialog {...props} open={false} />);
  view.rerender(<DocumentPreviewDialog {...props} open />);
  const image = await screen.findByAltText('Document preview');
  fireEvent.error(image);
  expect(ready).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledTimes(2);
  view.rerender(<DocumentPreviewDialog {...props} open={false} />);
  view.rerender(<DocumentPreviewDialog {...props} open />);
  const retry = await screen.findByAltText('Document preview');
  fireEvent.load(retry);
  expect(ready).toHaveBeenCalledTimes(1);
});

it('marks viewed only after a successful download', async () => {
  mockMint.mockRejectedValue(new Error('denied'));
  mockDownload.mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
  const downloaded = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="photo.png" open onClose={jest.fn()} onDownloaded={downloaded} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(mockDownload).toHaveBeenCalledTimes(1));
  expect(downloaded).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(downloaded).toHaveBeenCalledTimes(1));
});
