'use client';

import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Whether the persisted session is visible to this render.
 *
 * On a full page load React hydrates with the store's *initial* state — zustand
 * serves `getInitialState()` as the server snapshot — so `accessToken` reads
 * null for that first render even when localStorage holds a session. A gate
 * that redirects on `!accessToken` in an effect fires on that render and sends
 * a signed-in visitor to /login; on /security, where /login sends them back,
 * that became an endless loop.
 *
 * The server snapshot is `false` for the same reason, so this only turns true
 * once the render can actually see the persisted state.
 */
export function useAuthHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useAuthStore.persist.onFinishHydration(onChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}
