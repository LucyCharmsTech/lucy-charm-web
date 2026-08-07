/**
 * React bindings over the realtime client. The client itself is faked (its
 * behaviour is covered in client.test.ts); these verify the policies the hooks
 * encode — refetch on reconnect but not on first connect, REST fallback only
 * when the socket is down for good, channel lifetime tied to mount lifetime.
 */

import { act, renderHook } from '@testing-library/react';
import {
  useChannels,
  useRealtimeEvent,
  useRefetchOnReconnect,
  useRestFallback,
} from '@/lib/realtime/hooks';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type { RealtimeConnectionState } from '@/lib/realtime/client';
import type { RealtimeEvent } from '@/types/api';

type Handler = (event: RealtimeEvent) => void;

const mockClient = {
  handlers: new Map<string, Set<Handler>>(),
  subscribe: jest.fn((channels: string[]) => () => mockClient.unsubscribed.push(channels)),
  unsubscribed: [] as string[][],
  on(type: string, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  },
  emit(type: string, event: Partial<RealtimeEvent>) {
    for (const handler of this.handlers.get(type) ?? []) handler(event as RealtimeEvent);
  },
};

jest.mock('@/lib/realtime/singleton', () => ({
  getRealtimeClient: () => mockClient,
}));

const setConnection = (state: RealtimeConnectionState) =>
  act(() => useRealtimeStore.getState().setConnectionState(state));

beforeEach(() => {
  mockClient.handlers.clear();
  mockClient.unsubscribed = [];
  mockClient.subscribe.mockClear();
  act(() => useRealtimeStore.getState().reset());
});

describe('useChannels', () => {
  it('subscribes while mounted and releases on unmount', () => {
    const { unmount } = renderHook(() => useChannels(['feed:listings']));
    expect(mockClient.subscribe).toHaveBeenCalledWith(['feed:listings']);
    unmount();
    expect(mockClient.unsubscribed).toEqual([['feed:listings']]);
  });

  it('does nothing for an empty channel list', () => {
    renderHook(() => useChannels([]));
    expect(mockClient.subscribe).not.toHaveBeenCalled();
  });
});

describe('useRealtimeEvent', () => {
  it('routes events of the type to the latest handler and unregisters on unmount', () => {
    const seen: string[] = [];
    const { rerender, unmount } = renderHook(
      ({ tag }: { tag: string }) =>
        useRealtimeEvent('listing.updated', (event) => seen.push(`${tag}:${event.id}`)),
      { initialProps: { tag: 'a' } },
    );

    act(() => mockClient.emit('listing.updated', { id: '1' }));
    rerender({ tag: 'b' }); // handler stays fresh without resubscribing
    act(() => mockClient.emit('listing.updated', { id: '2' }));
    expect(seen).toEqual(['a:1', 'b:2']);

    unmount();
    act(() => mockClient.emit('listing.updated', { id: '3' }));
    expect(seen).toHaveLength(2);
  });
});

describe('useRefetchOnReconnect', () => {
  it('fires on reconnecting → connected, but never on the initial connect', () => {
    const refetch = jest.fn();
    renderHook(() => useRefetchOnReconnect(refetch));

    setConnection('connecting');
    setConnection('connected'); // first connect — the mount fetch covered it
    expect(refetch).not.toHaveBeenCalled();

    setConnection('reconnecting');
    setConnection('connected');
    expect(refetch).toHaveBeenCalledTimes(1);

    setConnection('degraded');
    setConnection('connected');
    expect(refetch).toHaveBeenCalledTimes(2);
  });
});

describe('useRestFallback', () => {
  it.each([
    ['idle', false],
    ['connecting', false],
    ['connected', false],
    ['reconnecting', false],
    ['degraded', true],
    ['stopped', true],
  ] as [RealtimeConnectionState, boolean][])('%s → %s', (state, expected) => {
    const { result } = renderHook(() => useRestFallback());
    setConnection(state);
    expect(result.current).toBe(expected);
  });
});
