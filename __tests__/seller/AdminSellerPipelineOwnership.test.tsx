import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminSellersPage from '@/app/admin/sellers/page';
import { fetchAllAgents } from '@/services/portalService';
import { createSellerLead, convertSellerLead, fetchSellerLeadsAdmin, fetchSellerTransactionsAdmin, updateSellerLead } from '@/services/sellerService';
import { fetchSellerAccountsAdmin } from '@/services/userService';
import type { SellerLead, SellerTransaction } from '@/types/api';

jest.mock('@/services/portalService', () => ({ fetchAllAgents: jest.fn() }));
jest.mock('@/services/userService', () => ({ fetchSellerAccountsAdmin: jest.fn() }));
jest.mock('@/components/seller/PublicListingAssociation', () => ({
  __esModule: true,
  default: ({ transaction }: { transaction: SellerTransaction }) => (
    <div>Association for {transaction.id}</div>
  ),
}));
jest.mock('@/services/sellerService', () => ({
  createSellerLead: jest.fn(),
  fetchSellerLeadsAdmin: jest.fn(),
  fetchSellerTransactionsAdmin: jest.fn(),
  updateSellerLead: jest.fn(),
  convertSellerLead: jest.fn(),
  sellerApiErrorMessage: jest.requireActual('@/services/sellerService').sellerApiErrorMessage,
}));

const agents = fetchAllAgents as jest.MockedFunction<typeof fetchAllAgents>;
const leads = fetchSellerLeadsAdmin as jest.MockedFunction<typeof fetchSellerLeadsAdmin>;
const transactions = fetchSellerTransactionsAdmin as jest.MockedFunction<typeof fetchSellerTransactionsAdmin>;
const update = updateSellerLead as jest.MockedFunction<typeof updateSellerLead>;
const create = createSellerLead as jest.MockedFunction<typeof createSellerLead>;
const convert = convertSellerLead as jest.MockedFunction<typeof convertSellerLead>;
const accounts = fetchSellerAccountsAdmin as jest.MockedFunction<typeof fetchSellerAccountsAdmin>;

function sellerLead(id: string, canonicalLeadId: string | null, journeyId: string | null = null): SellerLead {
  return {
    id,
    user_id: null,
    seller_journey_id: journeyId,
    canonical_lead_id: canonicalLeadId,
    assigned_agent_id: 'agent-1',
    first_name: id === 'linked' ? 'Linked' : 'Legacy',
    last_name: 'Seller',
    email: null,
    phone: null,
    inquiry_type: 'professional_review',
    status: 'consultation_requested',
    representation_status: 'none',
    source: 'seller_journey_handoff',
    notes: null,
    property_address: '123 Main Street',
    property_unit: null,
    property_city: 'Toronto',
    property_region: 'ON',
    property_postal_code: 'M5V 1A1',
    property_country: 'CA',
    converted_client_id: null,
    portal_activated_at: null,
    created_at: '2026-10-24T00:00:00Z',
    updated_at: '2026-10-24T00:00:00Z',
  };
}

test('linked Seller Plan ownership is read-only and navigates to canonical Inquiries', async () => {
  jest.clearAllMocks();
  leads.mockResolvedValue({ items: [sellerLead('linked', 'lead-1')], total: 1, page: 1, page_size: 50 });
  transactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [{ id: 'agent-1', name: 'Agent One' }], total: 1, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);

  render(<AdminSellersPage />);
  const row = (await screen.findByText('Linked Seller')).closest('tr');
  expect(row).not.toBeNull();
  const ownerCell = row!.querySelectorAll('td')[3];
  expect(ownerCell.textContent).toContain('Agent One');
  expect(within(ownerCell).queryByRole('combobox')).toBeNull();
  expect(within(ownerCell).getByRole('link', { name: 'Change agent on lead' }).getAttribute('href'))
    .toBe('/admin/inquiries/lead-1');
  expect(within(ownerCell).getByRole('link', { name: 'Manage Plan progress' }).getAttribute('href'))
    .toBe('/seller-plans/linked');
  expect(update).not.toHaveBeenCalled();
});

test('genuinely unlinked seller leads retain the legacy assignment control', async () => {
  jest.clearAllMocks();
  leads.mockResolvedValue({ items: [sellerLead('legacy', null)], total: 1, page: 1, page_size: 50 });
  transactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [{ id: 'agent-1', name: 'Agent One' }], total: 1, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);
  update.mockResolvedValue(sellerLead('legacy', null));

  render(<AdminSellersPage />);
  const row = (await screen.findByText('Legacy Seller')).closest('tr');
  const ownerCell = row!.querySelectorAll('td')[3];
  fireEvent.change(within(ownerCell).getByRole('combobox'), { target: { value: '' } });
  await waitFor(() => expect(update).toHaveBeenCalledWith('legacy', { assigned_agent_id: null }));
});

test('legacy journey-linked Plan offers Super Admin progress without independent assignment', async () => {
  jest.clearAllMocks();
  leads.mockResolvedValue({ items: [sellerLead('legacy-plan', null, 'journey-1')], total: 1, page: 1, page_size: 50 });
  transactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);

  render(<AdminSellersPage />);
  const row = (await screen.findByText('Legacy Seller')).closest('tr');
  const ownerCell = row!.querySelectorAll('td')[3];
  expect(within(ownerCell).queryByRole('combobox')).toBeNull();
  expect(within(ownerCell).getByRole('link', { name: 'Manage Plan progress (Super Admin)' }).getAttribute('href'))
    .toBe('/seller-plans/legacy-plan');
  expect(update).not.toHaveBeenCalled();
});

test('journey-linked Plan leads expose no representation conversion controls', async () => {
  jest.clearAllMocks();
  leads.mockResolvedValue({
    items: [sellerLead('linked', 'lead-1', 'journey-1'), sellerLead('legacy-plan', null, 'journey-2')],
    total: 2, page: 1, page_size: 50,
  });
  transactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);

  render(<AdminSellersPage />);
  await screen.findByText('Linked Seller');
  for (const name of ['Linked Seller', 'Legacy Seller']) {
    const row = screen.getByText(name).closest('tr')!;
    expect(within(row).queryByRole('combobox', { name: 'Representation' })).toBeNull();
    expect(within(row).queryByRole('checkbox', { name: /required representation and compliance/i })).toBeNull();
    expect(within(row).queryByRole('button', { name: 'Convert' })).toBeNull();
    expect(within(row).getByText(/representation is a separate workflow/i)).toBeTruthy();
  }
});

test('genuinely unlinked legacy leads retain representation conversion controls', async () => {
  jest.clearAllMocks();
  leads.mockResolvedValue({ items: [sellerLead('legacy', null)], total: 1, page: 1, page_size: 50 });
  transactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);

  render(<AdminSellersPage />);
  const row = (await screen.findByText('Legacy Seller')).closest('tr')!;
  expect(within(row).getByRole('combobox', { name: 'Representation' })).toBeTruthy();
  expect(within(row).getByRole('checkbox', { name: /required representation and compliance/i })).toBeTruthy();
  expect(within(row).getByRole('button', { name: 'Convert' })).toBeTruthy();
});

test('Super Admin pipeline exposes independent creation and refreshes leads without converting', async () => {
  jest.clearAllMocks();
  leads
    .mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 50 })
    .mockResolvedValue({ items: [sellerLead('new', null)], total: 1, page: 1, page_size: 50 });
  transactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [{ id: 'agent-1', user_id: 'agent-user-1', name: 'Agent One', email: 'agent@example.com', status: 'active' }], total: 1, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);
  accounts.mockResolvedValue({
    items: [{ id: 'seller-user-1', email: 'seller@example.com', first_name: 'Taylor', last_name: 'Seller', role: 'client', is_anonymous: false, deactivated_at: null }],
    total: 1, page: 1, page_size: 100,
  });
  create.mockResolvedValue(sellerLead('new', null));

  render(<AdminSellersPage />);
  await screen.findByText('No seller leads yet.');
  fireEvent.click(screen.getByRole('button', { name: 'Add independent seller lead' }));
  await screen.findByRole('option', { name: /Taylor Seller.*seller@example.com/i });
  fireEvent.change(screen.getByRole('combobox', { name: 'Existing seller account' }), { target: { value: 'seller-user-1' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Assigned Agent' }), { target: { value: 'agent-1' } });
  for (const [name, value] of [
    ['Property street address', '12 Main Street'], ['City', 'Toronto'],
    ['Region or province', 'ON'], ['Postal or ZIP code', 'M5V 1A1'],
  ]) {
    fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Create independent lead' }));
  await waitFor(() => expect(leads).toHaveBeenCalledTimes(2));
  expect(create).toHaveBeenCalledTimes(1);
  expect(convert).not.toHaveBeenCalled();
  expect(await screen.findByText('Legacy Seller')).toBeTruthy();
});

test('conversion errors stay with the independent lead and keep backend detail', async () => {
  jest.clearAllMocks();
  leads.mockResolvedValue({ items: [sellerLead('legacy', null)], total: 1, page: 1, page_size: 50 });
  transactions.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);
  convert.mockRejectedValue({ response: { status: 422, data: { detail: 'A verified, active seller account is required before conversion' } } });

  render(<AdminSellersPage />);
  const row = (await screen.findByText('Legacy Seller')).closest('tr')!;
  fireEvent.change(within(row).getByRole('combobox', { name: 'Representation' }), { target: { value: 'brokerage' } });
  fireEvent.click(within(row).getByRole('checkbox', { name: /required representation and compliance/i }));
  fireEvent.click(within(row).getByRole('button', { name: 'Convert' }));
  expect(await within(row).findByRole('alert')).toHaveProperty(
    'textContent', 'A verified, active seller account is required before conversion',
  );
});

test('Super Admin pipeline opens association for the exact represented transaction', async () => {
  jest.clearAllMocks();
  leads.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
  agents.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 } as Awaited<ReturnType<typeof fetchAllAgents>>);
  const transaction: SellerTransaction = {
    id: 'represented-1', seller_client_id: 'seller-1', property_id: 'property-1',
    stage: 'active_listing', status: 'open', representation_type: 'brokerage',
    representation_status: 'active', portal_activated_at: '2026-10-28T00:00:00Z',
    closed_at: null, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z',
  };
  transactions.mockResolvedValue({ items: [transaction], total: 1, page: 1, page_size: 50 });

  render(<AdminSellersPage />);
  const row = (await screen.findByText(transaction.id)).closest('tr')!;
  const trigger = within(row).getByRole('button', { name: 'Public listing association' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  expect(await screen.findByText(`Association for ${transaction.id}`)).toBeTruthy();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
});
