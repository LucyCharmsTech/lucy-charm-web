import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MfaAdminReset } from '@/components/security/MfaAdminReset';
import { resetMfaForUser } from '@/services/mfaService';

/**
 * C6's *"never share privileged accounts"*, made possible rather than merely
 * instructed.
 */

jest.mock('@/services/mfaService', () => ({ resetMfaForUser: jest.fn() }));
const mockReset = resetMfaForUser as jest.MockedFunction<typeof resetMfaForUser>;

beforeEach(() => {
  jest.clearAllMocks();
  mockReset.mockResolvedValue(undefined);
});

test('it says why it exists, so nobody reaches for a shared login instead', () => {
  render(<MfaAdminReset userId="u1" userLabel="Ada Okonkwo" />);
  expect(screen.getByText(/nobody has to share a sign-in/i)).toBeTruthy();
});

test('one click does not reset anything', () => {
  // The most powerful action on the admin surface: done to the wrong account
  // it strips protection from a colleague who has no idea.
  render(<MfaAdminReset userId="u1" userLabel="Ada Okonkwo" />);
  fireEvent.click(screen.getByRole('button', { name: /Reset two-step/ }));

  expect(mockReset).not.toHaveBeenCalled();
  expect(screen.getByText(/Clear two-step verification for Ada Okonkwo\?/)).toBeTruthy();
});

test('the confirmation names the person and every consequence', () => {
  // A reset is irreversible from here — the codes and the secret are
  // destroyed, not disabled.
  render(<MfaAdminReset userId="u1" userLabel="Ada Okonkwo" />);
  fireEvent.click(screen.getByRole('button', { name: /Reset two-step/ }));

  const text = document.body.textContent ?? '';
  expect(text).toMatch(/Ada Okonkwo/);
  expect(text).toMatch(/destroyed/i);
  expect(text).toMatch(/signed out everywhere/i);
  expect(text).toMatch(/recorded against your name/i);
});

test('confirming resets and reports what happens next', async () => {
  const onReset = jest.fn();
  render(<MfaAdminReset userId="u1" userLabel="Ada Okonkwo" onReset={onReset} />);
  fireEvent.click(screen.getByRole('button', { name: /Reset two-step/ }));
  fireEvent.click(screen.getByRole('button', { name: /Yes, clear it/ }));

  await waitFor(() => expect(mockReset).toHaveBeenCalledWith('u1'));
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  expect(screen.getByText(/must set it up again/i)).toBeTruthy();
  expect(onReset).toHaveBeenCalled();
});

test('cancelling resets nothing', () => {
  render(<MfaAdminReset userId="u1" userLabel="Ada Okonkwo" />);
  fireEvent.click(screen.getByRole('button', { name: /Reset two-step/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(mockReset).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /Reset two-step/ })).toBeTruthy();
});

test("the server's refusal is shown, not swallowed", async () => {
  // The server refuses a self-reset, and the reason is the useful part.
  mockReset.mockRejectedValue({
    response: { data: { detail: 'Use the turn-off action for your own account.' } },
  });
  render(<MfaAdminReset userId="u1" userLabel="Ada Okonkwo" />);
  fireEvent.click(screen.getByRole('button', { name: /Reset two-step/ }));
  fireEvent.click(screen.getByRole('button', { name: /Yes, clear it/ }));

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toMatch(/turn-off action/),
  );
});
