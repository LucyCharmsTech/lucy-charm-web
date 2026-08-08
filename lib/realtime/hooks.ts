'use client';

/**
 * React bindings for the realtime client. Consumers never touch the socket:
 * they declare channels, handle typed events, and follow two policies these
 * hooks encode —
 *
 *   * refetch once after every reconnect (`useRefetchOnReconnect`), which is
 *     what makes replay gaps and slow-consumer drops safe to ignore; and
 *   * poll over REST while the socket is down past its grace period
 *     (`useRestFallback`), so the app works with real-time disabled entirely.
 */

import { useEffect, useRef } from 'react';
import { getRealtimeClient } from '@/lib/realtime/singleton';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type { RealtimeEvent } from '@/types/api';

/** Subscribe to channels for as long as the component is mounted. */
export function useChannels(channels: string[]): void {
  // Channel names never contain '|', so the join is a safe identity key that
  // spares callers from memoising the array they pass.
  const key = channels.join('|');
  useEffect(() => {
    if (!key) return;
    return getRealtimeClient().subscribe(key.split('|'));
  }, [key]);
}

/** Handle one event type. The handler stays fresh without resubscribing. */
export function useRealtimeEvent<P = Record<string, unknown>>(
  type: string,
  handler: (event: RealtimeEvent<P>) => void,
): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    return getRealtimeClient().on(type, (event) => ref.current(event as RealtimeEvent<P>));
  }, [type]);
}

/**
 * Run `refetch` when the socket comes back after a drop. Events published while
 * we were away may be gone (the replay buffer is finite), so live surfaces must
 * reconcile over REST — silence after a reconnect would read as "nothing
 * happened", which is exactly wrong. The initial connect is not a reconnect;
 * the mount fetch already covered it.
 */
export function useRefetchOnReconnect(refetch: () => void): void {
  const ref = useRef(refetch);
  useEffect(() => {
    ref.current = refetch;
  });

  const state = useRealtimeStore((s) => s.state);
  const previous = useRef(state);
  useEffect(() => {
    const was = previous.current;
    previous.current = state;
    if (state === 'connected' && (was === 'reconnecting' || was === 'degraded')) {
      ref.current();
    }
  }, [state]);
}

/**
 * True when surfaces should poll over REST: the socket has been down past its
 * grace period ('degraded') or is not coming back this session ('stopped').
 * 'idle' — signed out, or realtime never started — is deliberately false:
 * those surfaces already render from plain REST calls.
 */
export function useRestFallback(): boolean {
  return useRealtimeStore((s) => s.state === 'degraded' || s.state === 'stopped');
}
