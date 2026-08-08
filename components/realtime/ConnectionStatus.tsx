'use client';

/**
 * Honest and quiet connection indicator. Nothing renders while connected,
 * idle, or during the first connect — a flash of "connecting" on every page
 * load reads as brokenness. A brief blip shows a muted chip; a socket that is
 * not coming back this session states that live updates are off.
 */

import { WifiOffIcon } from 'lucide-react';
import { useRealtimeStore } from '@/stores/realtimeStore';

export default function ConnectionStatus() {
  const state = useRealtimeStore((s) => s.state);

  if (state === 'stopped') {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-300"
      >
        <WifiOffIcon className="size-3.5 shrink-0" aria-hidden="true" />
        Live updates are unavailable — data refreshes periodically.
      </div>
    );
  }

  if (state === 'reconnecting' || state === 'degraded') {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
      >
        <span
          className="size-2 shrink-0 animate-pulse rounded-full bg-amber-500"
          aria-hidden="true"
        />
        Reconnecting…
      </div>
    );
  }

  return null;
}
