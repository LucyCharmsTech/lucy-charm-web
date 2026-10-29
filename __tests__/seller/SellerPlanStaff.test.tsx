import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffSellerPlanPage from '@/app/seller-plans/[leadId]/page';
import { useAuthStore } from '@/stores/authStore';
import { fetchStaffSellerPlan, updateStaffSellerPlan } from '@/services/sellerService';
import type { SellerPlanStaff } from '@/services/sellerService';
import { downloadPdfBlob, fetchStaffSellerPlanPdf, listSellerPlanPdfVersions, type SellerPlanPdfVersion } from '@/services/sellerPlanPdfService';

jest.mock('next/navigation', () => ({ useParams: () => ({ leadId: 'seller-1' }) }));
jest.mock('@/services/sellerService', () => ({
  fetchStaffSellerPlan: jest.fn(), updateStaffSellerPlan: jest.fn(),
}));
jest.mock('@/components/documents/PdfCanvasPreview', () => function Preview() { return <p>Old staff PDF preview</p>; });
jest.mock('@/components/seller/JourneyDocumentManager', () => function JourneyDocuments() { return <p>Journey documents section</p>; });
jest.mock('@/components/seller/StaffSellerAppointments', () => function Appointments() { return <p>Staff appointments section</p>; });
jest.mock('@/services/sellerPlanPdfService', () => ({
  listSellerPlanPdfVersions: jest.fn(), fetchStaffSellerPlanPdf: jest.fn(), downloadPdfBlob: jest.fn(),
}));

const fetchPlan = fetchStaffSellerPlan as jest.MockedFunction<typeof fetchStaffSellerPlan>;
const updatePlan = updateStaffSellerPlan as jest.MockedFunction<typeof updateStaffSellerPlan>;
const listVersions = listSellerPlanPdfVersions as jest.MockedFunction<typeof listSellerPlanPdfVersions>;
const readVersion = fetchStaffSellerPlanPdf as jest.MockedFunction<typeof fetchStaffSellerPlanPdf>;
const download = downloadPdfBlob as jest.MockedFunction<typeof downloadPdfBlob>;
const basePlan: SellerPlanStaff = {
  seller_lead_id: 'seller-1', canonical_lead_id: 'canonical-1', seller_journey_id: 'journey-1', assigned_agent_id: null,
  status: 'requested', property_details_reviewed: false, reco_preparation_recorded: false,
  additional_information_requested: false, manual_valuation_needed: null,
  recommendations_prepared: false, information_request: null, information_response: null, revision: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchPlan.mockResolvedValue(basePlan);
  listVersions.mockResolvedValue([]);
  updatePlan.mockImplementation(async (_id, payload) => ({ ...basePlan, ...payload, revision: 1 }));
  useAuthStore.setState({ user: { role: 'superadmin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
});

test('staff identity switch removes versions and preview and ignores a late PDF response', async () => {
  const oldVersion = { id: 'old-version', version_number: 1, state: 'draft', revision: 1 } as SellerPlanPdfVersion;
  listVersions.mockResolvedValueOnce([oldVersion]).mockResolvedValueOnce([]);
  let resolveRead!: (value: Blob) => void;
  readVersion.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
  useAuthStore.setState({ accessToken: 'staff-token-old', user: { user_id: 'staff-old', role: 'superadmin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  render(<StaffSellerPlanPage />);
  await screen.findByText('Version 1');
  fireEvent.click(screen.getByRole('button', { name: 'Download version 1' }));
  await waitFor(() => expect(readVersion).toHaveBeenCalledWith('seller-1', 'old-version'));
  act(() => useAuthStore.setState({ accessToken: 'staff-token-new', user: { user_id: 'staff-new', role: 'superadmin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> }));
  await waitFor(() => expect(listVersions).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Version 1')).toBeNull();
  await act(async () => resolveRead(new Blob(['%PDF-1.4'], { type: 'application/pdf' })));
  await waitFor(() => expect(download).not.toHaveBeenCalled());
  expect(screen.queryByText('Old staff PDF preview')).toBeNull();
});

test('staff identity switch closes a pending publication confirmation', async () => {
  const completePlan = { ...basePlan, status: 'in_preparation' as const, property_details_reviewed: true, reco_preparation_recorded: true, manual_valuation_needed: false, recommendations_prepared: true };
  fetchPlan.mockResolvedValue(completePlan);
  listVersions.mockResolvedValueOnce([{ id: 'old-version', version_number: 1, state: 'approved', revision: 2, require_clean_scan: true, scan_policy_eligible: true } as SellerPlanPdfVersion]).mockResolvedValueOnce([]);
  useAuthStore.setState({ accessToken: 'staff-token-old', user: { user_id: 'staff-old', role: 'superadmin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  render(<StaffSellerPlanPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Publish version 1' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  act(() => useAuthStore.setState({ accessToken: 'staff-token-new', user: { user_id: 'staff-new', role: 'superadmin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(listVersions).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Version 1')).toBeNull();
});

test('staff checklist and Plan status use canonical lead without an independent owner control', async () => {
  render(<StaffSellerPlanPage />);
  expect(await screen.findByRole('link', { name: 'View lead' })).toHaveProperty('href', expect.stringContaining('/admin/inquiries/canonical-1'));
  expect(screen.queryByText(/select agent/i)).toBeNull();
  fireEvent.click(screen.getByLabelText('Property and details reviewed'));
  await waitFor(() => expect(updatePlan).toHaveBeenCalledWith('seller-1', {
    expected_revision: 0, property_details_reviewed: true,
  }));
  expect(screen.getByRole('region', { name: 'Seller Plan PDF versions' })).toBeTruthy();
});

test('specific seller question uses needs_information and stale revision is recoverable', async () => {
  updatePlan.mockRejectedValueOnce({ response: { status: 409 } });
  render(<StaffSellerPlanPage />);
  await screen.findByRole('button', { name: 'Send question' });
  fireEvent.change(screen.getByLabelText('Specific question'), { target: { value: 'What is the renovation year?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  await waitFor(() => expect(updatePlan).toHaveBeenCalledWith('seller-1', {
    expected_revision: 0, status: 'needs_information', information_request: 'What is the renovation year?',
  }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('changed'));
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  await waitFor(() => expect(fetchPlan).toHaveBeenCalledTimes(2));
});

test('agent sees My Leads link and unauthorized plan is not displayed', async () => {
  useAuthStore.setState({ user: { role: 'agent' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  fetchPlan.mockRejectedValueOnce({ response: { status: 403 } });
  render(<StaffSellerPlanPage />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('not available'));
  expect(screen.queryByLabelText('Plan preparation checklist')).toBeNull();
});

test('legacy unlinked Plan displays Super Admin-only central-queue context', async () => {
  fetchPlan.mockResolvedValueOnce({ ...basePlan, canonical_lead_id: null });
  render(<StaffSellerPlanPage />);
  expect(await screen.findByText(/Legacy request without a verified canonical lead/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'View lead' })).toBeNull();
});

test('switching staff accounts clears the old plan and ignores its late response', async () => {
  let resolveOld!: (value: SellerPlanStaff) => void;
  fetchPlan.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  fetchPlan.mockResolvedValueOnce({ ...basePlan, canonical_lead_id: 'canonical-new' });
  useAuthStore.setState({ accessToken: 'staff-token-old', user: { user_id: 'staff-old', role: 'superadmin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  render(<StaffSellerPlanPage />);
  await waitFor(() => expect(fetchPlan).toHaveBeenCalledTimes(1));
  useAuthStore.setState({ accessToken: 'staff-token-new', user: { user_id: 'staff-new', role: 'superadmin' } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
  expect(await screen.findByRole('link', { name: 'View lead' })).toHaveProperty('href', expect.stringContaining('/admin/inquiries/canonical-new'));
  resolveOld(basePlan);
  await waitFor(() => expect(screen.getByRole('link', { name: 'View lead' })).toHaveProperty('href', expect.stringContaining('/admin/inquiries/canonical-new')));
  expect(screen.queryByRole('link', { name: 'View lead' })?.getAttribute('href')).not.toContain('/admin/inquiries/canonical-1');
});
