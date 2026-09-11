'use client';

import { useCallback, useState } from 'react';
import {
  isDuplicate,
  isRecoverable,
  serverMessage,
  type FormState,
} from '@/lib/formStates';

/**
 * The five states of control 2.9, wired once.
 *
 * A form adopting this gets validation, loading, success, **duplicate** and
 * recoverable-versus-final errors without having to remember that duplicate
 * exists — which is the one that gets dropped, because a 409 falling through
 * to the generic error branch looks like nothing is wrong.
 *
 * ### What this deliberately does not do
 *
 * **It never touches your form values.** Control 2.10's *"preserve entered
 * information after a retryable failure"* is easiest to honour by simply not
 * owning the fields: a hook that cannot clear them cannot lose someone's
 * paragraph about their property on a 503.
 *
 * ### Duplicate submission
 *
 * Guarded on `state === 'submitting'` rather than only by disabling a button.
 * A double-tap on a slow connection fires twice before React re-renders, and
 * the second request is a real duplicate at the other end — a second showing
 * request someone has to phone about.
 */

export type SubmissionResult<T> =
  | { ok: true; value: T }
  | { ok: false; state: 'duplicate' | 'error'; message: string };

export type FormSubmission<T> = {
  state: FormState;
  /** Set for 'duplicate' and 'error'. Null otherwise. */
  message: string | null;
  /** Whether trying the same submission again is worth the person's time. */
  retryable: boolean;
  /** Set once the submission succeeded. */
  value: T | null;
  submit: (run: () => Promise<T>) => Promise<SubmissionResult<T>>;
  /** Back to a clean slate — for "try again" or "send another". */
  reset: () => void;
};

export function useFormSubmission<T>(options?: {
  /** Shown when the server explains nothing. */
  fallbackMessage?: string;
  /** Shown for a 409. Should say what already exists, not that it failed. */
  duplicateMessage?: string;
}): FormSubmission<T> {
  const fallback =
    options?.fallbackMessage ??
    'We could not send this just now. Your details are still here — please try again.';
  const duplicate =
    options?.duplicateMessage ??
    'We already have this — there is no need to send it again.';

  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [value, setValue] = useState<T | null>(null);

  const submit = useCallback(
    async (run: () => Promise<T>): Promise<SubmissionResult<T>> => {
      // See the note above: a disabled button is not enough on a slow
      // connection.
      if (state === 'submitting') {
        return { ok: false, state: 'error', message: 'Already sending.' };
      }
      setState('submitting');
      setMessage(null);
      try {
        const result = await run();
        setValue(result);
        setState('success');
        return { ok: true, value: result };
      } catch (error: unknown) {
        if (isDuplicate(error)) {
          // Not an error. Told "something went wrong", a person submits again
          // and makes a second duplicate; told "we already have this", they
          // stop.
          const text = serverMessage(error, duplicate);
          setState('duplicate');
          setMessage(text);
          setRetryable(false);
          return { ok: false, state: 'duplicate', message: text };
        }
        const text = serverMessage(error, fallback);
        setState('error');
        setMessage(text);
        // Drives whether the UI offers "Try again" at all. Offering it on a
        // 422 teaches people the button does not work.
        setRetryable(isRecoverable(error));
        return { ok: false, state: 'error', message: text };
      }
    },
    [state, fallback, duplicate],
  );

  const reset = useCallback(() => {
    setState('idle');
    setMessage(null);
    setRetryable(false);
    setValue(null);
  }, []);

  return { state, message, retryable, value, submit, reset };
}
