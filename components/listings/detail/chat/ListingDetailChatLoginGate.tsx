'use client';

import Link from 'next/link';
import { BotIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ListingDetailChatLoginGateProps = {
  pathname: string;
  onClose: () => void;
};

export default function ListingDetailChatLoginGate({
  pathname,
  onClose,
}: ListingDetailChatLoginGateProps) {
  return (
    <div
      role="dialog"
      aria-label="Sign in to use Lucy AI"
      className={cn(
        'flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-zinc-200/80 shadow-lg',
        'bg-linear-to-b from-white via-[#fef6f9]/40 to-white dark:border-zinc-800/80 dark:from-zinc-900/60 dark:via-zinc-900/50 dark:to-zinc-900/60',
        'ring-1 ring-zinc-900/5 dark:ring-white/10',
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primarycolor/10 text-sm font-extrabold text-primarycolor">
            L
          </span>
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Ask Lucy</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">This listing</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 px-5 pb-6 pt-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primarycolor/10 shadow-sm ring-1 ring-primarycolor/15">
          <BotIcon className="size-7 text-primarycolor" aria-hidden="true" />
        </div>
        <div>
          <p className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Sign in to ask Lucy
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Get personalised AI insights about this property — pricing, neighbourhood, whether to
            schedule a showing, and more.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button
            asChild
            className="h-11 w-full rounded-xl bg-primarycolor font-semibold text-white shadow-sm hover:bg-primarycolor/90 focus-visible:ring-primarycolor"
          >
            <Link href={`/login?redirect=${encodeURIComponent(pathname)}`}>Sign in</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-xl border-primarycolor/25 bg-white/80 font-semibold text-zinc-800 hover:border-primarycolor/40 hover:bg-primarycolor/5 dark:border-zinc-600 dark:bg-zinc-950/30 dark:text-zinc-100 dark:hover:bg-zinc-800/50"
          >
            <Link href="/register">Create free account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
