'use client';

import Link from 'next/link';
import { BotIcon, XIcon } from 'lucide-react';

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
      className="flex w-[340px] flex-col items-center gap-4 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-2xl dark:border-zinc-800/70 dark:bg-zinc-950 sm:w-[380px]"
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primarycolor text-xs font-bold text-white">
            L
          </span>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Ask Lucy
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:text-zinc-200"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primarycolor/10">
          <BotIcon className="size-7 text-primarycolor" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            Sign in to ask Lucy
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Get personalised AI insights about this property — pricing, neighbourhood,
            whether to schedule a showing, and more.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <Link
          href={`/login?redirect=${encodeURIComponent(pathname)}`}
          className="flex h-10 w-full items-center justify-center rounded-xl bg-primarycolor text-sm font-semibold text-white transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="flex h-10 w-full items-center justify-center rounded-xl border border-zinc-200/80 text-sm font-semibold text-zinc-700 transition hover:border-primarycolor/40 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:text-zinc-200"
        >
          Create free account
        </Link>
      </div>
    </div>
  );
}
