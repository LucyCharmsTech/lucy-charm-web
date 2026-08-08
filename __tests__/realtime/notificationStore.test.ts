/**
 * Realtime appliers on the notification store. The contract they encode:
 * events are at-least-once and include the echo of this tab's own optimistic
 * mutations, so every apply must merge idempotently; `unread_count: null`
 * means the server's recount failed — keep the previous badge, never guess 0.
 */

import { useNotificationStore } from '@/stores/notificationStore';
import type { AppNotification } from '@/types/api';

const row = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 'n1',
  event_type: 'showing.confirmed',
  category: 'transactional',
  title: 'Showing confirmed',
  body: null,
  deep_link: null,
  resource_type: null,
  resource_id: null,
  payload_json: null,
  read_at: null,
  created_at: '2026-08-07T10:00:00Z',
  is_read: false,
  ...overrides,
});

const state = () => useNotificationStore.getState();

beforeEach(() => {
  state().reset();
});

describe('applyRealtimeCreated', () => {
  it('prepends once and takes the server-recomputed badge', () => {
    useNotificationStore.setState({
      loaded: true,
      items: [row({ id: 'old' })],
      total: 1,
      unread: 1,
    });
    state().applyRealtimeCreated(row({ id: 'new' }), 2);
    expect(state().items.map((item) => item.id)).toEqual(['new', 'old']);
    expect(state().total).toBe(2);
    expect(state().unread).toBe(2);
  });

  it('is idempotent — a replayed or duplicate event changes nothing', () => {
    useNotificationStore.setState({ loaded: true, items: [row()], total: 1, unread: 1 });
    state().applyRealtimeCreated(row(), 1);
    expect(state().items).toHaveLength(1);
    expect(state().total).toBe(1);
  });

  it('updates only the badge before the first list fetch', () => {
    state().applyRealtimeCreated(row(), 5);
    expect(state().items).toHaveLength(0); // list untouched until loaded
    expect(state().unread).toBe(5);
  });

  it('falls back to +1 when the server recount failed (null)', () => {
    useNotificationStore.setState({ loaded: true, items: [], total: 0, unread: 3 });
    state().applyRealtimeCreated(row(), null);
    expect(state().unread).toBe(4);
  });
});

describe('applyRealtimeRead', () => {
  it('marks the row read and syncs the badge (another tab acted)', () => {
    useNotificationStore.setState({ loaded: true, items: [row()], unread: 1 });
    state().applyRealtimeRead('n1', 0);
    expect(state().items[0].is_read).toBe(true);
    expect(state().items[0].read_at).not.toBeNull();
    expect(state().unread).toBe(0);
  });

  it('keeps the previous badge when the recount is null', () => {
    useNotificationStore.setState({ loaded: true, items: [row({ is_read: true })], unread: 7 });
    state().applyRealtimeRead('n1', null);
    expect(state().unread).toBe(7); // never rendered as 0 on a failed recount
  });
});

describe('applyRealtimeReadAll', () => {
  it('marks every row read; a null recount safely means zero here', () => {
    useNotificationStore.setState({
      loaded: true,
      items: [row(), row({ id: 'n2', is_read: true, read_at: '2026-08-07T09:00:00Z' })],
      unread: 1,
    });
    state().applyRealtimeReadAll(null);
    expect(state().items.every((item) => item.is_read)).toBe(true);
    expect(state().unread).toBe(0);
  });
});

describe('applyRealtimeDismissed', () => {
  it('removes the row and adjusts totals', () => {
    useNotificationStore.setState({ loaded: true, items: [row()], total: 1, unread: 1 });
    state().applyRealtimeDismissed('n1', 0);
    expect(state().items).toHaveLength(0);
    expect(state().total).toBe(0);
    expect(state().unread).toBe(0);
  });

  it('is a no-op for a row this tab never had (already dismissed here)', () => {
    useNotificationStore.setState({ loaded: true, items: [row()], total: 1, unread: 1 });
    state().applyRealtimeDismissed('elsewhere', null);
    expect(state().items).toHaveLength(1);
    expect(state().total).toBe(1);
    expect(state().unread).toBe(1);
  });
});
