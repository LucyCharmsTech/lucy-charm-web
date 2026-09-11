import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConfirmSubmission } from '@/components/common/ConfirmSubmission';

/**
 * Control 4.10 — *"Before consequential submission, summarize what will happen
 * and request confirmation… **Report actual backend status, not assumed
 * success**."*
 *
 * The second half is the one usually missed. The tempting implementation is
 * "request resolved, show Confirmed!" — which here would be a lie of exactly
 * the kind C5 warns about, and produces a person standing outside a house at
 * 2pm.
 */

const SUMMARY = [
  'We will ask the agent for a viewing of 12 Elm Street.',
  'Your name and email will be shared with the agent.',
  'This is a request, not a booking. Nothing is confirmed until the agent replies.',
];

function renderConfirm(onConfirm = jest.fn(), onBack = jest.fn()) {
  render(
    <ConfirmSubmission
      title="Request this showing"
      summary={SUMMARY}
      confirmLabel="Send request"
      onConfirm={onConfirm}
      onBack={onBack}
    />,
  );
}

test('nothing is sent until the person confirms', () => {
  const onConfirm = jest.fn();
  renderConfirm(onConfirm);

  for (const line of SUMMARY) expect(screen.getByText(line)).toBeTruthy();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('the summary states the limits, not only the effects', () => {
  // This is the line that stops a request being mistaken for a booking. A form
  // is a list of fields; it does not tell you what pressing the button does.
  renderConfirm();
  expect(screen.getByText(/not a booking/i)).toBeTruthy();
});

test('the server status is shown, not a word of ours', async () => {
  const onConfirm = jest.fn().mockResolvedValue({
    ok: true,
    status: 'pending',
    message: 'The agent will contact you to confirm — it is not booked yet.',
  });
  renderConfirm(onConfirm);

  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  await waitFor(() => expect(screen.getByText(/Status: pending/)).toBeTruthy());
  // The failure this guards against: rendering success as "confirmed" because
  // the HTTP call resolved.
  expect(screen.queryByText(/confirmed/i)).toBeNull();
});

test('a status of confirmed is shown when that is genuinely what came back', async () => {
  // The component reports what the server said — including when the answer is
  // good news. It must not be biased in either direction.
  const onConfirm = jest.fn().mockResolvedValue({
    ok: true,
    status: 'confirmed',
    message: 'The agent has confirmed this viewing.',
  });
  renderConfirm(onConfirm);
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  await waitFor(() => expect(screen.getByText(/Status: confirmed/)).toBeTruthy());
});

test('a rejected submission is reported as a failure, not as silence', async () => {
  const onConfirm = jest.fn().mockRejectedValue(new Error('network'));
  renderConfirm(onConfirm);

  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  // A thrown error is a failed outcome, not "no outcome". Rendering nothing
  // would leave the person looking at a button they already pressed, unsure
  // whether it worked.
  await waitFor(() => expect(screen.getByText(/Status: failed/)).toBeTruthy());
  expect(screen.getByText(/Nothing was submitted/i)).toBeTruthy();
});

test('a double-click sends once', async () => {
  // A double-tap on a slow connection fires twice before React re-renders, and
  // a duplicate showing request is a real phone call to un-book.
  let resolve: (v: unknown) => void = () => {};
  const onConfirm = jest.fn(
    () => new Promise((r) => { resolve = r; }),
  );
  renderConfirm(onConfirm as never);

  const button = screen.getByRole('button', { name: 'Send request' });
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(button);

  expect(onConfirm).toHaveBeenCalledTimes(1);
  resolve({ ok: true, status: 'pending', message: 'Sent.' });
  await waitFor(() => expect(screen.getByText(/Status: pending/)).toBeTruthy());
});

test('going back does not send', () => {
  // Losing a filled-in form because someone wanted to check a date is how a
  // confirmation step turns into an obstacle people click through unread.
  const onConfirm = jest.fn();
  const onBack = jest.fn();
  renderConfirm(onConfirm, onBack);

  fireEvent.click(screen.getByRole('button', { name: /Change/ }));

  expect(onBack).toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('a failure offers a way back rather than a dead end', async () => {
  const onConfirm = jest.fn().mockResolvedValue({
    ok: false,
    status: 'not sent',
    message: 'Please choose a date.',
  });
  renderConfirm(onConfirm);
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  await waitFor(() => expect(screen.getByText(/Status: not sent/)).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
});

test('the outcome is announced to assistive technology', async () => {
  const onConfirm = jest.fn().mockResolvedValue({
    ok: true,
    status: 'pending',
    message: 'Sent.',
  });
  renderConfirm(onConfirm);
  fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

  // `role="status"` rather than `alert`: the outcome is information, and an
  // alert interrupts. A screen-reader user still needs to be told the result
  // without watching for it.
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
});
