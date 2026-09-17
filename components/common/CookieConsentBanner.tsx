'use client';

import { useSyncExternalStore } from 'react';
import {
  getConsentServerSnapshot,
  getConsentSnapshot,
  setAnalyticsConsent,
  subscribeToConsent,
} from '@/lib/analytics';
import { PrivacyLink } from '@/components/common/PrivacyLink';

/**
 * Cookie consent for visitor analytics (Task 17). Gates PostHog ONLY —
 * declining changes nothing about leads, showings, chat, or any feature.
 * The choice is sticky (localStorage); the banner never re-appears.
 */
export default function CookieConsentBanner() {
  // `'unknown'` on the server keeps the banner out of prerendered HTML; the
  // client snapshot (null = no choice yet) decides after hydration.
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getConsentServerSnapshot,
  );

  if (consent !== null) return null;

  function choose(nextConsent: 'accepted' | 'declined') {
    setAnalyticsConsent(nextConsent);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          We use cookies to understand how visitors use the site — pages viewed and features used.
          No personal details are collected. You can decline and everything still works.
                <PrivacyLink />
      </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose('declined')}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="rounded-xl bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
