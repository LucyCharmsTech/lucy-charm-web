import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SellerPlanPdfManager from '@/components/seller/SellerPlanPdfManager';
import type { SellerPlanStaff } from '@/services/sellerService';
import {
  approveSellerPlanPdf, fetchStaffSellerPlanPdf, listSellerPlanPdfVersions,
  publishSellerPlanPdf, revokeSellerPlanPdfVerification, uploadSellerPlanPdf,
  verifySellerPlanPdf, withdrawSellerPlanPdf,
  type SellerPlanPdfVersion,
} from '@/services/sellerPlanPdfService';

jest.mock('@/components/documents/PdfCanvasPreview', () => function Preview() { return <p>Secure PDF preview</p>; });
jest.mock('@/services/sellerPlanPdfService', () => ({
  approveSellerPlanPdf: jest.fn(), fetchStaffSellerPlanPdf: jest.fn(),
  listSellerPlanPdfVersions: jest.fn(), publishSellerPlanPdf: jest.fn(),
  revokeSellerPlanPdfVerification: jest.fn(), uploadSellerPlanPdf: jest.fn(),
  verifySellerPlanPdf: jest.fn(), withdrawSellerPlanPdf: jest.fn(),
  downloadPdfBlob: jest.fn(),
}));

const list = listSellerPlanPdfVersions as jest.MockedFunction<typeof listSellerPlanPdfVersions>;
const upload = uploadSellerPlanPdf as jest.MockedFunction<typeof uploadSellerPlanPdf>;
const verify = verifySellerPlanPdf as jest.MockedFunction<typeof verifySellerPlanPdf>;
const approve = approveSellerPlanPdf as jest.MockedFunction<typeof approveSellerPlanPdf>;
const publish = publishSellerPlanPdf as jest.MockedFunction<typeof publishSellerPlanPdf>;
const withdraw = withdrawSellerPlanPdf as jest.MockedFunction<typeof withdrawSellerPlanPdf>;
const revoke = revokeSellerPlanPdfVerification as jest.MockedFunction<typeof revokeSellerPlanPdfVerification>;
const read = fetchStaffSellerPlanPdf as jest.MockedFunction<typeof fetchStaffSellerPlanPdf>;

const plan: SellerPlanStaff = {
  seller_lead_id: 'lead-1', canonical_lead_id: 'crm-1', seller_journey_id: 'journey-1',
  assigned_agent_id: 'agent-1', status: 'in_preparation', property_details_reviewed: true,
  reco_preparation_recorded: true, additional_information_requested: false,
  manual_valuation_needed: false, recommendations_prepared: true,
  information_request: null, information_response: null, revision: 4,
};
const version: SellerPlanPdfVersion = {
  id: 'version-1', document_id: 'doc-1', version_number: 1, state: 'draft',
  checksum_sha256: 'a'.repeat(64), revision: 2, scanner_name: null,
  scanner_version: null, scan_evidence_reference: null, scan_at: null,
  scan_result: null, verified_by_user_id: null, verified_at: null,
  verification_revoked_at: null, verification_revoked_by_user_id: null,
  verification_revocation_reason: null, compliance_attestation: null,
  approved_by_user_id: null, approved_at: null, published_by_user_id: null,
  published_at: null, withdrawn_by_user_id: null, withdrawn_at: null,
  withdrawal_reason: null, require_clean_scan: true, scan_policy_eligible: false,
};
const onPlanReload = jest.fn(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  list.mockResolvedValue([version]);
  read.mockResolvedValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
  upload.mockResolvedValue(version);
  verify.mockResolvedValue({ ...version, revision: 3, scan_result: 'clean' });
  approve.mockResolvedValue({ ...version, state: 'approved', revision: 3 });
  publish.mockResolvedValue({ ...version, state: 'published', revision: 3 });
  withdraw.mockResolvedValue({ ...version, state: 'withdrawn', revision: 3 });
  revoke.mockResolvedValue({ ...version, revision: 3, verification_revoked_at: '2026-10-26T00:00:00Z' });
});

test('assigned Agent can upload and view a draft, but cannot approve, publish or withdraw', async () => {
  render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="agent" onPlanReload={onPlanReload} />);
  await screen.findByText('Version 1');
  expect(screen.queryByRole('button', { name: /Record manual scan/i })).toBeNull();
  expect(screen.queryByLabelText('Scanner name')).toBeNull();
  expect(screen.queryByRole('button', { name: /Approve version/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /Publish version/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /Withdraw version/i })).toBeNull();
  const file = new File(['%PDF-1.4'], 'fictional.pdf', { type: 'application/pdf' });
  expect(screen.getByRole('button', { name: 'Upload draft PDF' })).toHaveProperty('disabled', true);
  fireEvent.change(screen.getByLabelText('Select PDF to upload'), { target: { files: [file] } });
  expect(screen.getByText('fictional.pdf')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Upload draft PDF' }));
  await waitFor(() => expect(upload).toHaveBeenCalledWith('lead-1', file));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Upload draft PDF' }) as HTMLButtonElement).disabled).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'View version 1' }));
  await waitFor(() => expect(read).toHaveBeenCalledWith('lead-1', 'version-1'));
  expect(screen.getByText('Secure PDF preview')).toBeTruthy();
  expect(screen.getByRole('dialog', { name: 'Preview version 1' })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Preview version 1' }), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preview version 1' })).toBeNull());
});

test('default scan-required policy keeps a new draft private and blocks approval', async () => {
  render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  await screen.findByText('Version 1');
  expect(screen.getByText(/Approval paused: this PDF needs current approved clean-scan evidence/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Review and approve version 1' })).toHaveProperty('disabled', true);
  expect(screen.queryByLabelText('Scanner name')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Record manual scan' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Revoke verification for version 1' })).toBeNull();
  expect(verify).not.toHaveBeenCalled();
  expect(revoke).not.toHaveBeenCalled();
  expect(approve).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});

test('existing document-safety evidence permits a separate compliance approval', async () => {
  list.mockResolvedValue([{ ...version, scan_result: 'clean', verified_at: '2026-10-26T10:00:00Z', scan_policy_eligible: true }]);
  render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  const button = await screen.findByRole('button', { name: 'Review and approve version 1' });
  expect(button).toHaveProperty('disabled', false);
  fireEvent.click(button);
  expect(screen.getByText(/This is not a file-safety check/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Compliance attestation'), { target: { value: 'Reviewed exact version for publication.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record compliance approval' }));
  await waitFor(() => expect(approve).toHaveBeenCalledWith('lead-1', 'version-1', 2, 'Reviewed exact version for publication.'));
  expect(verify).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
});

test('server safety gate remains visible after an attempted compliance approval', async () => {
  list.mockResolvedValue([{ ...version, scan_result: 'clean', verified_at: '2026-10-26T10:00:00Z', scan_policy_eligible: true }]);
  approve.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'A current approved clean scan of this PDF is required' } } });
  render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Review and approve version 1' }));
  fireEvent.change(screen.getByLabelText('Compliance attestation'), { target: { value: 'Reviewed exact version for publication.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record compliance approval' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Publication is paused'));
  expect(approve).toHaveBeenCalledTimes(1);
  expect(publish).not.toHaveBeenCalled();
});

test('server policy allows an unscanned draft to reach compliance approval without inventing scan evidence', async () => {
  list.mockResolvedValue([{ ...version, require_clean_scan: false, scan_policy_eligible: true }]);
  render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  const button = await screen.findByRole('button', { name: 'Review and approve version 1' });
  expect(button).toHaveProperty('disabled', false);
  expect(screen.getByText(/Clean-scan enforcement is off for this environment/)).toBeTruthy();
  fireEvent.click(button);
  fireEvent.change(screen.getByLabelText('Compliance attestation'), { target: { value: 'Reviewed exact version for publication.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record compliance approval' }));
  await waitFor(() => expect(approve).toHaveBeenCalledTimes(1));
  expect(verify).not.toHaveBeenCalled();
});

test('server-reported blocked safety state disables approval even with scan enforcement off', async () => {
  list.mockResolvedValue([{ ...version, require_clean_scan: false, scan_policy_eligible: false, scan_result: 'failed' }]);
  render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  expect(await screen.findByRole('button', { name: 'Review and approve version 1' })).toHaveProperty('disabled', true);
  expect(screen.getByText(/recorded document-safety state blocks this PDF/)).toBeTruthy();
  expect(approve).not.toHaveBeenCalled();
});

test('Super Admin publication and withdrawal use revision and confirmation', async () => {
  list.mockResolvedValue([{ ...version, state: 'approved', scan_policy_eligible: true }]);
  const { rerender } = render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  await screen.findByRole('button', { name: 'Publish version 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Publish version 1' }));
  expect(publish).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish PDF' }));
  await waitFor(() => expect(publish).toHaveBeenCalledWith('lead-1', 'version-1', 2, 4));
  list.mockResolvedValue([{ ...version, state: 'published', verified_at: '2026-10-26T10:00:00Z' }]);
  rerender(<SellerPlanPdfManager leadId="another-lead" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  await screen.findByRole('button', { name: 'Withdraw version 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw version 1' }));
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Reason'), { target: { value: 'Report replaced' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Withdraw PDF' }));
  await waitFor(() => expect(withdraw).toHaveBeenCalledWith('another-lead', 'version-1', 2, 'Report replaced'));
  expect(screen.queryByRole('button', { name: 'Revoke verification for version 1' })).toBeNull();
  expect(revoke).not.toHaveBeenCalled();
});

test('incomplete checklist blocks approval and publication and conflict remains visible', async () => {
  list.mockResolvedValue([{ ...version, state: 'approved', scan_policy_eligible: true }]);
  const { rerender } = render(<SellerPlanPdfManager leadId="lead-1" plan={{ ...plan, recommendations_prepared: false }} role="superadmin" onPlanReload={onPlanReload} />);
  expect((await screen.findByRole('button', { name: 'Publish version 1' }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  publish.mockRejectedValueOnce({ response: { status: 409 } });
  fireEvent.click(screen.getByRole('button', { name: 'Publish version 1' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish PDF' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('changed'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(list).toHaveBeenCalledTimes(2);
  expect(onPlanReload).toHaveBeenCalled();
});

test('replacement draft remains separate from the current published version', async () => {
  list.mockResolvedValue([
    { ...version, id: 'version-2', document_id: 'doc-2', version_number: 2, state: 'draft' },
    { ...version, id: 'version-1', state: 'published', published_at: '2026-10-25T10:00:00Z' },
  ]);
  render(<SellerPlanPdfManager leadId="lead-1" plan={{ ...plan, status: 'ready' }} role="superadmin" onPlanReload={onPlanReload} />);
  await screen.findByText('Version 2');
  expect(screen.getByText('Version 1').closest('article')?.textContent).toContain('published');
  expect(screen.getByText('Version 2').closest('article')?.textContent).toContain('draft');
  expect(screen.getByRole('button', { name: 'Withdraw version 1' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Publish version 2' })).toBeNull();
});

test('upload validation, storage outage and unauthorized list failures show safe errors', async () => {
  list.mockRejectedValueOnce({ response: { status: 403 } });
  upload.mockRejectedValueOnce({ response: { status: 503 } });
  render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="superadmin" onPlanReload={onPlanReload} />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('not available'));
  const invalid = new File(['not a pdf'], 'notes.txt', { type: 'text/plain' });
  fireEvent.change(screen.getByLabelText('Select PDF to upload'), { target: { files: [invalid] } });
  expect(screen.getByRole('button', { name: 'Upload draft PDF' })).toHaveProperty('disabled', true);
  expect(upload).not.toHaveBeenCalled();
  const pdf = new File(['%PDF-1.4'], 'fictional.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Select PDF to upload'), { target: { files: [pdf] } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload draft PDF' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('storage is unavailable'));
});

test('unauthorized role has no PDF management controls', () => {
  const { container } = render(<SellerPlanPdfManager leadId="lead-1" plan={plan} role="client" onPlanReload={onPlanReload} />);
  expect(container.childElementCount).toBe(0);
  expect(list).not.toHaveBeenCalled();
});
