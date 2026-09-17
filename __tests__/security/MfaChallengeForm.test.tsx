import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm';
import { verifyMfa, verifyMfaRecoveryCode } from '@/services/mfaService';

/**
 * The second step of sign-in — control 1.13 / C6.
 *
 * One component for every first factor, because the challenge is identical
 * whatever proved the first one. These tests are mostly about the recovery
 * route: it is the half people reach on their worst day, and the half most
 * likely to be built and never tried.
 */

jest.mock('@/services/mfaService', () => ({
  verifyMfa: jest.fn(),
  verifyMfaRecoveryCode: jest.fn(),
}));

const mockVerify = verifyMfa as jest.MockedFunction<typeof verifyMfa>;
const mockRecovery = verifyMfaRecoveryCode as jest.MockedFunction<
  typeof verifyMfaRecoveryCode
>;

const TOKENS = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'bearer',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockResolvedValue(TOKENS);
  mockRecovery.mockResolvedValue(TOKENS);
});

test('a six-digit code is sent with the challenge and the session handed back', async () => {
  const onVerified = jest.fn();
  render(<MfaChallengeForm challengeToken="chal-1" onVerified={onVerified} />);

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

  await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('chal-1', '123456'));
  expect(onVerified).toHaveBeenCalledWith(TOKENS);
});

test('the button stays disabled until six digits are present', () => {
  render(<MfaChallengeForm challengeToken="chal-1" onVerified={jest.fn()} />);

  const submit = screen.getByRole('button', { name: 'Verify and continue' });
  expect((submit as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '12345' },
  });
  expect((submit as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '123456' },
  });
  expect((submit as HTMLButtonElement).disabled).toBe(false);
});

test('a pasted code with separators still counts as six digits', () => {
  // Authenticator apps display "123 456"; people copy what they see.
  render(<MfaChallengeForm challengeToken="chal-1" onVerified={jest.fn()} />);

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '123 456' },
  });
  expect(
    (screen.getByRole('button', { name: 'Verify and continue' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

test('a rejected code is cleared rather than left to be resubmitted', async () => {
  mockVerify.mockRejectedValue({
    response: { data: { detail: 'That code was not correct. Please try again.' } },
  });
  render(<MfaChallengeForm challengeToken="chal-1" onVerified={jest.fn()} />);

  const input = screen.getByLabelText('6-digit code') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('not correct'),
  );
  // A rejected code is never right on a second submit.
  expect(input.value).toBe('');
});

test('the recovery route is reachable and sends the code, not an OTP', async () => {
  const onVerified = jest.fn();
  render(<MfaChallengeForm challengeToken="chal-1" onVerified={onVerified} />);

  fireEvent.click(screen.getByRole('button', { name: /can't use my app/i }));

  fireEvent.change(screen.getByLabelText('Recovery code'), {
    target: { value: 'abcd012345-6789abcdef' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

  await waitFor(() =>
    expect(mockRecovery).toHaveBeenCalledWith('chal-1', 'abcd012345-6789abcdef'),
  );
  // The OTP endpoint must not also be called — a recovery code sent there
  // would just fail, and would look to the user like the code was wrong.
  expect(mockVerify).not.toHaveBeenCalled();
  expect(onVerified).toHaveBeenCalledWith(TOKENS);
});

test('switching to recovery clears what was typed for the app', () => {
  // Six digits are never a recovery code; carrying them across would arm the
  // submit button with a value that cannot work.
  render(<MfaChallengeForm challengeToken="chal-1" onVerified={jest.fn()} />);

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: /can't use my app/i }));

  expect((screen.getByLabelText('Recovery code') as HTMLInputElement).value).toBe('');
});

test('the recovery screen says what to do when the codes are gone', () => {
  // Without this, the honest answer a user reaches for is "borrow a
  // colleague's login" — which is exactly what C6 forbids.
  render(<MfaChallengeForm challengeToken="chal-1" onVerified={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /can't use my app/i }));

  expect(screen.getByText(/administrator can reset/i)).toBeTruthy();
});
