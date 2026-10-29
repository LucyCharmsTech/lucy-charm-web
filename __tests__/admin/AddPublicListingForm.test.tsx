import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AddPublicListingForm from '@/components/admin/AddPublicListingForm';
import { fetchAllAgents } from '@/services/portalService';
import { createPublicListing } from '@/services/listingsService';
import { useAuthStore } from '@/stores/authStore';
import type { AgentProfile, ApiListing } from '@/types/api';

jest.mock('@/services/portalService', () => ({ fetchAllAgents: jest.fn() }));
jest.mock('@/services/listingsService', () => ({ createPublicListing: jest.fn() }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: jest.fn() }));

const agents = fetchAllAgents as jest.MockedFunction<typeof fetchAllAgents>;
const create = createPublicListing as jest.MockedFunction<typeof createPublicListing>;
const auth = useAuthStore as unknown as jest.Mock;
const agent = {
  id: 'agent-profile-1', user_id: 'agent-login-1', name: 'Agent One',
  email: 'agent@example.test', status: 'active',
} as AgentProfile;

beforeEach(() => {
  jest.clearAllMocks();
  auth.mockImplementation((selector) => selector({ user: { role: 'superadmin' } }));
  agents.mockResolvedValue({ items: [agent], total: 1, page: 1, page_size: 100 });
  create.mockResolvedValue({ id: 'returned-listing-id' } as ApiListing);
});

function setup() {
  const refreshed = jest.fn().mockResolvedValue(undefined);
  render(<AddPublicListingForm onCreated={refreshed} />);
  return refreshed;
}

async function openForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Add public listing' }));
  await screen.findByRole('option', { name: /Agent One/ });
}

function fillValid() {
  for (const [name, value] of [
    ['Listing title', 'Fictional townhouse'], ['Price (CAD)', '1250000.00'],
    ['Street address', '12 Main Street'], ['Unit', '4B'], ['City', 'Toronto'],
    ['Province or state', 'ON'], ['Postal or ZIP code', 'M5V 1A1'],
  ]) {
    fireEvent.change(screen.getByRole('textbox', { name: name === 'Unit' ? name : `${name} *` }), { target: { value } });
  }
  fireEvent.change(screen.getByRole('combobox', { name: /^Agent/i }), { target: { value: agent.id } });
}

function confirm() {
  fireEvent.click(screen.getByRole('checkbox', { name: /acknowledge this listing may be publicly accessible/i }));
  fireEvent.click(screen.getByRole('checkbox', { name: /confirm the exact listing details/i }));
}

test('shows the action to Super Admins and loads the authorized active-Agent directory', async () => {
  setup();
  expect(screen.queryByRole('button', { name: 'Create public listing' })).toBeNull();
  await openForm();
  expect(agents).toHaveBeenCalledWith(1, 100);
  expect(screen.getByRole('option', { name: /Agent One/ }).getAttribute('value')).toBe(agent.id);
  expect(screen.getByText(/does not establish the linked login account’s status/i)).toBeTruthy();
});

test('hides creation controls from Agents and clients', () => {
  for (const role of ['agent', 'client']) {
    auth.mockImplementation((selector) => selector({ user: { role } }));
    const view = render(<AddPublicListingForm onCreated={jest.fn()} />);
    expect(view.queryByRole('button', { name: 'Add public listing' })).toBeNull();
    view.unmount();
  }
  expect(agents).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
});

test('requires the title, address, Agent, and other mandatory details', async () => {
  setup();
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  expect(screen.getByRole('alert').textContent).toContain('Enter the title');
  expect(create).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: /Listing title/i }), { target: { value: 'Fictional townhouse' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  expect(screen.getByRole('alert').textContent).toContain('Enter the address');
});

test.each(['0', '-100', '1e6', '1,000,000', '100.123'])('rejects invalid price %s', async (price) => {
  setup();
  await openForm();
  fillValid();
  fireEvent.change(screen.getByRole('textbox', { name: /Price \(CAD\)/i }), { target: { value: price } });
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  expect(screen.getByRole('alert').textContent).toContain('positive price in CAD');
  expect(create).not.toHaveBeenCalled();
});

test('rejects overlong input even when programmatically supplied', async () => {
  setup();
  await openForm();
  fillValid();
  fireEvent.change(screen.getByRole('textbox', { name: /Listing title/i }), { target: { value: 'X'.repeat(256) } });
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  expect(screen.getByRole('alert').textContent).toContain('title is too long');
  expect(create).not.toHaveBeenCalled();
});

test('shows exact entered details and requires two fresh confirmations', async () => {
  setup();
  await openForm();
  fillValid();
  expect(screen.getByText('Creating this listing may make it immediately accessible through public listing APIs. This is not a private draft.')).toBeTruthy();
  expect(screen.getByText('12 Main Street')).toBeTruthy();
  expect(screen.getByText('1250000.00 CAD')).toBeTruthy();
  expect(screen.getByText(`Agent One · ${agent.id}`)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  expect(screen.getByRole('alert').textContent).toContain('Acknowledge public API access');
  confirm();
  fireEvent.change(screen.getByRole('textbox', { name: /Street address/i }), { target: { value: '14 Main Street' } });
  expect(screen.getAllByRole('checkbox').every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true);
  expect(create).not.toHaveBeenCalled();
});

test('creates only the public listing with the profile ID, returns its ID, and refreshes catalog', async () => {
  const refreshed = setup();
  await openForm();
  fillValid();
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  expect(create).toHaveBeenCalledWith({
    title: 'Fictional townhouse', price: 1250000, agent_id: agent.id,
    address: '12 Main Street', unit: '4B', city: 'Toronto', state: 'ON',
    zip: 'M5V 1A1', country: 'CA',
  });
  expect(agent.id).not.toBe(agent.user_id);
  expect(await screen.findByText('returned-listing-id')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'View listing' }).getAttribute('href')).toBe('/admin/listings/returned-listing-id');
  expect(refreshed).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Create public listing' })).toBeNull();
});

test('prevents a duplicate submission while creation is pending', async () => {
  setup();
  let finish!: (value: ApiListing) => void;
  create.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await openForm();
  fillValid();
  confirm();
  const button = screen.getByRole('button', { name: 'Create public listing' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Creating listing…' }).hasAttribute('disabled')).toBe(true);
  finish({ id: 'returned-listing-id' } as ApiListing);
  expect(await screen.findByText('returned-listing-id')).toBeTruthy();
});

test.each([
  [{ response: { status: 422, data: { detail: [{ loc: ['body', 'title'], msg: 'String too short' }] } } }, 'title: String too short'],
  [{ response: { status: 403, data: { detail: 'Forbidden for this account' } } }, 'Forbidden for this account'],
  [{ response: { status: 403, data: {} } }, 'Your account is not authorized'],
])('shows backend validation and authorization errors', async (failure, message) => {
  setup();
  create.mockRejectedValue(failure);
  await openForm();
  fillValid();
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  expect((await screen.findByRole('alert')).textContent).toContain(message);
  expect(screen.queryByText('returned-listing-id')).toBeNull();
});

test('keeps the returned ID visible when a later catalog refresh fails', async () => {
  const refreshed = setup();
  refreshed.mockRejectedValue(new Error('Offline'));
  await openForm();
  fillValid();
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create public listing' }));
  expect(await screen.findByText('returned-listing-id')).toBeTruthy();
  expect((await screen.findByRole('alert')).textContent).toContain('was created, but the catalog could not refresh');
  expect(create).toHaveBeenCalledTimes(1);
});
