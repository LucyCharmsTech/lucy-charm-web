'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Autosave, duplicate-submission protection and failure recovery — control 6.15.
 *
 * *"**Autosave** multi-step inputs; **protect against duplicate submission**;
 * **recover from temporary failure**; handle simultaneous-device updates
 * through record version checks."*
 *
 * The first three live here. The fourth is server-side — a `record_version`
 * carried on the record and refused with 409 when stale — because a client
 * cannot arbitrate between two devices.
 *
 * Four behaviours, each there for a reason:
 *
 * **Debounced, not on every keystroke.** Saving each character turns a typed
 * sentence into forty writes and forty chances to conflict.
 *
 * **Never two saves in flight.** A save that starts while one is running is
 * held and coalesced into a single follow-up, so a slow network cannot produce
 * out-of-order writes where the older value lands last.
 *
 * **Unchanged values are not saved.** Autosave that fires on focus loss with
 * nothing changed writes noise into the audit trail and burns a version bump.
 *
 * **A failure is kept, not swallowed.** The value stays dirty so the next tick
 * retries it, and `status` reports the failure so the screen can say so
 * rather than implying it saved.
 */

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type UseAutosaveOptions<T> = {
  /** Called with the value to persist. Should throw on failure. */
  save: (value: T) => Promise<unknown>;
  /** Quiet period before a save fires. */
  delayMs?: number;
  /** Compares two values; defaults to JSON equality. */
  isEqual?: (a: T, b: T) => boolean;
};

export type UseAutosaveResult<T> = {
  status: AutosaveStatus;
  /** True when there are unsaved changes — for an "unsaved" hint. */
  dirty: boolean;
  error: string | null;
  /** Record a change. Debounced. */
  change: (value: T) => void;
  /** Save immediately, skipping the debounce. Also duplicate-protected. */
  flush: () => Promise<void>;
};

const DEFAULT_DELAY_MS = 1200;

function defaultIsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useAutosave<T>(
  initial: T,
  { save, delayMs = DEFAULT_DELAY_MS, isEqual = defaultIsEqual }: UseAutosaveOptions<T>,
): UseAutosaveResult<T> {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Refs, not state: these drive the save loop and must not re-render on
  // every change or the debounce restarts itself.
  const pending = useRef<T>(initial);
  const lastSaved = useRef<T>(initial);
  const inFlight = useRef(false);
  const saveAgain = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(async () => {
    if (inFlight.current) {
      // Coalesce: one follow-up after the current save, not a queue of them.
      saveAgain.current = true;
      return;
    }

    inFlight.current = true;
    try {
      // A loop rather than a recursive call: a save that arrived while this
      // one was running is handled by going round again, which keeps the
      // ordering strict and this function non-recursive.
      let keepGoing = true;
      while (keepGoing) {
        keepGoing = false;

        if (isEqual(pending.current, lastSaved.current)) {
          // Nothing changed. Saving anyway writes noise and burns a version
          // bump.
          if (mounted.current) setDirty(false);
          break;
        }

        const attempted = pending.current;
        if (mounted.current) {
          setStatus('saving');
          setError(null);
        }

        try {
          await save(attempted);
          lastSaved.current = attempted;
          if (mounted.current) {
            setStatus('saved');
            setDirty(!isEqual(pending.current, attempted));
          }
        } catch (err: unknown) {
          // Deliberately does not clear the value: it stays dirty so the next
          // tick retries it, rather than being silently lost.
          if (mounted.current) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Could not save.');
            setDirty(true);
          }
          break;
        }

        if (saveAgain.current) {
          saveAgain.current = false;
          keepGoing = true;
        }
      }
    } finally {
      inFlight.current = false;
      saveAgain.current = false;
    }
  }, [isEqual, save]);

  const change = useCallback(
    (value: T) => {
      pending.current = value;
      setDirty(!isEqual(value, lastSaved.current));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), delayMs);
    },
    [delayMs, isEqual, run],
  );

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    await run();
  }, [run]);

  return { status, dirty, error, change, flush };
}
