import { act, renderHook, waitFor } from '@testing-library/react';
import { useFormSubmission } from '@/lib/useFormSubmission';

/**
 * The five states, wired once — control 2.9.
 */

test('a submission runs through loading to success', async () => {
  const { result } = renderHook(() => useFormSubmission<string>());

  expect(result.current.state).toBe('idle');

  let resolve: (v: string) => void = () => {};
  const pending = new Promise<string>((r) => {
    resolve = r;
  });

  act(() => {
    void result.current.submit(() => pending);
  });
  await waitFor(() => expect(result.current.state).toBe('submitting'));

  await act(async () => {
    resolve('receipt-1');
    await pending;
  });
  expect(result.current.state).toBe('success');
  expect(result.current.value).toBe('receipt-1');
});

test('a 409 lands in the duplicate state, not the error state', async () => {
  // The one most often dropped: without this branch a 409 falls through to
  // the generic error and the message reads "could not send", which is both
  // wrong and an invitation to submit again.
  const { result } = renderHook(() => useFormSubmission<string>());

  await act(async () => {
    await result.current.submit(() =>
      Promise.reject({ response: { status: 409 } }),
    );
  });

  expect(result.current.state).toBe('duplicate');
  expect(result.current.retryable).toBe(false);
  expect(result.current.message).toMatch(/already have this/i);
});

test('a duplicate message from the server is preferred over ours', async () => {
  const { result } = renderHook(() => useFormSubmission<string>());

  await act(async () => {
    await result.current.submit(() =>
      Promise.reject({
        response: { status: 409, data: { detail: 'You already asked for this viewing.' } },
      }),
    );
  });

  expect(result.current.message).toBe('You already asked for this viewing.');
});

test('a server failure is an error, and marked retryable', async () => {
  const { result } = renderHook(() => useFormSubmission<string>());

  await act(async () => {
    await result.current.submit(() =>
      Promise.reject({ response: { status: 503 } }),
    );
  });

  expect(result.current.state).toBe('error');
  expect(result.current.retryable).toBe(true);
});

test('a rejected input is an error, and not retryable', async () => {
  const { result } = renderHook(() => useFormSubmission<string>());

  await act(async () => {
    await result.current.submit(() =>
      Promise.reject({ response: { status: 422, data: { detail: 'Pick a date.' } } }),
    );
  });

  expect(result.current.state).toBe('error');
  expect(result.current.retryable).toBe(false);
  expect(result.current.message).toBe('Pick a date.');
});

test('a second submit while one is in flight does not run', async () => {
  // A double-tap on a slow connection fires twice before React re-renders,
  // and the second request is a real duplicate at the other end.
  const run = jest.fn(() => new Promise<string>(() => {}));
  const { result } = renderHook(() => useFormSubmission<string>());

  act(() => {
    void result.current.submit(run);
  });
  await waitFor(() => expect(result.current.state).toBe('submitting'));

  await act(async () => {
    const second = await result.current.submit(run);
    expect(second.ok).toBe(false);
  });

  expect(run).toHaveBeenCalledTimes(1);
});

test('reset returns to idle for a "send another"', async () => {
  const { result } = renderHook(() => useFormSubmission<string>());
  await act(async () => {
    await result.current.submit(() => Promise.resolve('x'));
  });
  expect(result.current.state).toBe('success');

  act(() => result.current.reset());

  expect(result.current.state).toBe('idle');
  expect(result.current.value).toBeNull();
  expect(result.current.message).toBeNull();
});

test('the hook never owns form values', () => {
  // Control 2.10's "preserve entered information after a retryable failure" is
  // easiest to honour by not owning the fields at all: a hook that cannot
  // clear them cannot lose someone's paragraph about their property on a 503.
  const { result } = renderHook(() => useFormSubmission<string>());
  expect(Object.keys(result.current).sort()).toEqual([
    'message',
    'reset',
    'retryable',
    'state',
    'submit',
    'value',
  ]);
});
