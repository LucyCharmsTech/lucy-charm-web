import { fireEvent, render, screen } from '@testing-library/react';
import { MfaRecoveryCodes } from '@/components/security/MfaRecoveryCodes';

/**
 * The one and only time the recovery codes are readable — control 1.13 / C6.
 *
 * The server keeps hashes, so there is no endpoint that can show them again.
 * A recovery path nobody kept a copy of is a recovery path that does not
 * exist, and the failure only surfaces months later when someone is already
 * locked out.
 */

const CODES = Array.from({ length: 10 }, (_, i) => `code${i}-abcdef1234`);

test('every code is rendered — a truncated list is a silent lockout later', () => {
  render(<MfaRecoveryCodes codes={CODES} onDone={jest.fn()} />);
  for (const code of CODES) {
    expect(screen.getByText(code)).toBeTruthy();
  }
});

test('it says plainly that these cannot be shown again', () => {
  render(<MfaRecoveryCodes codes={CODES} onDone={jest.fn()} />);
  expect(screen.getByText(/shown once/i)).toBeTruthy();
  expect(screen.getByText(/cannot show them again/i)).toBeTruthy();
});

test('dismissing is gated on confirming they were saved', () => {
  // Not ceremony: it is the difference between someone who saved these and
  // someone who clicked past a wall of text.
  const onDone = jest.fn();
  render(<MfaRecoveryCodes codes={CODES} onDone={onDone} />);

  const done = screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement;
  expect(done.disabled).toBe(true);

  fireEvent.click(screen.getByRole('checkbox'));
  expect(done.disabled).toBe(false);

  fireEvent.click(done);
  expect(onDone).toHaveBeenCalled();
});

test('a regenerated set says the previous one has already stopped working', () => {
  // Half-replaced sets are how people end up believing a printed sheet still
  // works.
  render(
    <MfaRecoveryCodes codes={CODES} onDone={jest.fn()} replacedPrevious />,
  );
  expect(screen.getByText(/previous codes stopped working/i)).toBeTruthy();
});

test('a clipboard that refuses does not present itself as a failure', async () => {
  // Clipboard access can be denied outright — insecure origin, permissions
  // policy, a browser that just says no. The codes are on screen and
  // downloadable, so this is a convenience failing, not the feature.
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
  });
  render(<MfaRecoveryCodes codes={CODES} onDone={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /Copy all/i }));

  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText(CODES[0])).toBeTruthy();
});
