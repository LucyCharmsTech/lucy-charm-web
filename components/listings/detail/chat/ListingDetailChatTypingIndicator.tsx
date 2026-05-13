'use client';

import { BotIcon } from 'lucide-react';

export default function ListingDetailChatTypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
        <BotIcon className="size-3 text-zinc-600 dark:text-zinc-200" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3 py-2 shadow-sm ring-1 ring-zinc-200/70 dark:bg-zinc-800 dark:ring-zinc-700">
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
