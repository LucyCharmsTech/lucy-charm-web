import { act, renderHook, waitFor } from '@testing-library/react';
import { useAutosave } from '@/lib/useAutosave';

/**
 * Control 6.15: *"**Autosave** multi-step inputs; **protect against duplicate
 * submission**; **recover from temporary failure**; handle simultaneous-device
 * updates through record version checks."*
 *
 * The first three are here. The fourth is server-side — a client cannot
 * arbitrate between two devices — and is tested on the journey record.
 */

jest.useFakeTimers();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('saves after the quiet period, not on every keystroke', async () => {
  // Saving each character turns a typed sentence into forty writes.
  const save = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave({ text: '' }, { save }));

  act(() => {
    result.current.change({ text: 'h' });
    result.current.change({ text: 'he' });
    result.current.change({ text: 'hel' });
  });
  expect(save).not.toHaveBeenCalled();

  await act(async () => {
    jest.runAllTimers();
  });

  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenCalledWith({ text: 'hel' });
});

test('never runs two saves at once', async () => {
  // A slow network must not produce out-of-order writes where the older
  // value lands last.
  const first = deferred<void>();
  const save = jest
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave({ text: '' }, { save }));

  act(() => result.current.change({ text: 'one' }));
  await act(async () => {
    jest.runAllTimers();
  });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

  // A second change while the first save is still in flight.
  act(() => result.current.change({ text: 'two' }));
  await act(async () => {
    jest.runAllTimers();
  });
  expect(save).toHaveBeenCalledTimes(1);

  await act(async () => {
    first.resolve();
  });

  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenLastCalledWith({ text: 'two' });
});

test('several changes during one save coalesce into a single follow-up', async () => {
  const first = deferred<void>();
  const save = jest
    .fn()
    .mockImplementationOnce(() => first.promise)
    .mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave({ text: '' }, { save }));

  act(() => result.current.change({ text: 'a' }));
  await act(async () => {
    jest.runAllTimers();
  });

  act(() => {
    result.current.change({ text: 'b' });
    result.current.change({ text: 'c' });
    result.current.change({ text: 'd' });
  });
  await act(async () => {
    jest.runAllTimers();
  });

  await act(async () => {
    first.resolve();
  });

  // One follow-up, not three.
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save).toHaveBeenLastCalledWith({ text: 'd' });
});

test('an unchanged value is not saved', async () => {
  // Autosave firing on focus loss with nothing changed writes noise into the
  // audit trail and burns a version bump.
  const save = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave({ text: 'same' }, { save }));

  act(() => result.current.change({ text: 'same' }));
  await act(async () => {
    jest.runAllTimers();
  });

  expect(save).not.toHaveBeenCalled();
  expect(result.current.dirty).toBe(false);
});

test('a failure keeps the value dirty so it can be retried', async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave({ text: '' }, { save }));

  act(() => result.current.change({ text: 'important' }));
  await act(async () => {
    jest.runAllTimers();
  });

  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.dirty).toBe(true);
  expect(result.current.error).toContain('network');

  // The next attempt sends the same value — it was never lost.
  await act(async () => {
    await result.current.flush();
  });
  await waitFor(() => expect(result.current.status).toBe('saved'));
  expect(save).toHaveBeenLastCalledWith({ text: 'important' });
});

test('flush saves immediately, without waiting for the debounce', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave({ text: '' }, { save }));

  act(() => result.current.change({ text: 'now' }));
  await act(async () => {
    await result.current.flush();
  });

  expect(save).toHaveBeenCalledWith({ text: 'now' });
});

test('status reports what is happening', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useAutosave({ text: '' }, { save }));

  expect(result.current.status).toBe('idle');

  act(() => result.current.change({ text: 'x' }));
  expect(result.current.dirty).toBe(true);

  await act(async () => {
    jest.runAllTimers();
  });
  await waitFor(() => expect(result.current.status).toBe('saved'));
  expect(result.current.dirty).toBe(false);
});
