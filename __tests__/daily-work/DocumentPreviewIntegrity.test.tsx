import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DocumentPreviewDialog from '@/components/documents/DocumentPreviewDialog';
import { mintPreviewUrl, downloadDocumentFile, fetchVerifiedDocumentBlob, downloadVerifiedDocumentFile } from '@/services/documentService';
import { getDocument } from 'pdfjs-dist';

jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

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
const mockGetDocument = getDocument as jest.Mock;
let renderPage: jest.Mock;
let getPage: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDownload.mockResolvedValue(undefined);
  mockVerifiedDownload.mockResolvedValue(undefined);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:verified') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  Object.defineProperty(Blob.prototype, 'arrayBuffer', { configurable: true, value: jest.fn(async () => new Uint8Array([37, 80, 68, 70]).buffer) });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: jest.fn(() => ({})) });
  renderPage = jest.fn(() => ({ promise: Promise.resolve(), cancel: jest.fn() }));
  getPage = jest.fn(async () => ({ getViewport: () => ({ width: 600, height: 800 }), render: renderPage }));
  mockGetDocument.mockImplementation(() => ({
    promise: Promise.resolve({ numPages: 2, getPage, destroy: jest.fn(async () => undefined) }),
    destroy: jest.fn(async () => undefined),
  }));
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

it('staff PDF bytes alone do not mark viewed; a completed page render enables explicit confirmation', async () => {
  mockVerifiedFetch.mockResolvedValue(new Blob(['%PDF-1.7\n%%EOF'], { type: 'application/pdf' }));
  let finishRender: (() => void) | undefined;
  renderPage.mockImplementationOnce(() => ({
    promise: new Promise<void>((resolve) => { finishRender = resolve; }), cancel: jest.fn(),
  }));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(1));
  expect(ready).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'I can read this PDF' })).toBeNull();
  finishRender?.();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'I can read this PDF' })).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'I can read this PDF' }));
  expect(ready).toHaveBeenCalledTimes(1);
  expect(document.querySelector('iframe')).toBeNull();
});

it('homeowner signed PDF can render directly without downloading verified content', async () => {
  mockMint.mockResolvedValue({ url: 'https://example.test/signed.pdf', content_type: 'application/pdf', expires_in: 300 });
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open onClose={jest.fn()} onReady={ready} />);
  await waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
  expect(mockGetDocument).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.test/signed.pdf' }));
  expect(mockVerifiedFetch).not.toHaveBeenCalled();
});

it('multi-page PDF navigation renders the selected page without fetching the file again', async () => {
  mockVerifiedFetch.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open verifiedContent onClose={jest.fn()} />);
  await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  await waitFor(() => expect(getPage).toHaveBeenCalledWith(2));
  expect(screen.getByText('Page 2 of 2')).not.toBeNull();
  expect(mockVerifiedFetch).toHaveBeenCalledTimes(1);
});

it('switching PDFs during a pending render does not unlock the next review session', async () => {
  mockVerifiedFetch.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  let finishOld: (() => void) | undefined;
  renderPage.mockImplementationOnce(() => ({
    promise: new Promise<void>((resolve) => { finishOld = resolve; }), cancel: jest.fn(),
  }));
  const ready = jest.fn();
  const view = render(<DocumentPreviewDialog key="old" documentId="old" filename="old.pdf" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(1));
  view.rerender(<DocumentPreviewDialog key="new" documentId="new" filename="new.pdf" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  finishOld?.();
  await waitFor(() => expect(renderPage).toHaveBeenCalledTimes(2));
  expect(ready).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'I can read this PDF' })).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'I can read this PDF' }));
  expect(ready).toHaveBeenCalledTimes(1);
});

it('failed staff PDF page rendering cannot unlock review, then retry can', async () => {
  mockVerifiedFetch.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  renderPage.mockImplementationOnce(() => ({ promise: Promise.reject(new Error('render failed')), cancel: jest.fn() }));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'I can read this PDF' })).toBeNull();
  expect(ready).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'I can read this PDF' })).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'I can read this PDF' }));
  expect(ready).toHaveBeenCalledTimes(1);
});

it('corrupt PDF loading never exposes review confirmation', async () => {
  mockVerifiedFetch.mockResolvedValue(new Blob(['corrupt'], { type: 'application/pdf' }));
  mockGetDocument.mockImplementation(() => ({ promise: Promise.reject(new Error('invalid PDF')), destroy: jest.fn(async () => undefined) }));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open verifiedContent onClose={jest.fn()} onReady={ready} />);
  await screen.findByRole('alert');
  expect(ready).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'I can read this PDF' })).toBeNull();
});

it('homeowner signed PDF renders, with authorized bounded-content fallback if signed fetch fails', async () => {
  mockMint.mockResolvedValue({ url: 'https://example.test/signed.pdf', content_type: 'application/pdf', expires_in: 300 });
  mockVerifiedFetch.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  mockGetDocument.mockImplementationOnce(() => ({ promise: Promise.reject(new Error('CORS')), destroy: jest.fn(async () => undefined) }));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open onClose={jest.fn()} onReady={ready} />);
  await waitFor(() => expect(mockVerifiedFetch).toHaveBeenCalledWith('doc-1'));
  await waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
  expect(mockMint).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'I can read this PDF' })).toBeNull();
});

it('homeowner signed PDF failure plus fallback failure stays locked and offers retry', async () => {
  mockMint.mockResolvedValue({ url: 'https://example.test/signed.pdf', content_type: 'application/pdf', expires_in: 300 });
  mockVerifiedFetch.mockRejectedValue(new Error('denied'));
  mockGetDocument.mockImplementation(() => ({ promise: Promise.reject(new Error('CORS')), destroy: jest.fn(async () => undefined) }));
  const ready = jest.fn();
  render(<DocumentPreviewDialog documentId="doc-1" filename="file.pdf" open onClose={jest.fn()} onReady={ready} />);
  await screen.findByRole('alert');
  expect(ready).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Retry preview' })).not.toBeNull();
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
