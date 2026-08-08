'use client';

/**
 * Starts the shared realtime socket while someone is signed in, and tears it
 * down when they sign out. Renders nothing — it is mounted once from the root
 * layout, like `AuthHydrator`.
 *
 * Keyed on the user id, not the token: a token refresh must not cycle a healthy
 * socket, but signing out or switching accounts must. Both logout paths end in
 * `clearAuth()`, so the cleanup below is the single wipe point for realtime
 * state — no per-logout-site wiring needed.
 */

import { useEffect } from 'react';
import { getRealtimeClient } from '@/lib/realtime/singleton';
import { useAuthStore } from '@/stores/authStore';
import { useRealtimeStore } from '@/stores/realtimeStore';

export default function RealtimeManager() {
  const userId = useAuthStore((s) => s.user?.user_id ?? null);

  useEffect(() => {
    if (!userId) return;
    const client = getRealtimeClient();
    client.start();
    return () => {
      client.stop();
      useRealtimeStore.getState().reset();
    };
  }, [userId]);

  return null;
}
