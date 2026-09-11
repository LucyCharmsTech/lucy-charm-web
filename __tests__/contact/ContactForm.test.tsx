import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContactForm } from '@/components/contact/ContactForm';
import { submitContactForm } from '@/services/leadCaptureService';

/**
 * Control 2.9 requires every form to have "validation, loading, success,
 * duplicate and recoverable error states" and to "preserve entered information
 * after a retryable failure". Before this work the endpoint could not fail and
 * returned no reference, so the form had neither branch to render.
 */

jest.mock('@/services/leadCaptureService', () => {
  const actual = jest.requireActual('@/services/leadCaptureService');
  return { ...actual, submitContactForm: jest.fn() };
});

const mockSubmit = submitContactForm as jest.MockedFunction<typeof submitContactForm>;

function fillIn({ topic }: { topic?: string } = {}) {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Dana' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Okafor' } });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'dana.okafor@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'I would like to know more about buying in Ottawa.' },
  });
  if (topic) {
    fireEvent.change(screen.getByLabelText('What is your message about?'), {
      target: { value: topic },
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSubmit.mockResolvedValue({ status: 'received', reference: 'LC-8D6BA960F1DE', is_new: true });
});

test('offers exactly the four topics the client specified', () => {
  render(<ContactForm />);

  const select = screen.getByLabelText('What is your message about?') as HTMLSelectElement;
  expect(Array.from(select.options).map((o) => o.value)).toEqual([
    'Buying',
    'Selling/Home Value',
    'Existing request',
    'General question',
  ]);
});

test('name, email, topic and message are required; phone is not', () => {
  render(<ContactForm />);

  expect((screen.getByLabelText('First name') as HTMLInputElement).required).toBe(true);
  expect((screen.getByLabelText('Last name') as HTMLInputElement).required).toBe(true);
  expect((screen.getByLabelText('Email address') as HTMLInputElement).required).toBe(true);
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).required).toBe(true);
  expect(
    (screen.getByLabelText('What is your message about?') as HTMLSelectElement).required,
  ).toBe(true);
  expect((screen.getByLabelText(/Phone number/) as HTMLInputElement).required).toBe(false);
});

test('shows the reference returned by the API on success', async () => {
  render(<ContactForm />);
  fillIn();

  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  await waitFor(() =>
    expect(screen.getByText('Your message has been received')).toBeTruthy(),
  );
  // The reference exists only because the record is saved before we answer.
  expect(screen.getByText('LC-8D6BA960F1DE')).toBeTruthy();
  expect(screen.getByText(/quote this/)).toBeTruthy();
});

test('a seller topic is captured as a seller, not a buyer', async () => {
  render(<ContactForm />);
  fillIn({ topic: 'Selling/Home Value' });

  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  await waitFor(() =>
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Selling/Home Value', lead_type: 'seller' }),
    ),
  );
});

test('an omitted phone number is sent as null rather than an empty string', async () => {
  render(<ContactForm />);
  fillIn();

  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  await waitFor(() =>
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ phone: null })),
  );
});

test('a duplicate submission says so instead of implying a second request', async () => {
  mockSubmit.mockResolvedValue({
    status: 'received',
    reference: 'LC-8D6BA960F1DE',
    is_new: false,
  });
  render(<ContactForm />);
  fillIn();

  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  await waitFor(() => expect(screen.getByText('We already have this message')).toBeTruthy());
  expect(screen.getByText(/not opened a second request/)).toBeTruthy();
  // Still the original reference.
  expect(screen.getByText('LC-8D6BA960F1DE')).toBeTruthy();
});

test('a failure reports the error and keeps every field the visitor typed', async () => {
  mockSubmit.mockRejectedValue({
    response: {
      status: 503,
      data: { detail: 'We could not save your message just now.' },
    },
  });
  render(<ContactForm />);
  fillIn();

  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('could not save your message');
  // No silent lead loss: nothing has to be retyped (2.9, 2.10).
  expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Dana');
  expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain(
    'buying in Ottawa',
  );
  // And the form is still submittable for the retry.
  expect(
    (screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled,
  ).toBe(false);
});

test('the button reports the in-flight state and blocks a second click', async () => {
  let release: (v: { status: string; reference: string; is_new: boolean }) => void = () => {};
  mockSubmit.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  render(<ContactForm />);
  fillIn();

  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: /Sending/ }) as HTMLButtonElement).disabled,
    ).toBe(true),
  );

  release({ status: 'received', reference: 'LC-AAAABBBBCCCC', is_new: true });
  await waitFor(() => expect(screen.getByText('LC-AAAABBBBCCCC')).toBeTruthy());
  expect(mockSubmit).toHaveBeenCalledTimes(1);
});
