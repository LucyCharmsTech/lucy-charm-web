import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountRecoveryForm from '@/components/auth/AccountRecoveryForm';
import { requestAccountRecovery } from '@/services/authService';

jest.mock('@/services/authService', () => ({
  requestAccountRecovery: jest.fn(),
}));

const mockRequestAccountRecovery = requestAccountRecovery as jest.MockedFunction<
  typeof requestAccountRecovery
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestAccountRecovery.mockResolvedValue({
    detail: 'If the account is eligible, a recovery link has been sent.',
  });
});

test('requests recovery by email and shows a generic success message', async () => {
  render(<AccountRecoveryForm />);

  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'deleted@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send recovery link' }));

  await waitFor(() =>
    expect(mockRequestAccountRecovery).toHaveBeenCalledWith({
      email: 'deleted@example.com',
    }),
  );
  expect(screen.getByText(/If your account is eligible/)).toBeTruthy();
});
