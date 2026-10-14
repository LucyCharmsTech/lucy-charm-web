'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getAnalyticsConsent, track } from '@/lib/analytics';

export type TrackedForm = 'contact_form' | 'home_value' | 'showing_request';

/** A meaningful edit followed by route leave/pagehide, never mere form display. */
export function useFormAbandonment(form: TrackedForm) {
  const started = useRef(false);
  const succeeded = useRef(false);
  const emitted = useRef(false);
  const paused = useRef(false);

  const markStarted = useCallback(() => {
    // Consent granted later does not retroactively capture earlier form use.
    if (getAnalyticsConsent() === 'accepted') started.current = true;
  }, []);
  const markSucceeded = useCallback(() => { succeeded.current = true; }, []);
  const markPaused = useCallback(() => { paused.current = true; }, []);
  const markResumed = useCallback(() => { paused.current = false; }, []);
  const reset = useCallback(() => {
    started.current = false;
    succeeded.current = false;
    emitted.current = false;
    paused.current = false;
  }, []);

  const markAbandoned = useCallback(() => {
    if (!started.current || succeeded.current || emitted.current || paused.current) return;
    emitted.current = true;
    track('form_abandoned', { form });
  }, [form]);

  useEffect(() => {
    window.addEventListener('pagehide', markAbandoned);
    return () => {
      window.removeEventListener('pagehide', markAbandoned);
      markAbandoned();
    };
  }, [markAbandoned]);

  return { markStarted, markSucceeded, markPaused, markResumed, markAbandoned, reset };
}
