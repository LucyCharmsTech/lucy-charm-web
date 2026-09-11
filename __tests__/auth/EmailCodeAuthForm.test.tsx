import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailCodeAuthForm } from '@/components/auth/EmailCodeAuthForm';
import { requestEmailCode, verifyEmailCode } from '@/services/authService';
import { fetchCurrentUser } from '@/services/userService';

/**
 * Email sign-in by one-time code — control 2.4, "Email uses a one-time code".
 *
 * The two-step flow is the whole feature, so most of this is about the step
 * transition and what survives it.
 */

const replace = jest.fn();
const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/services/authService', () => ({
  requestEmailCode: jest.fn(),
  verifyEmailCode: jest.fn(),
}));

jest.mock('@/services/userService', () => ({
  fetchCurrentUser: jest.fn(),
}));

jest.mock('@/lib/completeSignIn', () => ({
  completeSignIn: jest.fn().mockResolvedValue(undefined),
}));

const setAuth = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ setAuth }),
}));

const mockRequest = requestEmailCode as jest.MockedFunction<typeof requestEmailCode>;
const mockVerify = verifyEmailCode as jest.MockedFunction<typeof verifyEmailCode>;
const mockMe = fetchCurrentUser as jest.MockedFunction<typeof fetchCurrentUser>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRequest.mockResolvedValue({
    detail: 'If the email exists, a sign-in code has been sent.',
    expires_in_minutes: 10,
  });
  mockVerify.mockResolvedValue({
    access_token: 'access',
    refresh_token: 'refresh',
    token_type: 'bearer',
  });
  // A complete `UserMe`, not a cast — `userMeToAuthUser` reads several of
  // these and a partial object would pass the test while hiding a real gap.
  mockMe.mockResolvedValue({
    id: 'u1',
    email: 'buyer@example.com',
    first_name: 'Dana',
    last_name: 'Okafor',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_anonymous: false,
    last_active_at: '2026-01-01T00:00:00Z',
    role: 'client',
    onboarding_completed: true,
    onboarding_completed_at: '2026-01-01T00:00:00Z',
    deactivated_at: null,
    marketing_emails_enabled: true,
    listing_alerts_enabled: true,
    product_updates_enabled: true,
  });
});

async function requestForEmail(email = 'buyer@example.com') {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));
  await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeTruthy());
}

// ── Step 1 ───────────────────────────────────────────────────────────────────

test('asks for an email and sends a code, not a link', async () => {
  render(<EmailCodeAuthForm />);

  // The button names the code — control 2.4 forbids the link vocabulary.
  expect(screen.getByRole('button', { name: 'Send sign-in code' })).toBeTruthy();

  await requestForEmail();

  expect(mockRequest).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'buyer@example.com' }),
  );
});

test('sign-up asks for a name and sends it; sign-in does not', async () => {
  const { unmount } = render(<EmailCodeAuthForm mode="signup" />);
  expect(screen.getByLabelText('Full name')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Dana Okafor' } });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'new@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-up code' }));

  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'Dana Okafor' }),
    ),
  );
  unmount();

  render(<EmailCodeAuthForm />);
  expect(screen.queryByLabelText('Full name')).toBeNull();
});

// ── Step 2 ───────────────────────────────────────────────────────────────────

test('shows the address and the expiry it was told, not a hardcoded one', async () => {
  mockRequest.mockResolvedValue({ detail: 'sent', expires_in_minutes: 7 });
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  expect(screen.getByText('buyer@example.com')).toBeTruthy();
  expect(screen.getByText(/expires in 7 minutes/)).toBeTruthy();
});

test('the code field is set up for a phone keypad and OTP autofill', async () => {
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  const input = screen.getByLabelText('6-digit code') as HTMLInputElement;
  // `type="number"` would strip a leading zero, and "012345" is a valid code.
  expect(input.type).toBe('text');
  expect(input.inputMode).toBe('numeric');
  expect(input.autocomplete).toBe('one-time-code');
});

test('verifies the code, seats the session and routes on', async () => {
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() =>
    expect(mockVerify).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      code: '123456',
    }),
  );
  // Placeholder user first, then the real one — the established pattern.
  expect(setAuth).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(replace).toHaveBeenCalled());
});

test('a pasted code with a space is accepted and sent as digits', async () => {
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123 456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() =>
    expect(mockVerify).toHaveBeenCalledWith(
      expect.objectContaining({ code: '123456' }),
    ),
  );
});

test('Continue stays disabled until six digits are present', async () => {
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  const button = () => screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
  expect(button().disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '12345' } });
  expect(button().disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
  expect(button().disabled).toBe(false);
});

// ── Failure and recovery ─────────────────────────────────────────────────────

test('a rejected code is reported and cleared, and the form stays usable', async () => {
  mockVerify.mockRejectedValue({
    response: { status: 401, data: { detail: 'That code is not valid or has expired.' } },
  });
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('not valid');
  // Cleared: a rejected code is never right on a second submit.
  expect((screen.getByLabelText('6-digit code') as HTMLInputElement).value).toBe('');
  expect(setAuth).not.toHaveBeenCalled();
});

test('the attempt limit reaches the user as its own message', async () => {
  mockVerify.mockRejectedValue({
    response: {
      status: 429,
      data: { detail: 'Too many incorrect attempts. Please request a new code.' },
    },
  });
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('request a new code'),
  );
});

test('a new code can be requested, and the stale one is cleared', async () => {
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '111111' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));

  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  expect(screen.getByRole('status').textContent).toContain('new code');
  // The server retires the previous code, so holding it would mislead.
  expect((screen.getByLabelText('6-digit code') as HTMLInputElement).value).toBe('');
  expect(mockRequest).toHaveBeenCalledTimes(2);
});

test('the user can go back and correct a mistyped address', async () => {
  render(<EmailCodeAuthForm />);
  await requestForEmail('wrong@example.com');

  fireEvent.click(screen.getByRole('button', { name: /Use a different email/ }));

  expect(screen.getByLabelText('Email address')).toBeTruthy();
  expect(screen.queryByLabelText('6-digit code')).toBeNull();
});

test('a failure to send is reported and does not advance the step', async () => {
  mockRequest.mockRejectedValue(new Error('network'));
  render(<EmailCodeAuthForm />);

  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'buyer@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.queryByLabelText('6-digit code')).toBeNull();
  // The address is preserved so it need not be retyped.
  expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe(
    'buyer@example.com',
  );
});

// ── The field holds six digits, because the code is six digits ───────────────

test('the code field caps at six digits', async () => {
  // It was `maxLength={7}`, which let someone type a seventh digit. The submit
  // button then stayed disabled with nothing on screen explaining why.
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  const input = screen.getByLabelText('6-digit code') as HTMLInputElement;
  expect(input.maxLength).toBe(6);

  fireEvent.change(input, { target: { value: '1234567' } });
  expect(input.value).toBe('123456');
});

test('letters typed into the code field are discarded', async () => {
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  const input = screen.getByLabelText('6-digit code') as HTMLInputElement;
  fireEvent.change(input, { target: { value: '12a34b' } });
  expect(input.value).toBe('1234');
});

// ── What the screen claims after a code is requested ────────────────────────

test('an address with no account never reaches the code screen', async () => {
  /*
   * Client instruction, 11 September 2026. The API answers 404, and the form
   * must stay where it is: advancing would ask for a code that was never sent,
   * leaving the person to wait for mail that is not coming.
   */
  mockRequest.mockRejectedValueOnce({
    response: { status: 404, data: { detail: 'No account was found for that email address.' } },
  });

  render(<EmailCodeAuthForm />);
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'nobody@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));

  await waitFor(() =>
    expect(screen.getByText('No account was found for that email address.')).toBeTruthy(),
  );

  // Still on step 1 — the code field must not exist.
  expect(screen.queryByLabelText('6-digit code')).toBeNull();

  const register = screen.getByRole('link', { name: 'create an account' });
  expect(register.getAttribute('href')).toBe('/register');
});

test('an unrelated failure does not suggest registering', async () => {
  // The offer to register answers exactly one cause. A rate limit or an outage
  // is not it, and telling someone to sign up again would be nonsense.
  mockRequest.mockRejectedValueOnce({
    response: { status: 429, data: { detail: 'Too many requests.' } },
  });

  render(<EmailCodeAuthForm />);
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'buyer@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send sign-in code' }));

  await waitFor(() => expect(screen.getByText('Too many requests.')).toBeTruthy());
  expect(screen.queryByRole('link', { name: 'create an account' })).toBeNull();
});

test('reaching the code screen states plainly that a code was sent', async () => {
  // True on both paths now: sign-up has just created the account, and sign-in
  // for a non-existent one is refused before this screen.
  render(<EmailCodeAuthForm />);
  await requestForEmail();

  expect(screen.getByText(/We sent a 6-digit code/)).toBeTruthy();
  expect(screen.queryByText(/If an account exists/)).toBeNull();
});
