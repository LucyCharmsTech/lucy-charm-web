'use client';

import { useSyncExternalStore } from 'react';
import {
  getConsentServerSnapshot,
  getConsentSnapshot,
  setAnalyticsConsent,
  subscribeToConsent,
} from '@/lib/analytics';

/** A persistent way to change the same device-level choice as the banner. */
export default function AnalyticsPreferences() {
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );

  return (
    <section id="analytics-preferences" aria-labelledby="analytics-preferences-title" className="mt-8 scroll-mt-24 space-y-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 id="analytics-preferences-title" className="text-lg font-bold">Analytics preferences</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Optional browsing analytics is {consent === 'accepted' ? 'on' : consent === 'declined' ? 'off' : 'not yet chosen'} on this device. Essential requests and first-party feedback still work when it is off.
      </p>
      {consent !== 'unknown' && (
        <div className="flex flex-wrap gap-2">
          {consent !== 'accepted' && <button type="button" onClick={() => setAnalyticsConsent('accepted')} className="rounded-lg bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground">Accept analytics</button>}
          {consent !== 'declined' && <button type="button" onClick={() => setAnalyticsConsent('declined')} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700">{consent === 'accepted' ? 'Withdraw analytics consent' : 'Decline analytics'}</button>}
        </div>
      )}
      <p role="status" className="text-xs text-zinc-500">Your choice is saved in this browser and can be changed here at any time.</p>
    </section>
  );
}
