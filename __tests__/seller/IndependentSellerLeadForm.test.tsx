import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import IndependentSellerLeadForm from '@/components/seller/IndependentSellerLeadForm';
import { fetchAllAgents } from '@/services/portalService';
import { createSellerLead, sellerApiErrorMessage } from '@/services/sellerService';
import { fetchSellerAccountsAdmin } from '@/services/userService';
import type { AgentProfile, SellerAccountLookup, SellerLead } from '@/types/api';

jest.mock('@/services/portalService', () => ({ fetchAllAgents: jest.fn() }));
jest.mock('@/services/userService', () => ({ fetchSellerAccountsAdmin: jest.fn() }));
jest.mock('@/services/sellerService', () => ({
  createSellerLead: jest.fn(),
  sellerApiErrorMessage: jest.requireActual('@/services/sellerService').sellerApiErrorMessage,
}));

const fetchAccounts = fetchSellerAccountsAdmin as jest.MockedFunction<typeof fetchSellerAccountsAdmin>;
const fetchAgents = fetchAllAgents as jest.MockedFunction<typeof fetchAllAgents>;
const create = createSellerLead as jest.MockedFunction<typeof createSellerLead>;

const seller: SellerAccountLookup = {
  id: 'seller-user-1', email: 'seller@example.com', first_name: 'Taylor',
  last_name: 'Seller', role: 'client', is_anonymous: false, deactivated_at: null,
};
const activeAgent = {
  id: 'agent-1', user_id: 'agent-user-1', name: 'Agent One',
  email: 'agent@example.com', status: 'active',
} as AgentProfile;

function prepare() {
  jest.clearAllMocks();
  fetchAccounts.mockResolvedValue({
    items: [seller], total: 1, page: 1, page_size: 100,
  });
  fetchAgents.mockResolvedValue({
    items: [activeAgent], total: 1, page: 1, page_size: 100,
  });
  create.mockResolvedValue({ id: 'new-lead' } as SellerLead);
  const refresh = jest.fn().mockResolvedValue(undefined);
  render(<IndependentSellerLeadForm onCreated={refresh} />);
  return refresh;
}

async function openForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Add independent seller lead' }));
  await screen.findByRole('option', { name: /Taylor Seller.*seller@example.com/i });
}

function selectSellerAndAgent() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Existing seller account' }), {
    target: { value: seller.id },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Assigned Agent' }), {
    target: { value: activeAgent.id },
  });
}

function fillProperty() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Property street address' }), {
    target: { value: '12 Main Street' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'City' }), {
    target: { value: 'Toronto' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Region or province' }), {
    target: { value: 'ON' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Postal or ZIP code' }), {
    target: { value: 'M5V 1A1' },
  });
}

test('opens the independent form and explains backend-only verification', async () => {
  prepare();
  expect(screen.queryByRole('button', { name: 'Create independent lead' })).toBeNull();
  await openForm();
  expect(fetchAccounts).toHaveBeenCalledWith(1, 100);
  expect(fetchAgents).toHaveBeenCalledWith(1, 100);
  expect(screen.getByText(/separate from Seller Plan requests/i)).toBeTruthy();
  expect(screen.getByText(/list cannot show email verification/i)).toBeTruthy();
  expect(screen.getByText(/Agent’s login is active/i)).toBeTruthy();
});

test('requires the selected account, Agent, and complete property details', async () => {
  prepare();
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Create independent lead' }));
  expect(screen.getByRole('alert').textContent).toContain('Select an existing seller account');
  selectSellerAndAgent();
  fireEvent.click(screen.getByRole('button', { name: 'Create independent lead' }));
  expect(screen.getByRole('alert').textContent).toContain('complete property address');
  expect(create).not.toHaveBeenCalled();
});

test('links the selected client ID and active Agent email, then refreshes without conversion', async () => {
  const refresh = prepare();
  await openForm();
  selectSellerAndAgent();
  expect(screen.getByRole('textbox', { name: 'Contact email' }).hasAttribute('readonly')).toBe(true);
  fillProperty();
  fireEvent.click(screen.getByRole('button', { name: 'Create independent lead' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith(expect.objectContaining({
    seller_user_id: seller.id,
    agent_email: activeAgent.email,
    first_name: seller.first_name,
    last_name: seller.last_name,
    email: seller.email,
    property_address: '12 Main Street',
    inquiry_type: 'agent_contact',
    source: 'staff_independent',
  }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('status').textContent).toContain('Representation is not active');
  expect(screen.queryByRole('button', { name: 'Create independent lead' })).toBeNull();
});

test('shows inactive account and Agent states, and does not offer staff accounts', async () => {
  prepare();
  fetchAccounts.mockResolvedValue({
    items: [seller, { ...seller, id: 'closed', email: 'closed@example.com', deactivated_at: '2026-10-01T00:00:00Z' },
      { ...seller, id: 'staff', role: 'agent', email: 'staff@example.com' }],
    total: 3, page: 1, page_size: 100,
  });
  fetchAgents.mockResolvedValue({
    items: [activeAgent, { ...activeAgent, id: 'pending', status: 'pending', name: 'Pending Agent' }],
    total: 2, page: 1, page_size: 100,
  });
  await openForm();
  const accounts = screen.getByRole('combobox', { name: 'Existing seller account' });
  expect(within(accounts).getByRole('option', { name: /closed@example.com.*deactivated/i }).hasAttribute('disabled')).toBe(true);
  expect(within(accounts).queryByRole('option', { name: /staff@example.com/i })).toBeNull();
  const agents = screen.getByRole('combobox', { name: 'Assigned Agent' });
  expect(within(agents).getByRole('option', { name: /Pending Agent.*pending profile/i }).hasAttribute('disabled')).toBe(true);
});

test('loads later account pages so selection is not limited to the first 100 users', async () => {
  prepare();
  fetchAccounts
    .mockResolvedValueOnce({
      items: [{ ...seller, id: 'staff-first', role: 'superadmin' }],
      total: 101, page: 1, page_size: 100,
    })
    .mockResolvedValueOnce({ items: [seller], total: 101, page: 2, page_size: 100 });
  fireEvent.click(screen.getByRole('button', { name: 'Add independent seller lead' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Load more accounts' }));
  await screen.findByRole('option', { name: /Taylor Seller.*seller@example.com/i });
  expect(fetchAccounts).toHaveBeenCalledWith(2, 100);
});

test('shows backend verification and Agent-login failures without clearing the form', async () => {
  prepare();
  create
    .mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Seller user must be a verified, active client account' } } })
    .mockRejectedValueOnce({ response: { status: 422, data: { detail: 'No active agent was found for that email address' } } });
  await openForm();
  selectSellerAndAgent();
  fillProperty();
  fireEvent.click(screen.getByRole('button', { name: 'Create independent lead' }));
  expect(await screen.findByText('Seller user must be a verified, active client account')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create independent lead' }));
  expect(await screen.findByText('No active agent was found for that email address')).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Existing seller account' })).toHaveProperty('value', seller.id);
});

test('shows backend authorization failures', async () => {
  prepare();
  create.mockRejectedValue({ response: { status: 403, data: { detail: 'Staff access is required' } } });
  await openForm();
  selectSellerAndAgent();
  fillProperty();
  fireEvent.click(screen.getByRole('button', { name: 'Create independent lead' }));
  expect(await screen.findByText('Staff access is required')).toBeTruthy();
});

test('prevents duplicate submissions while a creation request is pending', async () => {
  prepare();
  let finish!: (lead: SellerLead) => void;
  create.mockImplementation(() => new Promise<SellerLead>((resolve) => { finish = resolve; }));
  await openForm();
  selectSellerAndAgent();
  fillProperty();
  const form = screen.getByRole('button', { name: 'Create independent lead' }).closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Creating lead…' }).hasAttribute('disabled')).toBe(true);
  finish({ id: 'new-lead' } as SellerLead);
  await screen.findByText(/Representation is not active yet/i);
});

test('keeps FastAPI field-level validation detail readable', () => {
  expect(sellerApiErrorMessage({
    response: { status: 422, data: { detail: [
      { loc: ['body', 'property_postal_code'], msg: 'Enter a valid postal code' },
    ] } },
  })).toBe('property_postal_code: Enter a valid postal code');
});
