'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { bumpEngagement, dismissSignupNudge, shouldShowSignupNudge } from '@/lib/siteEngagement';
import { useAuthStore } from '@/stores/authStore';

const LISTINGS_BUMP_KEY = 'lucy-engagement-listings-bump-date';

export default function SiteSignupSoftNudge() {
  const pathname = usePathname();
  const authed = useAuthStore((s) => Boolean(s.accessToken));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (authed) {
      setOpen(false);
      return;
    }
    if (pathname === '/listings') {
      const today = new Date().toDateString();
      if (typeof window !== 'undefined' && localStorage.getItem(LISTINGS_BUMP_KEY) !== today) {
        localStorage.setItem(LISTINGS_BUMP_KEY, today);
        bumpEngagement(3);
      }
    }
    setOpen(shouldShowSignupNudge());
  }, [pathname, authed]);

  if (authed || !open) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 sm:justify-end sm:pr-6"
      role="dialog"
      aria-labelledby="signup-nudge-title"
      aria-describedby="signup-nudge-desc"
    >
      <div className="pointer-events-auto flex max-w-md gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
        <div className="min-w-0 flex-1">
          <p id="signup-nudge-title" className="font-semibold text-zinc-900 dark:text-zinc-50">
            Enjoying Lucy Charms?
          </p>
          <p id="signup-nudge-desc" className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Create a free account to sync saved homes across devices and get tailored updates.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" className="h-8">
              <Link href="/register">Create account</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            dismissSignupNudge();
            setOpen(false);
          }}
          className="shrink-0 rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Dismiss signup reminder"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
