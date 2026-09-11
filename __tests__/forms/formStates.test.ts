import {
  FORM_STATES,
  isDuplicate,
  isRecoverable,
  serverMessage,
} from '@/lib/formStates';

/**
 * The five states of control 2.9, defined once.
 *
 *     "Validation, loading, success, duplicate and recoverable error states,
 *      preserving what was typed across a failure."
 */

test('all five states the control names exist', () => {
  // 'validating' and 'submitting' are the control's "validation" and
  // "loading"; 'idle' is the state before any of them.
  expect(FORM_STATES).toEqual([
    'idle',
    'validating',
    'submitting',
    'success',
    'duplicate',
    'error',
  ]);
});

describe('duplicate', () => {
  test('is recognised by status, not by message text', () => {
    // Wording changes, gets translated, and gets edited by whoever is tidying
    // copy that week. A state that depends on a sentence staying the same will
    // quietly stop working.
    expect(isDuplicate({ response: { status: 409 } })).toBe(true);
    expect(
      isDuplicate({ response: { status: 400, data: { detail: 'duplicate!' } } }),
    ).toBe(false);
  });

  test('is not an error and not a success', () => {
    // The distinction the whole state exists for: told "something went wrong",
    // a person submits again and makes a second duplicate.
    const error = { response: { status: 409 } };
    expect(isDuplicate(error)).toBe(true);
    expect(isRecoverable(error)).toBe(false);
  });
});

describe('recoverable', () => {
  test('server failures are worth retrying', () => {
    expect(isRecoverable({ response: { status: 503 } })).toBe(true);
    expect(isRecoverable({ response: { status: 500 } })).toBe(true);
  });

  test('rate limiting is explicitly a later problem', () => {
    expect(isRecoverable({ response: { status: 429 } })).toBe(true);
  });

  test('a dropped connection is retryable', () => {
    // No response at all — a timeout, an offline device. The most common
    // failure on a phone, and the one where retrying most often works.
    expect(isRecoverable(new Error('Network Error'))).toBe(true);
    expect(isRecoverable({})).toBe(true);
  });

  test('a rejected input is not', () => {
    // A 422 will fail identically forever until something changes. Offering
    // "Try again" there wastes the person's time and teaches them the button
    // does not work.
    expect(isRecoverable({ response: { status: 422 } })).toBe(false);
    expect(isRecoverable({ response: { status: 400 } })).toBe(false);
    expect(isRecoverable({ response: { status: 403 } })).toBe(false);
  });
});

describe('serverMessage', () => {
  test('prefers what the server said', () => {
    // The server usually knows something the browser does not. Swallowing it
    // leaves the person with no idea what to change.
    expect(
      serverMessage(
        { response: { data: { detail: 'That email is already in use.' } } },
        'fallback',
      ),
    ).toBe('That email is already in use.');
  });

  test('reads the object form some endpoints return', () => {
    // The MFA enrolment gate and the inactive-account response both send
    // `{detail: {code, message}}`.
    expect(
      serverMessage(
        { response: { data: { detail: { code: 'x', message: 'Set up two-step.' } } } },
        'fallback',
      ),
    ).toBe('Set up two-step.');
  });

  test('falls back rather than returning nothing', () => {
    // A blank error area is indistinguishable from success.
    expect(serverMessage({}, 'fallback')).toBe('fallback');
    expect(serverMessage({ response: { data: { detail: '   ' } } }, 'fallback')).toBe(
      'fallback',
    );
    expect(serverMessage({ response: { data: { detail: 42 } } }, 'fallback')).toBe(
      'fallback',
    );
  });
});
