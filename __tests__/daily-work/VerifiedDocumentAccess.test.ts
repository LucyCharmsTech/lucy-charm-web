import api from '@/lib/axios';
import { downloadVerifiedDocumentFile, fetchVerifiedDocumentBlob, DOCUMENT_MAX_BYTES } from '@/services/documentService';

jest.mock('@/lib/axios', () => ({ get: jest.fn() }));

const get = api.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:verified') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
});

it('does not claim receipt when the authenticated byte request fails', async () => {
  get.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Access denied.' } } });
  await expect(fetchVerifiedDocumentBlob('doc-1')).rejects.toThrow();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('rejects empty or oversized content without making a download URL', async () => {
  get.mockResolvedValueOnce({ data: new Blob([]) });
  await expect(downloadVerifiedDocumentFile('doc-1', 'file.pdf')).rejects.toThrow();
  get.mockResolvedValueOnce({ data: { size: DOCUMENT_MAX_BYTES + 1 } });
  await expect(downloadVerifiedDocumentFile('doc-1', 'file.pdf')).rejects.toThrow();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('creates a local download URL only after the complete bounded blob arrives', async () => {
  const blob = new Blob(['verified bytes'], { type: 'application/pdf' });
  get.mockResolvedValueOnce({ data: blob });
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await downloadVerifiedDocumentFile('doc-1', 'file.pdf');
  expect(get).toHaveBeenCalledWith('/documents/doc-1/verified-content', {
    responseType: 'blob', signal: undefined,
  });
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledTimes(1);
  click.mockRestore();
});
