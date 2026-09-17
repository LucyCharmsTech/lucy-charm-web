import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientSavedSearchesSection from '@/components/profile/ClientSavedSearchesSection';
import {
  createSavedSearch,
  deleteSavedSearch,
  fetchMySavedSearches,
  fetchSavedSearchLimit,
  importDeviceSearches,
  updateSavedSearch,
} from '@/services/savedSearchService';
import { listSavedSearches } from '@/lib/clientPortalStorage';
import { fetchListingFacetOptions } from '@/services/listingsService';
import type { SavedSearch } from '@/types/api';

/**
 * Saved searches — control 6.1 and the client's Q6.
 *
 * Was localStorage capped at three; now server-backed with a configurable
 * limit, a per-search email control, and a device-import offer.
 */

jest.mock('@/services/savedSearchService', () => {
  const actual = jest.requireActual('@/services/savedSearchService');
  return {
    ...actual,
    fetchMySavedSearches: jest.fn(),
    fetchSavedSearchLimit: jest.fn(),
    createSavedSearch: jest.fn(),
    updateSavedSearch: jest.fn(),
    deleteSavedSearch: jest.fn(),
    importDeviceSearches: jest.fn(),
  };
});
jest.mock('@/lib/clientPortalStorage', () => ({ listSavedSearches: jest.fn() }));
jest.mock('@/services/listingsService', () => ({ fetchListingFacetOptions: jest.fn() }));

const mockList = fetchMySavedSearches as jest.MockedFunction<typeof fetchMySavedSearches>;
const mockLimit = fetchSavedSearchLimit as jest.MockedFunction<typeof fetchSavedSearchLimit>;
const mockCreate = createSavedSearch as jest.MockedFunction<typeof createSavedSearch>;
const mockUpdate = updateSavedSearch as jest.MockedFunction<typeof updateSavedSearch>;
const mockDelete = deleteSavedSearch as jest.MockedFunction<typeof deleteSavedSearch>;
const mockImport = importDeviceSearches as jest.MockedFunction<typeof importDeviceSearches>;
const mockDevice = listSavedSearches as jest.MockedFunction<typeof listSavedSearches>;
const mockFacets = fetchListingFacetOptions as jest.MockedFunction<typeof fetchListingFacetOptions>;

function search(over: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 's1',
    name: 'Downtown condos',
    filters: { city: 'toronto', beds_min: 2 },
    email_enabled: false,
    baseline_at: '2026-09-05T10:00:00Z',
    last_notified_at: null,
    imported_at: null,
    created_at: '2026-09-05T10:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue([]);
  mockLimit.mockResolvedValue({ limit: 5, used: 0 });
  mockCreate.mockResolvedValue(search());
  mockUpdate.mockImplementation(async (_id, patch) =>
    search({ email_enabled: patch.email_enabled ?? false }),
  );
  mockDelete.mockResolvedValue(undefined);
  mockImport.mockResolvedValue({ imported: [search()], duplicates: [], rejected: [] });
  mockDevice.mockReturnValue([]);
  mockFacets.mockResolvedValue({ cities: ['Toronto'], propertyTypes: ['condo'] });
});

test('says the searches live on the account, not the device', async () => {
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByText(/follow you between devices/)).toBeTruthy());
});

test('reads the limit from the server rather than hardcoding five', async () => {
  // Q6 says five, "configurable" — the number belongs in one place.
  mockLimit.mockResolvedValue({ limit: 3, used: 0 });
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByText('0/3 saved')).toBeTruthy());
});

test('saves a search with structured filters, not a query string', async () => {
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByLabelText('Search name')).toBeTruthy());

  fireEvent.change(screen.getByLabelText('Search name'), { target: { value: 'My search' } });
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Ottawa' } });
  fireEvent.change(screen.getByLabelText('Max price'), { target: { value: '800000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save search' }));

  await waitFor(() =>
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'My search',
      filters: { city: 'Ottawa', price_max: 800000 },
    }),
  );
});

test('at the limit, saving is blocked and the real number is shown', async () => {
  mockLimit.mockResolvedValue({ limit: 2, used: 2 });
  mockList.mockResolvedValue([search({ id: 'a' }), search({ id: 'b', name: 'Second' })]);
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByText(/up to 2 searches/)).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Search name'), { target: { value: 'Third' } });
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Ottawa' } });
  expect((screen.getByRole('button', { name: 'Save search' }) as HTMLButtonElement).disabled).toBe(true);
});

test('an inverted price range is refused before saving', async () => {
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByLabelText('Search name')).toBeTruthy());

  fireEvent.change(screen.getByLabelText('Search name'), { target: { value: 'Backwards' } });
  fireEvent.change(screen.getByLabelText('Min price'), { target: { value: '900000' } });
  fireEvent.change(screen.getByLabelText('Max price'), { target: { value: '100000' } });

  expect(screen.getByText(/Maximum price must be greater/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Save search' }) as HTMLButtonElement).disabled).toBe(true);
});

test('a saved search shows its filters in plain words', async () => {
  mockList.mockResolvedValue([search()]);
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByText('Downtown condos')).toBeTruthy());
  expect(screen.getByText(/toronto/)).toBeTruthy();
  expect(screen.getByText(/2\+ beds/)).toBeTruthy();
});

// ── The email control ────────────────────────────────────────────────────────

test('email is off by default — saving is not consent to be emailed', async () => {
  mockList.mockResolvedValue([search()]);
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByLabelText(/Email me new matches/)).toBeTruthy());
  expect((screen.getByLabelText(/Email me new matches/) as HTMLInputElement).checked).toBe(false);
});

test('turning emails on says new matches only, not the back catalogue', async () => {
  mockList.mockResolvedValue([search()]);
  mockUpdate.mockResolvedValue(search({ email_enabled: true }));
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByLabelText(/Email me new matches/)).toBeTruthy());

  fireEvent.click(screen.getByLabelText(/Email me new matches/));

  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith('s1', { email_enabled: true }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('New matches only'),
  );
});

test('pausing says the search is kept', async () => {
  // Q6: "Pause keeps the search; delete stops its alerts."
  mockList.mockResolvedValue([search({ email_enabled: true })]);
  mockUpdate.mockResolvedValue(search({ email_enabled: false }));
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByLabelText(/Email me new matches/)).toBeTruthy());

  fireEvent.click(screen.getByLabelText(/Email me new matches/));

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('The search is kept'),
  );
});

// ── Device import ────────────────────────────────────────────────────────────

test('offers to keep device searches rather than migrating silently', async () => {
  mockDevice.mockReturnValue([
    { id: 'd1', name: 'From laptop', query: 'city=Ottawa', created_at: '2026-01-01' },
  ]);
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByText(/Keep searches from this device/)).toBeTruthy());
  expect(screen.getByText(/will not turn on any emails/)).toBeTruthy();
});

test('the offer can be declined', async () => {
  mockDevice.mockReturnValue([
    { id: 'd1', name: 'From laptop', query: 'city=Ottawa', created_at: '2026-01-01' },
  ]);
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByText(/Keep searches from this device/)).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));

  expect(screen.queryByText(/Keep searches from this device/)).toBeNull();
  expect(mockImport).not.toHaveBeenCalled();
});

test('an import reports what did not fit, by name', async () => {
  // Q6: "never silently discard."
  mockDevice.mockReturnValue([
    { id: 'd1', name: 'A', query: 'city=Ottawa', created_at: '2026-01-01' },
    { id: 'd2', name: 'B', query: 'city=Kanata', created_at: '2026-01-01' },
  ]);
  mockImport.mockResolvedValue({
    imported: [search()],
    duplicates: ['A'],
    rejected: ['B'],
  });
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Keep them' })).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Keep them' }));

  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  const text = screen.getByRole('status').textContent ?? '';
  expect(text).toContain('1 kept');
  expect(text).toContain('1 already saved');
  expect(text).toContain('not enough room for: B');
});

test('no offer appears when the device has nothing', async () => {
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByText('Saved searches')).toBeTruthy());
  expect(screen.queryByText(/Keep searches from this device/)).toBeNull();
});

// ── Failures ─────────────────────────────────────────────────────────────────

test('a failed load is reported', async () => {
  mockList.mockRejectedValue(new Error('network'));
  render(<ClientSavedSearchesSection />);

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('Could not load');
});

test('a rejected save is reported and the form keeps what was typed', async () => {
  mockCreate.mockRejectedValue({
    response: { status: 409, data: { detail: 'You can save up to 5 searches.' } },
  });
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByLabelText('Search name')).toBeTruthy());

  fireEvent.change(screen.getByLabelText('Search name'), { target: { value: 'Sixth' } });
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Ottawa' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save search' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect((screen.getByLabelText('Search name') as HTMLInputElement).value).toBe('Sixth');
});

test('a search can be deleted', async () => {
  mockList.mockResolvedValue([search()]);
  render(<ClientSavedSearchesSection />);
  await waitFor(() => expect(screen.getByText('Downtown condos')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('s1'));
  await waitFor(() => expect(screen.queryByText('Downtown condos')).toBeNull());
});
