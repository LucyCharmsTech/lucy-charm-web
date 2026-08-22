import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AccountDataSection from '@/components/profile/AccountDataSection';
import { deleteCurrentAccount } from '@/services/userService';

const mockClearAuth = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { clearAuth: () => void }) => unknown) =>
    selector({ clearAuth: mockClearAuth }),
}));

jest.mock('@/services/userService', () => ({
  deactivateCurrentAccount: jest.fn(),
  deleteCurrentAccount: jest.fn(),
  exportCurrentUserData: jest.fn(),
  submitDataRequest: jest.fn(),
}));

const mockDeleteCurrentAccount = deleteCurrentAccount as jest.MockedFunction<typeof deleteCurrentAccount>;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteCurrentAccount.mockResolvedValue({
    detail: 'Your account has been scheduled for deletion and all sessions revoked.',
    deleted_at: '2026-08-22T00:00:00Z',
  });
});

test('requires an explicit confirmation before soft-deleting the account', async () => {
  render(<AccountDataSection />);

  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });

  expect(dialog).toBeTruthy();
  expect(mockDeleteCurrentAccount).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep account' }));
  expect(screen.queryByRole('dialog', { name: 'Delete your account?' })).toBeNull();
  expect(mockDeleteCurrentAccount).not.toHaveBeenCalled();
});

test('soft-deletes the account, clears local auth, and redirects home', async () => {
  render(<AccountDataSection />);

  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
  fireEvent.click(
    within(screen.getByRole('dialog', { name: 'Delete your account?' })).getByRole('button', {
      name: 'Delete account',
    }),
  );

  await waitFor(() => expect(mockDeleteCurrentAccount).toHaveBeenCalledTimes(1));
  expect(mockClearAuth).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/');
});
