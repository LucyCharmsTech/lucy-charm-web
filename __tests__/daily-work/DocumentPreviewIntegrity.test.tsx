import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentPreviewDialog from '@/components/documents/DocumentPreviewDialog';
import { mintPreviewUrl, downloadDocumentFile, fetchVerifiedDocumentBlob, downloadVerifiedDocumentFile } from '@/services/documentService';

jest.mock('@/services/documentService', () => ({
  mintPreviewUrl: jest.fn(),
  downloadDocumentFile: jest.fn(),
  fetchVerifiedDocumentBlob: jest.fn(),
  downloadVerifiedDocumentFile: jest.fn(),
  DocumentError: class DocumentError extends Error {},
  documentErrorMessage: () => 'Preview unavailable.',
}));

const mockMint = mintPreviewUrl as jest.Mock;
const mockDownload = downloadDocumentFile as jest.Mock;
const mockVerifiedFetch = fetchVerifiedDocumentBlob as jest.Mock;
const mockVerifiedDownload = downloadVerifiedDocumentFile as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDownload.mockResolvedValue(undefined);
  mockVerifiedDownload.mockResolvedValue(undefined);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:verified') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
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

it('minting alone and a failed verified content fetch never unlock review', async () => {
  mockVerifiedFetch.mockRejectedValue(new Error('signed content unavailable'));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="photo.png" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  await screen.findByRole('alert');
  expect(ready).not.toHaveBeenCalled();
  expect(mockMint).not.toHaveBeenCalled();
});

it('verified image bytes and successful rendering unlock review once', async () => {
  mockVerifiedFetch.mockResolvedValue(new Blob(['image bytes'], { type: 'image/png' }));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="photo.png" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  const image = await screen.findByAltText('Document preview');
  expect(ready).not.toHaveBeenCalled();
  fireEvent.load(image);
  expect(ready).toHaveBeenCalledTimes(1);
});

it('PDF iframe load alone does not mark viewed; the reviewer must confirm it rendered', async () => {
  mockVerifiedFetch.mockResolvedValue(new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' }));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  const frame = await screen.findByTitle('Document preview');
  fireEvent.load(frame);
  expect(ready).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'I can read this PDF' }));
  expect(ready).toHaveBeenCalledTimes(1);
});

it('failed verified download followed by retry marks viewed only after received bytes', async () => {
  mockVerifiedFetch.mockRejectedValue(new Error('preview unavailable'));
  mockVerifiedDownload.mockRejectedValueOnce(new Error('content expired')).mockResolvedValueOnce(undefined);
  const downloaded = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open verifiedContent onClose={jest.fn()} onDownloaded={downloaded} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(mockVerifiedDownload).toHaveBeenCalledTimes(1));
  expect(downloaded).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(downloaded).toHaveBeenCalledTimes(1));
});

it('a stale fetch from a previous document cannot unlock the next document', async () => {
  let completeOld: ((value: Blob) => void) | undefined;
  mockVerifiedFetch.mockImplementationOnce(() => new Promise<Blob>((resolve) => { completeOld = resolve; }))
    .mockResolvedValueOnce(new Blob(['new image'], { type: 'image/png' }));
  const ready = jest.fn();
  const view = render(<DocumentPreviewDialog documentId="old" filename="old.png" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  await waitFor(() => expect(mockVerifiedFetch).toHaveBeenCalledTimes(1));
  view.rerender(<DocumentPreviewDialog documentId="new" filename="new.png" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  const image = await screen.findByAltText('Document preview');
  completeOld?.(new Blob(['old image'], { type: 'image/png' }));
  expect(ready).not.toHaveBeenCalled();
  fireEvent.load(image);
  expect(ready).toHaveBeenCalledTimes(1);
});
