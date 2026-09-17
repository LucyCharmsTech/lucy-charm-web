import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeValueForm } from '@/components/homeValue/HomeValueForm';
import { submitHomeValueRequest } from '@/services/homeValueService';
import { loadHomeValueDraft } from '@/lib/homeValueDraft';

/**
 * Home Value intake — plan item 4.2, from Hamed's specification.
 *
 * Most of these test **prohibitions**, because a prohibition is the kind of
 * requirement that is easy to satisfy today and quietly lose later: nothing
 * visibly breaks when one is violated, so only a test notices.
 */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/services/homeValueService', () => ({
  submitHomeValueRequest: jest.fn(),
}));

jest.mock('@/components/auth/GoogleAuthButton', () => ({
  GoogleLoginButton: () => <button type="button">Continue with Google</button>,
}));

jest.mock('@/components/auth/EmailCodeAuthForm', () => ({
  EmailCodeAuthForm: () => <div>Email sign-in</div>,
}));

let mockToken: string | null = null;
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ accessToken: mockToken, user: null, setAuth: jest.fn() }),
}));

const mockSubmit = submitHomeValueRequest as jest.MockedFunction<
  typeof submitHomeValueRequest
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = null;
  sessionStorage.clear();
  mockSubmit.mockResolvedValue({
    id: 'r1',
    status: 'submitted',
  } as Awaited<ReturnType<typeof submitHomeValueRequest>>);
});

function fillRequired() {
  fireEvent.change(screen.getByLabelText(/Property address/), {
    target: { value: '12 Elm Street' },
  });
  fireEvent.change(screen.getByLabelText(/Your name/), {
    target: { value: 'Dana Okafor' },
  });
  fireEvent.change(screen.getByLabelText(/relationship to this property/), {
    target: { value: 'owner' },
  });
  fireEvent.change(screen.getByLabelText(/represented by another brokerage/), {
    target: { value: 'not_sure' },
  });
}

// ── The prohibitions ─────────────────────────────────────────────────────────

test('the form does not ask for ID or financial documents', () => {
  // Hamed: "Do not request ID or financial documents in this initial form."
  // Checked against what is actually rendered, because that is what a person
  // is asked for. The column-level check lives in the API tests.
  render(<HomeValueForm />);

  expect(document.querySelector('input[type="file"]')).toBeNull();
  for (const word of [
    /passport/i,
    /driver.s licen/i,
    /proof of funds/i,
    /bank statement/i,
    /income/i,
    /mortgage statement/i,
    /credit/i,
    /social insurance/i,
    /upload/i,
  ]) {
    expect(screen.queryByText(word)).toBeNull();
  }
});

test('the page promises no response time', () => {
  // Hamed: "No fixed response-time promise." The natural line to write here —
  // "we'll be in touch within 24 hours" — binds the brokerage to a timeframe
  // nobody agreed to.
  render(<HomeValueForm />);
  const text = document.body.textContent ?? '';

  for (const promise of [
    /24 hours/i,
    /48 hours/i,
    /business day/i,
    /same day/i,
    /within a day/i,
    /shortly/i,
  ]) {
    expect(text).not.toMatch(promise);
  }
});

test('no valuation figure appears anywhere on the form', () => {
  // "Not an instant public valuation number." The form must never look like
  // it is about to produce one.
  render(<HomeValueForm />);
  expect(document.body.textContent).not.toMatch(/\$[\d,]/);
});

// ── "Not sure" ───────────────────────────────────────────────────────────────

test('every optional property fact can be answered "Not sure"', () => {
  // Hamed: "Provide 'Not sure' for uncertain property facts."
  render(<HomeValueForm />);

  for (const label of [
    /Not sure about bedrooms/i,
    /Not sure about bathrooms/i,
    /Not sure about parking spaces/i,
    /Not sure about approximate size/i,
    /Not sure about property type/i,
    /Not sure about condition/i,
  ]) {
    expect(screen.getByLabelText(label)).toBeTruthy();
  }
});

test('"Not sure" clears and disables the field rather than leaving a value', () => {
  // A field saying both "3" and "not sure" would have to be resolved by
  // whoever reads it.
  render(<HomeValueForm />);

  const beds = screen.getByLabelText('Bedrooms') as HTMLInputElement;
  fireEvent.change(beds, { target: { value: '3' } });
  expect(beds.value).toBe('3');

  fireEvent.click(screen.getByLabelText(/Not sure about bedrooms/i));

  expect(beds.value).toBe('');
  expect(beds.disabled).toBe(true);
});

test('"represented elsewhere" offers Not sure as a real answer', () => {
  // Many sellers genuinely do not know whether a listing agreement is still
  // running, and this is the one question where a guess has consequences.
  render(<HomeValueForm />);
  const select = screen.getByLabelText(
    /represented by another brokerage/,
  ) as HTMLSelectElement;
  const values = Array.from(select.options).map((option) => option.value);

  expect(values).toContain('yes');
  expect(values).toContain('no');
  expect(values).toContain('not_sure');
});

// ── Sign-in at submission, preserving entered fields ─────────────────────────

test('an anonymous visitor can fill the whole form before being asked to sign in', () => {
  // "Public page and form start open." Asking for an account before someone
  // has seen what they are filling in is how a form gets abandoned on its
  // first screen.
  render(<HomeValueForm />);

  expect(screen.getByLabelText(/Property address/)).toBeTruthy();
  expect(screen.queryByText(/Sign in to send/)).toBeNull();
});

test('sign-in is asked for only at submission, and says the entries are kept', () => {
  render(<HomeValueForm />);
  fillRequired();
  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));

  expect(screen.getByText(/Sign in to send your request/)).toBeTruthy();
  // The question people actually have at this point.
  expect(screen.getByText(/Everything you have entered is saved/)).toBeTruthy();
});

test('the entered fields survive the sign-in step', () => {
  // The whole point of "preserving entered fields": a person who has just
  // typed out their address, renovations and timeline does not fill it in
  // again.
  render(<HomeValueForm />);
  fillRequired();
  fireEvent.change(screen.getByLabelText(/Renovations/), {
    target: { value: 'New roof in 2024' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));
  fireEvent.click(screen.getByRole('button', { name: /Back to the form/ }));

  expect(
    (screen.getByLabelText(/Property address/) as HTMLInputElement).value,
  ).toBe('12 Elm Street');
  expect((screen.getByLabelText(/Renovations/) as HTMLTextAreaElement).value).toBe(
    'New roof in 2024',
  );
});

test('the draft is written to storage so a reload does not lose it', () => {
  // React state alone nearly does this. "Nearly" is the problem — a Google
  // popup that redirects, a session restore, a stray back-button.
  render(<HomeValueForm />);
  fillRequired();

  expect(loadHomeValueDraft()?.address).toBe('12 Elm Street');
});

test('a signed-in person goes straight to the confirmation', () => {
  mockToken = 'token';
  render(<HomeValueForm />);
  fillRequired();
  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));

  expect(screen.getByText(/Send your Home Value request/)).toBeTruthy();
  expect(screen.queryByText(/Sign in to send/)).toBeNull();
});

test('incomplete required fields do not advance', () => {
  render(<HomeValueForm />);
  fireEvent.change(screen.getByLabelText(/Property address/), {
    target: { value: '12 Elm Street' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));

  expect(screen.getByRole('alert').textContent).toMatch(/required fields/i);
  expect(screen.queryByText(/Sign in to send/)).toBeNull();
});

// ── Confirmation ─────────────────────────────────────────────────────────────

test('the confirmation states that a person prepares the report and no date is given', async () => {
  mockToken = 'token';
  render(<HomeValueForm />);
  fillRequired();
  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));

  // Both of Hamed's constraints, rendered as something the person can read.
  expect(screen.getByText(/A person prepares this report/)).toBeTruthy();
  expect(screen.getByText(/not commit to a date/)).toBeTruthy();
});

test('a successful submission clears the stored draft', async () => {
  // A property's details should not sit in browser storage on a shared
  // machine any longer than the task needs.
  mockToken = 'token';
  render(<HomeValueForm />);
  fillRequired();
  expect(loadHomeValueDraft()).not.toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
  await waitFor(() => expect(loadHomeValueDraft()).toBeNull());
});

test('a failed submission keeps the draft so nothing is retyped', async () => {
  mockToken = 'token';
  mockSubmit.mockRejectedValue({ response: { data: { detail: 'Server error' } } });
  render(<HomeValueForm />);
  fillRequired();
  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  await waitFor(() => expect(screen.getByText(/Status: not sent/)).toBeTruthy());
  expect(loadHomeValueDraft()?.address).toBe('12 Elm Street');
});
