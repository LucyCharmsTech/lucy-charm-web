import { Suspense } from 'react';
import { UnsubscribeManager } from '@/components/consent/UnsubscribeManager';

/**
 * Public unsubscribe confirmation page. No authentication, by requirement.
 *
 * Reached from the footer link in every promotional email. `?stop_all=1` in the
 * link applies the stop-all immediately on arrival, so the "Stop all
 * promotional emails" line in the footer is genuinely one click; the plain link
 * opens the per-stream choices instead.
 */
export const metadata = {
  title: 'Email preferences | Lucy Charms Realty',
  // Nothing here should ever be indexed: the URL carries a token.
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] items-start justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
      <Suspense
        fallback={
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading your email preferences…</p>
          </div>
        }
      >
        <UnsubscribeManager />
      </Suspense>
    </div>
  );
}
