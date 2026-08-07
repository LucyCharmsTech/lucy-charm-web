/**
 * The one RealtimeClient this tab holds. Everything — the manager that starts
 * it, the hooks that listen to it — must go through this accessor so they all
 * share sockets, dedupe state and subscriptions.
 */

import { RealtimeClient } from '@/lib/realtime/client';
import { createWsTicket } from '@/services/realtimeService';
import { useRealtimeStore } from '@/stores/realtimeStore';

let client: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!client) {
    client = new RealtimeClient({
      mintTicket: async () => (await createWsTicket()).ticket,
      onState: (state) => useRealtimeStore.getState().setConnectionState(state),
    });
  }
  return client;
}
