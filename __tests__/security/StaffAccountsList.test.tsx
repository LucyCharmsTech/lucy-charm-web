import { render, screen, waitFor } from '@testing-library/react';
import { StaffAccountsList } from '@/components/admin/StaffAccountsList';
import { fetchStaffAccounts } from '@/services/userService';
import type { StaffAccount } from '@/types/api';

/**
 * The staff screen — C6's *"never share privileged accounts"*, given somewhere
 * to happen.
 *
 * The reset itself was already built and tested. It had **no screen**, so the
 * only way to perform it was to call the API by hand — which left the rule
 * without a workable alternative behind it.
 */

jest.mock('@/services/userService', () => ({ fetchStaffAccounts: jest.fn() }));
jest.mock('@/services/mfaService', () => ({ resetMfaForUser: jest.fn() }));

const mockFetch = fetchStaffAccounts as jest.MockedFunction<typeof fetchStaffAccounts>;

function account(overrides: Partial<StaffAccount> = {}): StaffAccount {
  return {
    id: 'u1',
    email: 'ada@example.com',
    first_name: 'Ada',
    last_name: 'Okonkwo',
    role: 'agent',
    mfa_enabled: true,
    mfa_locked_until: null,
    deactivated_at: null,
    last_active_at: '2026-09-01T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function page(items: StaffAccount[]) {
  return { items, total: items.length, page: 1, page_size: 50 };
}

const IN_TEN_MINUTES = new Date(Date.now() + 10 * 60_000).toISOString();
const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60_000).toISOString();

beforeEach(() => jest.clearAllMocks());

test('a locked-out colleague is shown as locked, not merely protected', async () => {
  // The whole point of the screen. "Two-step is on" and "two-step is on and
  // they cannot get past it" look identical unless the lock is surfaced — and
  // the second is the only case a reset exists for.
  mockFetch.mockResolvedValue(page([account({ mfa_locked_until: IN_TEN_MINUTES })]));
  render(<StaffAccountsList />);

  await waitFor(() => expect(screen.getByText(/Locked out/)).toBeTruthy());
  expect(screen.queryByText('Two-step on')).toBeNull();
});

test('an expired lock is not treated as a lock', async () => {
  // A lock that has run out is history. Reporting it would send an
  // administrator to reset someone who can already get in.
  mockFetch.mockResolvedValue(page([account({ mfa_locked_until: TEN_MINUTES_AGO })]));
  render(<StaffAccountsList />);

  await waitFor(() => expect(screen.getByText('Two-step on')).toBeTruthy());
  expect(screen.queryByText(/Locked out/)).toBeNull();
});

test('people needing attention are listed first', async () => {
  // The list is a worklist. Alphabetical order would bury the one person who
  // cannot work behind everyone who is fine.
  mockFetch.mockResolvedValue(
    page([
      account({ id: 'a', first_name: 'Fine', last_name: 'Person' }),
      account({ id: 'b', first_name: 'Locked', last_name: 'Person', mfa_locked_until: IN_TEN_MINUTES }),
      account({ id: 'c', first_name: 'New', last_name: 'Person', mfa_enabled: false }),
    ]),
  );
  render(<StaffAccountsList />);

  await waitFor(() => screen.getByText(/Locked out/));
  const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
  expect(names).toEqual(['Locked Person', 'New Person', 'Fine Person']);
});

test('the count of accounts needing attention is stated', async () => {
  mockFetch.mockResolvedValue(
    page([
      account({ id: 'a', mfa_locked_until: IN_TEN_MINUTES }),
      account({ id: 'b', mfa_enabled: false }),
      account({ id: 'c' }),
    ]),
  );
  render(<StaffAccountsList />);

  await waitFor(() =>
    expect(screen.getByText(/2 accounts need/)).toBeTruthy(),
  );
});

test('a locked person is told a recovery code still works, before any reset', async () => {
  // A reset destroys their setup and every backup code. A recovery code works
  // immediately while the app codes are paused, so it is the cheaper answer
  // and should be tried first.
  mockFetch.mockResolvedValue(page([account({ mfa_locked_until: IN_TEN_MINUTES })]));
  render(<StaffAccountsList />);

  await waitFor(() =>
    expect(screen.getByText(/a recovery code still works right now/i)).toBeTruthy(),
  );
});

test('no reset is offered for someone who has not set two-step up', async () => {
  // There is nothing to reset. Offering a destructive action that achieves
  // nothing invites someone to try it.
  mockFetch.mockResolvedValue(page([account({ mfa_enabled: false })]));
  render(<StaffAccountsList />);

  await waitFor(() => expect(screen.getByText('Not set up')).toBeTruthy());
  expect(screen.queryByRole('button', { name: /Reset two-step/ })).toBeNull();
  expect(screen.getByText(/they complete it themselves/i)).toBeTruthy();
});

test('no reset is offered for a deactivated account', async () => {
  // Two-step is not what is stopping them signing in.
  mockFetch.mockResolvedValue(
    page([account({ deactivated_at: '2026-08-01T00:00:00Z' })]),
  );
  render(<StaffAccountsList />);

  await waitFor(() => expect(screen.getByText('Account inactive')).toBeTruthy());
  expect(screen.queryByRole('button', { name: /Reset two-step/ })).toBeNull();
});

test('a reset is offered for a locked or an enrolled account', async () => {
  mockFetch.mockResolvedValue(
    page([
      account({ id: 'a', mfa_locked_until: IN_TEN_MINUTES }),
      account({ id: 'b' }),
    ]),
  );
  render(<StaffAccountsList />);

  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: /Reset two-step/ })).toHaveLength(2),
  );
});

test('roles are shown in words, not in database values', async () => {
  mockFetch.mockResolvedValue(
    page([account({ role: 'superadmin', first_name: 'Boss', last_name: 'Person' })]),
  );
  render(<StaffAccountsList />);

  await waitFor(() => expect(screen.getByText(/Administrator/)).toBeTruthy());
  expect(document.body.textContent).not.toMatch(/superadmin/);
});

test('an empty list says so, and a failure is reported', async () => {
  mockFetch.mockResolvedValue(page([]));
  const { unmount } = render(<StaffAccountsList />);
  await waitFor(() => expect(screen.getByText(/No staff accounts yet/)).toBeTruthy());
  unmount();

  mockFetch.mockRejectedValue({ response: { data: { detail: 'Not permitted.' } } });
  render(<StaffAccountsList />);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Not permitted.'));
});
