/**
 * Shared showing-request wiring, used by the agent queue and the client
 * schedule. The wire facts under test: one change fans out to several channels
 * with distinct event ids (so refetches must coalesce), events echo the user's
 * own actions (so patches must merge idempotently), and while the socket is
 * down the hook polls REST and refreshes when the tab becomes visible.
 */

import { act, renderHook } from '@testing-library/react';
import { useLiveShowingRequests } from '@/lib/useLiveShowingRequests';
import { useRealtimeStore } from '@/stores/realtimeStore';
import type { RealtimeEvent } from '@/types/api';

type Handler = (event: RealtimeEvent) => void;

const mockClient = {
  handlers: new Map<string, Set<Handler>>(),
  subscribe: jest.fn(() => () => {}),
  on(type: string, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  },
  emit(type: string, payload: Record<string, unknown>, id = `evt-${Math.random()}`) {
    const event = {
      v: 1,
      id,
      seq: 1,
      type,
      channel: 'user:u1',
      occurred_at: '2026-08-07T10:00:00Z',
      payload,
    } as RealtimeEvent;
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  },
};

jest.mock('@/lib/realtime/singleton', () => ({
  getRealtimeClient: () => mockClient,
}));

const handlers = { patch: jest.fn(), remove: jest.fn(), refetch: jest.fn() };

function mount() {
  return renderHook(() => useLiveShowingRequests(handlers));
}

beforeEach(() => {
  jest.useFakeTimers();
  mockClient.handlers.clear();
  act(() => useRealtimeStore.getState().reset());
});

afterEach(() => {
  jest.useRealTimers();
});

describe('status changes', () => {
  it('merges a transition into the row (echo-safe: patch, never append)', () => {
    mount();
    act(() =>
      mockClient.emit('showing.status_changed', {
        showing_request_id: 's1',
        listing_id: 'l1',
        status: 'confirmed',
        previous_status: 'pending',
        scheduled_at: '2026-08-09T14:30:00Z',
      }),
    );
    expect(handlers.patch).toHaveBeenCalledWith('s1', {
      status: 'confirmed',
      scheduled_at: '2026-08-09T14:30:00Z',
    });
    expect(handlers.refetch).not.toHaveBeenCalled();
  });

  it('stamps rescheduled_at from the event when the schedule moved', () => {
    mount();
    act(() =>
      mockClient.emit('showing.status_changed', {
        showing_request_id: 's1',
        listing_id: 'l1',
        status: 'confirmed',
        previous_status: 'confirmed',
        scheduled_at: '2026-08-10T10:00:00Z',
        rescheduled: true,
      }),
    );
    expect(handlers.patch).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ rescheduled_at: '2026-08-07T10:00:00Z' }),
    );
  });

  it('refetches for a brand-new request — the wire cannot build the row', () => {
    mount();
    act(() =>
      mockClient.emit('showing.status_changed', {
        showing_request_id: 's2',
        listing_id: 'l1',
        status: 'pending',
        previous_status: null,
        scheduled_at: null,
      }),
    );
    expect(handlers.patch).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(300));
    expect(handlers.refetch).toHaveBeenCalledTimes(1);
  });

  it('coalesces the multi-channel duplicates of one change into one refetch', () => {
    mount();
    const payload = {
      showing_request_id: 's2',
      listing_id: 'l1',
      status: 'pending',
      previous_status: null,
      scheduled_at: null,
    };
    // Same logical change, distinct event ids — user: and agent: deliveries.
    act(() => {
      mockClient.emit('showing.status_changed', payload, 'id-user-channel');
      mockClient.emit('showing.status_changed', payload, 'id-agent-channel');
    });
    act(() => jest.advanceTimersByTime(300));
    expect(handlers.refetch).toHaveBeenCalledTimes(1);
  });
});

describe('other showing events', () => {
  it('withdrawal removes the row', () => {
    mount();
    act(() =>
      mockClient.emit('showing.withdrawn', {
        showing_request_id: 's1',
        listing_id: 'l1',
        previous_status: 'confirmed',
      }),
    );
    expect(handlers.remove).toHaveBeenCalledWith('s1');
  });

  it('an uploaded ID flips the row to pending review (buyer → agent)', () => {
    mount();
    act(() =>
      mockClient.emit('showing.document_uploaded', {
        showing_request_id: 's1',
        listing_id: 'l1',
        document_id: 'd1',
        document_status: 'uploaded',
        content_type: 'image/png',
        id_verification_status: 'pending',
        previous_id_verification_status: 'pending',
      }),
    );
    expect(handlers.patch).toHaveBeenCalledWith('s1', {
      id_verification_status: 'pending',
      identity_document_uploaded: true,
    });
  });

  it('a review outcome patches the verification badge (agent → buyer)', () => {
    mount();
    act(() =>
      mockClient.emit('showing.id_verification_changed', {
        showing_request_id: 's1',
        listing_id: 'l1',
        id_verification_status: 'verified',
        previous_id_verification_status: 'pending',
        review_status: 'verified',
      }),
    );
    expect(handlers.patch).toHaveBeenCalledWith('s1', { id_verification_status: 'verified' });
  });

  it('feedback lands as the structured fields only — no comment on the wire', () => {
    mount();
    act(() =>
      mockClient.emit('showing.feedback_submitted', {
        showing_request_id: 's1',
        listing_id: 'l1',
        feedback_submitted_at: '2026-08-07T10:00:00Z',
        feedback_rating: 5,
        feedback_interest_level: 'high',
        feedback_price_fit: 'on_target',
        feedback_would_offer: true,
      }),
    );
    expect(handlers.patch).toHaveBeenCalledWith('s1', {
      feedback_submitted_at: '2026-08-07T10:00:00Z',
      feedback_rating: 5,
      feedback_interest_level: 'high',
      feedback_price_fit: 'on_target',
      feedback_would_offer: true,
    });
  });
});

describe('degraded fallback', () => {
  it('polls REST every 30s while the socket is down, and stops when it is back', () => {
    mount();
    act(() => useRealtimeStore.getState().setConnectionState('degraded'));
    act(() => jest.advanceTimersByTime(30_000));
    expect(handlers.refetch).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(30_000));
    expect(handlers.refetch).toHaveBeenCalledTimes(2);

    act(() => useRealtimeStore.getState().setConnectionState('connected'));
    act(() => jest.advanceTimersByTime(120_000));
    expect(handlers.refetch).toHaveBeenCalledTimes(3); // +1 from the reconnect refetch only
  });

  it('refreshes when a backgrounded tab becomes visible again', () => {
    mount();
    act(() => useRealtimeStore.getState().setConnectionState('degraded'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(handlers.refetch).toHaveBeenCalledTimes(1);
  });
});
