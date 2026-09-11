import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MfaEnrolment } from '@/components/security/MfaEnrolment';
import {
  disableMfa,
  enableMfa,
  fetchMfaStatus,
  regenerateRecoveryCodes,
  startMfaSetup,
} from '@/services/mfaService';

/**
 * The enrolment screen — control 1.13 / C6's *"missing enrolment screen"*.
 *
 * Before this existed, turning MFA on meant running a script against
 * production. The machinery was complete and protected nobody, which is the
 * shape of failure these tests are guarding against: something that is present
 * but unreachable.
 */

jest.mock('@/services/mfaService', () => ({
  fetchMfaStatus: jest.fn(),
  startMfaSetup: jest.fn(),
  enableMfa: jest.fn(),
  disableMfa: jest.fn(),
  regenerateRecoveryCodes: jest.fn(),
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,zz') },
}));

const mockStatus = fetchMfaStatus as jest.MockedFunction<typeof fetchMfaStatus>;
const mockSetup = startMfaSetup as jest.MockedFunction<typeof startMfaSetup>;
const mockEnable = enableMfa as jest.MockedFunction<typeof enableMfa>;
const mockDisable = disableMfa as jest.MockedFunction<typeof disableMfa>;
const mockRegenerate = regenerateRecoveryCodes as jest.MockedFunction<
  typeof regenerateRecoveryCodes
>;

const CODES = Array.from({ length: 10 }, (_, i) => `code${i}-abcdef1234`);

function statusOf(overrides: Partial<Awaited<ReturnType<typeof fetchMfaStatus>>> = {}) {
  return {
    enabled: false,
    required: false,
    state: 'not_required' as const,
    enrolled_at: null,
    recovery_codes_remaining: 0,
    locked: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus.mockResolvedValue(statusOf());
  mockSetup.mockResolvedValue({
    totp_uri: 'otpauth://totp/Lucy%20Charms:a@b.c?secret=SEED',
    secret: 'SEEDSEEDSEEDSEED',
  });
  mockEnable.mockResolvedValue({ recovery_codes: CODES });
  mockRegenerate.mockResolvedValue({ recovery_codes: CODES });
  mockDisable.mockResolvedValue(undefined);
});

// ── The three resting states ────────────────────────────────────────────────

test('a staff account that has not enrolled is told it is required', async () => {
  mockStatus.mockResolvedValue(
    statusOf({ required: true, state: 'enrolment_required' }),
  );
  render(<MfaEnrolment />);

  await waitFor(() =>
    expect(screen.getByText(/this is required/i)).toBeTruthy(),
  );
});

test('an optional account is offered it rather than told to do it', async () => {
  // "Required and off" and "optional and off" are not the same message: one is
  // a task blocking their work, the other is an offer.
  render(<MfaEnrolment />);

  await waitFor(() => expect(screen.getByText(/Add a second step/i)).toBeTruthy());
  expect(screen.queryByText(/this is required/i)).toBeNull();
});

test('an enrolled account sees how many recovery codes are left', async () => {
  mockStatus.mockResolvedValue(
    statusOf({ enabled: true, state: 'satisfied', recovery_codes_remaining: 7 }),
  );
  render(<MfaEnrolment />);

  await waitFor(() => expect(screen.getByText('7')).toBeTruthy());
});

// ── Setup ───────────────────────────────────────────────────────────────────

test('setup shows a QR and the seed in text, then enables with the first code', async () => {
  render(<MfaEnrolment />);
  await waitFor(() => screen.getByRole('button', { name: /Set up/ }));

  fireEvent.click(screen.getByRole('button', { name: /Set up/ }));

  await waitFor(() => expect(screen.getByAltText(/QR code/i)).toBeTruthy());
  // The plain seed matters: someone enrolling on the same device as their
  // password manager has no second camera to point at their own screen.
  expect(screen.getByText('SEEDSEEDSEEDSEED')).toBeTruthy();

  fireEvent.change(screen.getByLabelText(/6-digit code your app shows/i), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));

  await waitFor(() =>
    expect(mockEnable).toHaveBeenCalledWith('SEEDSEEDSEEDSEED', '123456'),
  );
});

test('the recovery codes are shown immediately after enabling', async () => {
  // Issued during setup rather than on a later opt-in screen: an optional
  // final step is a step most people skip, and a second factor with no
  // recovery path is one lost phone from a manual database edit.
  render(<MfaEnrolment />);
  await waitFor(() => screen.getByRole('button', { name: /Set up/ }));
  fireEvent.click(screen.getByRole('button', { name: /Set up/ }));
  await waitFor(() => screen.getByLabelText(/6-digit code your app shows/i));
  fireEvent.change(screen.getByLabelText(/6-digit code your app shows/i), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));

  await waitFor(() => expect(screen.getByText(CODES[0])).toBeTruthy());
  expect(screen.getAllByText(/shown once/i).length).toBeGreaterThan(0);
});

test('a failed confirmation does not leave the wrong code in the box', async () => {
  mockEnable.mockRejectedValue({
    response: { data: { detail: 'That code did not match.' } },
  });
  render(<MfaEnrolment />);
  await waitFor(() => screen.getByRole('button', { name: /Set up/ }));
  fireEvent.click(screen.getByRole('button', { name: /Set up/ }));
  await waitFor(() => screen.getByLabelText(/6-digit code your app shows/i));

  const input = screen.getByLabelText(
    /6-digit code your app shows/i,
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(input.value).toBe('');
});

// ── Revocation and regeneration both need a live code ───────────────────────

test('turning it off asks for a code, not just a session', async () => {
  // A session can be borrowed. If a borrowed one could remove the second
  // factor, the factor would protect the login screen and nothing after it.
  mockStatus.mockResolvedValue(
    statusOf({ enabled: true, state: 'satisfied', recovery_codes_remaining: 9 }),
  );
  render(<MfaEnrolment />);
  await waitFor(() => screen.getByRole('button', { name: 'Turn off' }));

  fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
  await waitFor(() => screen.getByLabelText('6-digit code'));

  const submit = screen.getByRole('button', { name: 'Turn off' }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText('6-digit code'), {
    target: { value: '654321' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));

  await waitFor(() => expect(mockDisable).toHaveBeenCalledWith('654321'));
});

test('a staff member is warned that turning it off does not opt them out', async () => {
  mockStatus.mockResolvedValue(
    statusOf({
      enabled: true,
      required: true,
      state: 'satisfied',
      recovery_codes_remaining: 9,
    }),
  );
  render(<MfaEnrolment />);
  await waitFor(() => screen.getByRole('button', { name: 'Turn off' }));
  fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));

  await waitFor(() =>
    expect(screen.getByText(/set it up again/i)).toBeTruthy(),
  );
});

test('regenerating needs a live code and warns the old set has stopped working', async () => {
  mockStatus.mockResolvedValue(
    statusOf({ enabled: true, state: 'satisfied', recovery_codes_remaining: 3 }),
  );
  render(<MfaEnrolment />);
  await waitFor(() => screen.getByLabelText(/Enter a code from your app/i));

  fireEvent.change(screen.getByLabelText(/Enter a code from your app/i), {
    target: { value: '112233' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'New recovery codes' }));

  await waitFor(() => expect(mockRegenerate).toHaveBeenCalledWith('112233'));
  await waitFor(() =>
    expect(screen.getByText(/previous codes stopped working/i)).toBeTruthy(),
  );
});

test('running low on recovery codes is raised, not left as a small number', async () => {
  // Someone at one code left is one lost phone from a support ticket, and
  // will not notice a digit in a list.
  mockStatus.mockResolvedValue(
    statusOf({ enabled: true, state: 'satisfied', recovery_codes_remaining: 1 }),
  );
  render(<MfaEnrolment />);

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toMatch(/nearly out/i),
  );
});

test('a locked account is told a recovery code still works', async () => {
  mockStatus.mockResolvedValue(
    statusOf({
      enabled: true,
      state: 'satisfied',
      recovery_codes_remaining: 5,
      locked: true,
    }),
  );
  render(<MfaEnrolment />);

  await waitFor(() =>
    expect(
      screen.getAllByRole('alert').some((el) => /recovery code still works/i.test(el.textContent ?? '')),
    ).toBe(true),
  );
});
