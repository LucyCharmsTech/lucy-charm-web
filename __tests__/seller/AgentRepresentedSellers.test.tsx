import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AgentRepresentedSellersPage from '@/app/agent/represented-sellers/page';
import AgentLayout from '@/app/agent/layout';
import AdminLayout from '@/app/admin/layout';
import { fetchAssignedSellerTransactions } from '@/services/sellerService';
import { useAuthStore } from '@/stores/authStore';
import type { ApiPaginated } from '@/types/api';
import type { AssignedSellerTransaction } from '@/services/sellerService';

jest.mock('@/services/sellerService', () => ({ fetchAssignedSellerTransactions: jest.fn() }));
jest.mock('@/components/portals/RoleGate', () => function Gate({ children }: { children: React.ReactNode }) { return <>{children}</>; });
jest.mock('@/components/portals/PortalHeader', () => function Header() { return <div>Portal header</div>; });
jest.mock('@/components/portals/PortalSidebar', () => function Sidebar({ links }: { links: { href: string; label: string }[] }) {
  return <nav aria-label="Portal navigation">{links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>;
});

const fetchAssigned = fetchAssignedSellerTransactions as jest.MockedFunction<typeof fetchAssignedSellerTransactions>;
const first: AssignedSellerTransaction = {
  transaction_id: 'transaction-one', property_address: '12 Example Road',
  property_unit: '3', property_city: 'Toronto', property_region: 'ON', current_stage: 'showings',
};
const second: AssignedSellerTransaction = {
  transaction_id: 'transaction-two', property_address: '4 Sample Lane',
  property_unit: null, property_city: 'Ottawa', property_region: 'ON', current_stage: 'preparation',
};
function page(items: AssignedSellerTransaction[], currentPage = 1, total = items.length): ApiPaginated<AssignedSellerTransaction> {
  return { page: currentPage, page_size: 20, total, items };
}
function setAccount(role: 'agent' | 'client' | 'superadmin', userId = `${role}-one`, token = `${role}-token`) {
  useAuthStore.setState({ accessToken: token, user: { user_id: userId, role } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']> });
}

beforeEach(() => {
  jest.clearAllMocks();
  setAccount('agent');
  fetchAssigned.mockResolvedValue(page([first]));
});

test('Agent navigation includes Represented Sellers while Admin navigation keeps Seller pipeline', () => {
  const view = render(<AgentLayout><div>Agent content</div></AgentLayout>);
  expect(within(screen.getByRole('navigation', { name: 'Portal navigation' })).getByRole('link', { name: 'Represented Sellers' }).getAttribute('href')).toBe('/agent/represented-sellers');
  view.unmount();
  render(<AdminLayout><div>Admin content</div></AdminLayout>);
  const adminNav = screen.getByRole('navigation', { name: 'Portal navigation' });
  expect(within(adminNav).getByRole('link', { name: 'Seller pipeline' }).getAttribute('href')).toBe('/admin/sellers');
  expect(within(adminNav).queryByRole('link', { name: 'Represented Sellers' })).toBeNull();
});

test('assigned index loads safe property fields and links only to the returned transaction', async () => {
  render(<AgentRepresentedSellersPage />);
  expect(screen.getByRole('status').textContent).toContain('Loading');
  expect((await screen.findByRole('link', { name: /12 Example Road/ })).getAttribute('href')).toBe('/seller-portal/transaction-one');
  expect(screen.getByText('Toronto, ON')).toBeTruthy();
  expect(screen.getByText('Current stage: showings')).toBeTruthy();
  expect(fetchAssigned).toHaveBeenCalledWith(1, 20);
  expect(screen.queryByText(/buyer|internal note|feedback/i)).toBeNull();
});

test('empty assigned list is a successful state', async () => {
  fetchAssigned.mockResolvedValue(page([]));
  render(<AgentRepresentedSellersPage />);
  expect(await screen.findByText('No active represented-seller transactions are assigned to you.')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('pagination requests only one bounded page and preserves server ordering', async () => {
  fetchAssigned.mockImplementation(async (currentPage) => currentPage === 1
    ? page([first], 1, 21) : page([second], 2, 21));
  render(<AgentRepresentedSellersPage />);
  expect(await screen.findByRole('link', { name: /12 Example Road/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(await screen.findByRole('link', { name: /4 Sample Lane/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /12 Example Road/ })).toBeNull();
  expect(fetchAssigned).toHaveBeenNthCalledWith(2, 2, 20);
  expect(screen.getByText('Page 2 of 2 · 21 total')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(await screen.findByRole('link', { name: /12 Example Road/ })).toBeTruthy();
});

test.each([403, 404, 503])('HTTP %s clears rows and shows the correct unavailable state', async (status) => {
  fetchAssigned.mockRejectedValue({ response: { status } });
  render(<AgentRepresentedSellersPage />);
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain(status === 403 ? 'no longer authorized' : 'temporarily unavailable');
  expect(screen.queryByRole('link', { name: /12 Example Road/ })).toBeNull();
  fetchAssigned.mockResolvedValue(page([first]));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('link', { name: /12 Example Road/ })).toBeTruthy();
});

test('assignment loss on focus removes the prior list before the denied response arrives', async () => {
  render(<AgentRepresentedSellersPage />);
  expect(await screen.findByRole('link', { name: /12 Example Road/ })).toBeTruthy();
  fetchAssigned.mockRejectedValue({ response: { status: 403 } });
  fireEvent.focus(window);
  expect(screen.queryByRole('link', { name: /12 Example Road/ })).toBeNull();
  expect((await screen.findByRole('alert')).textContent).toContain('no longer authorized');
});

test('account switch and authorization loss never show the previous Agent list', async () => {
  let resolveSecond!: (value: ApiPaginated<AssignedSellerTransaction>) => void;
  const pending = new Promise<ApiPaginated<AssignedSellerTransaction>>((resolve) => { resolveSecond = resolve; });
  fetchAssigned.mockImplementation(async () => fetchAssigned.mock.calls.length === 1 ? page([first]) : pending);
  render(<AgentRepresentedSellersPage />);
  expect(await screen.findByRole('link', { name: /12 Example Road/ })).toBeTruthy();
  act(() => setAccount('agent', 'agent-two', 'agent-two-token'));
  expect(screen.queryByRole('link', { name: /12 Example Road/ })).toBeNull();
  await waitFor(() => expect(fetchAssigned).toHaveBeenCalledTimes(2));
  act(() => resolveSecond(page([second])));
  expect(await screen.findByRole('link', { name: /4 Sample Lane/ })).toBeTruthy();
  act(() => setAccount('client'));
  expect(screen.queryByRole('link', { name: /4 Sample Lane/ })).toBeNull();
  expect(screen.getByText('Sign in with an Agent account to view represented sellers.')).toBeTruthy();
  expect(fetchAssigned).toHaveBeenCalledTimes(2);
});
