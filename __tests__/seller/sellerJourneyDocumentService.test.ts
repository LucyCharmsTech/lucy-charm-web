import api from '@/lib/axios';
import {
  fetchSharedJourneyDocumentContent, getSharedJourneyDocument, journeyDocumentError,
  listRequestedJourneyDocuments, listSharedJourneyDocuments, listStaffJourneyDocuments,
  reviewStaffJourneyDocument, shareStaffJourneyDocument, uploadRequestedJourneyDocument,
  uploadStaffJourneyDocument, withdrawStaffJourneyDocument,
} from '@/services/sellerJourneyDocumentService';

jest.mock('@/lib/axios', () => ({ get: jest.fn(), post: jest.fn() }));
const get = api.get as jest.MockedFunction<typeof api.get>;
const post = api.post as jest.MockedFunction<typeof api.post>;
beforeEach(() => { jest.clearAllMocks(); get.mockResolvedValue({ data: [] }); post.mockResolvedValue({ data: {} }); });

test('seller lists and reads only journey-scoped protected document routes', async () => {
  await listSharedJourneyDocuments('journey-a');
  await listRequestedJourneyDocuments('journey-a');
  await getSharedJourneyDocument('journey-a', 'doc-a');
  const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  get.mockResolvedValueOnce({ data: pdf });
  await expect(fetchSharedJourneyDocumentContent('journey-a', 'doc-a')).resolves.toBe(pdf);
  expect(get).toHaveBeenNthCalledWith(1, '/seller-journeys/journey-a/shared-documents');
  expect(get).toHaveBeenNthCalledWith(2, '/seller-journeys/journey-a/document-requests');
  expect(get).toHaveBeenNthCalledWith(3, '/seller-journeys/journey-a/shared-documents/doc-a');
  expect(get).toHaveBeenNthCalledWith(4, '/seller-journeys/journey-a/shared-documents/doc-a/content', { responseType: 'blob', signal: undefined });
});

test('private upload, seller upload, review, share and withdraw use distinct server contracts', async () => {
  const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
  await listStaffJourneyDocuments('j');
  await uploadStaffJourneyDocument('j', file, 'other', 'Details');
  expect((post.mock.calls[0][1] as FormData).get('file')).toBe(file);
  expect((post.mock.calls[0][1] as FormData).get('category')).toBe('other');
  await uploadRequestedJourneyDocument('j', 'request-1', file);
  expect(post.mock.calls[1][0]).toBe('/seller-journeys/j/document-requests/request-1/file');
  await reviewStaffJourneyDocument('j', 'doc-1', 2, 'accepted');
  expect(post.mock.calls[2][1]).toEqual({ expected_revision: 2, outcome: 'accepted', client_reason: null });
  await shareStaffJourneyDocument('j', 'doc-1', 3);
  expect(post.mock.calls[3][0]).toBe('/seller-journeys/j/staff-documents/doc-1/share');
  await withdrawStaffJourneyDocument('j', 'doc-1', 4, 'No longer current');
  expect(post.mock.calls[4][1]).toEqual({ expected_revision: 4, reason: 'No longer current' });
});

test('invalid bytes and revoked access fail closed', async () => {
  get.mockResolvedValue({ data: new Blob(['bad'], { type: 'text/html' }) });
  await expect(fetchSharedJourneyDocumentContent('j', 'd')).rejects.toThrow('invalid');
  expect(journeyDocumentError({ response: { status: 404 } })).toMatch(/no longer available/);
  expect(journeyDocumentError({ response: { status: 409 } })).toMatch(/changed/);
});
