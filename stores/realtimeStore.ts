/**
 * Realtime connection state, mirrored out of the RealtimeClient so components
 * can render from it (status chip, fallback polling). Never persisted — it
 * describes a live socket, and a stored copy would be a lie on the next load.
 *
 * Holds no per-user data; `RealtimeManager` resets it whenever the signed-in
 * user changes, which covers both logout call sites without touching them.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { RealtimeConnectionState } from '@/lib/realtime/client';

interface RealtimeState {
  state: RealtimeConnectionState;

  /** Wired to the client's onState by the realtime singleton. */
  setConnectionState: (state: RealtimeConnectionState) => void;

  reset: () => void;
}

const INITIAL = {
  state: 'idle' as RealtimeConnectionState,
};

export const useRealtimeStore = create<RealtimeState>()(
  devtools(
    (set) => ({
      ...INITIAL,

      setConnectionState: (state) => set({ state }, false, 'realtime/setConnectionState'),

      reset: () => set({ ...INITIAL }, false, 'realtime/reset'),
    }),
    { name: 'realtimeStore' },
  ),
);
