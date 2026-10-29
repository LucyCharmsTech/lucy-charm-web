import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffShowingAccessPolicy from '@/components/seller/StaffShowingAccessPolicy';
import { getShowingAccessPolicy, updateShowingAccessPolicy } from '@/services/sellerBuyerShowingService';

jest.mock('@/services/sellerBuyerShowingService', () => ({
  getShowingAccessPolicy: jest.fn(), updateShowingAccessPolicy: jest.fn(),
  buyerShowingError: (error: unknown) => (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Error',
}));

const getPolicy = getShowingAccessPolicy as jest.MockedFunction<typeof getShowingAccessPolicy>;
const update = updateShowingAccessPolicy as jest.MockedFunction<typeof updateShowingAccessPolicy>;

beforeEach(() => {
  jest.clearAllMocks();
  getPolicy.mockResolvedValue({ policy: 'unset', revision: 0 });
});

test('Super Admin must choose an explicit policy and audit reason', async () => {
  update.mockResolvedValue({ policy: 'required', revision: 1 });
  render(<StaffShowingAccessPolicy transactionId="transaction-1" />);
  await screen.findByText(/Current: unset/);
  expect((screen.getByRole('button', { name: 'Save policy' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Access approval'), { target: { value: 'required' } });
  fireEvent.change(screen.getByLabelText('Audit reason'), { target: { value: 'Seller access needed' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith('transaction-1', {
    policy: 'required', expected_revision: 0, reason: 'Seller access needed',
  }));
  expect(await screen.findByText(/Current: required/)).toBeTruthy();
});
