import api from '@/lib/axios';
import {
  approveSellerPlanPdf, fetchPublishedSellerPlan, fetchPublishedSellerPlanPdf,
  fetchStaffSellerPlanPdf, listSellerPlanPdfVersions, publishSellerPlanPdf,
  revokeSellerPlanPdfVerification, uploadSellerPlanPdf, verifySellerPlanPdf,
  withdrawSellerPlanPdf,
} from '@/services/sellerPlanPdfService';

jest.mock('@/lib/axios', () => ({ get: jest.fn(), post: jest.fn() }));

const get = api.get as jest.MockedFunction<typeof api.get>;
const post = api.post as jest.MockedFunction<typeof api.post>;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: {} });
});

test('staff PDF calls use version-scoped endpoints and distinct approval and publication payloads', async () => {
  const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
  await listSellerPlanPdfVersions('lead-1');
  expect(get).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs');
  await uploadSellerPlanPdf('lead-1', file);
  expect(post).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs', expect.any(FormData), {
    headers: { 'Content-Type': undefined },
  });
  const uploadBody = post.mock.calls[0][1] as FormData;
  expect(uploadBody.get('file')).toBe(file);
  await verifySellerPlanPdf('lead-1', 'version-1', {
    expected_revision: 2, scanner_name: 'Scanner', scanner_version: '1',
    evidence_reference: 'report-1234', scan_at: '2026-10-26T10:00:00Z', result: 'clean',
  });
  expect(post).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs/version-1/verification', expect.objectContaining({ evidence_reference: 'report-1234' }));
  await approveSellerPlanPdf('lead-1', 'version-1', 3, 'Approved this exact PDF.');
  expect(post).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs/version-1/approval', {
    expected_revision: 3, compliance_attestation: 'Approved this exact PDF.',
  });
  await publishSellerPlanPdf('lead-1', 'version-1', 4, 7);
  expect(post).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs/version-1/publication', {
    expected_revision: 4, expected_workflow_revision: 7,
  });
  await withdrawSellerPlanPdf('lead-1', 'version-1', 5, 'Withdrawn PDF');
  await revokeSellerPlanPdfVerification('lead-1', 'version-1', 6, 'Revoked scan');
  expect(post).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs/version-1/withdrawal', { expected_revision: 5, reason: 'Withdrawn PDF' });
  expect(post).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs/version-1/verification-revocation', { expected_revision: 6, reason: 'Revoked scan' });
});

test('staff and seller PDFs are fetched as authorized blobs, not presigned object URLs', async () => {
  const body = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  get.mockResolvedValue({ data: body });
  expect(await fetchStaffSellerPlanPdf('lead-1', 'version-1')).toBe(body);
  expect(get).toHaveBeenCalledWith('/seller-leads/lead-1/plan-pdfs/version-1/content', { responseType: 'blob' });
  expect(await fetchPublishedSellerPlanPdf('journey-1', 'version-1')).toBe(body);
  expect(get).toHaveBeenCalledWith('/seller-journeys/journey-1/plan-pdf/content', { responseType: 'blob', params: { expected_version_id: 'version-1' } });
  await fetchPublishedSellerPlan('journey-1');
  expect(get).toHaveBeenCalledWith('/seller-journeys/journey-1/plan-pdf');
});
