import { render, screen } from '@testing-library/react';
import SellerPlansForLeadPage from '@/app/seller-plans/by-lead/[leadId]/page';
import { listStaffSellerPlansForLead } from '@/services/sellerService';
import type { SellerPlanStaff } from '@/services/sellerService';

jest.mock('next/navigation', () => ({ useParams: () => ({ leadId: 'canonical-1' }) }));
jest.mock('@/services/sellerService', () => ({ listStaffSellerPlansForLead: jest.fn() }));

const listPlans = listStaffSellerPlansForLead as jest.MockedFunction<typeof listStaffSellerPlansForLead>;
const plan = (id: string): SellerPlanStaff => ({
  seller_lead_id: id, canonical_lead_id: 'canonical-1', seller_journey_id: `journey-${id}`, assigned_agent_id: null,
  status: 'requested', property_details_reviewed: false, reco_preparation_recorded: false,
  additional_information_requested: false, manual_valuation_needed: null,
  recommendations_prepared: false, information_request: null, information_response: null, revision: 0,
});

test('one canonical lead can open two distinct Seller Plan workflows', async () => {
  listPlans.mockResolvedValueOnce([plan('seller-1'), plan('seller-2')]);
  render(<SellerPlansForLeadPage />);
  const links = await screen.findAllByRole('link', { name: 'Open Plan progress' });
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    '/seller-plans/seller-1', '/seller-plans/seller-2',
  ]);
  expect(listPlans).toHaveBeenCalledWith('canonical-1');
});

test('unauthorized Plan list does not reveal request details', async () => {
  listPlans.mockRejectedValueOnce({ response: { status: 403 } });
  render(<SellerPlansForLeadPage />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('not available'));
  expect(screen.queryByRole('link', { name: 'Open Plan progress' })).toBeNull();
});
