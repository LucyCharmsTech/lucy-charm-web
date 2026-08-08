/**
 * RealtimeClient transport tests — the socket is mocked, the state machine is
 * real. Each block maps to a wire-contract rule from .docs/realtime.md:
 * ticket-per-attempt, subprotocol auth, event dedupe, seq cursors and replay,
 * close-code branching, backoff, and subscription refcounting.
 */

import { RealtimeClient, websocketUrl, type RealtimeConnectionState } from '@/lib/realtime/client';
import type { RealtimeEvent } from '@/types/api';

class MockSocket {
  static instances: MockSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockSocket.CONNECTING;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(
    public url: string,
    public protocols: string[],
  ) {
    MockSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close(code = 1000) {
    this.readyState = MockSocket.CLOSED;
    this.onclose?.({ code });
  }

  // ── test helpers ──
  open() {
    this.readyState = MockSocket.OPEN;
    this.onopen?.();
  }

  frame(frame: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  serverClose(code: number) {
    this.readyState = MockSocket.CLOSED;
    this.onclose?.({ code });
  }

  framesOfType(type: string) {
    return this.sent.filter((message) => message.type === type);
  }
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

const welcome = (channels: string[] = []) => ({
  type: 'welcome',
  v: 1,
  connection_id: 'c1',
  user_id: 'u1',
  channels,
  heartbeat_interval: 25,
  max_connection_seconds: 3600,
});

const event = (overrides: Partial<RealtimeEvent> = {}): RealtimeEvent => ({
  v: 1,
  id: 'evt-1',
  seq: 1,
  type: 'listing.updated',
  channel: 'feed:listings',
  occurred_at: '2026-08-07T10:00:00Z',
  payload: {},
  ...overrides,
});

let mintTicket: jest.Mock;
let states: RealtimeConnectionState[];
let client: RealtimeClient;

function makeClient() {
  states = [];
  client = new RealtimeClient({
    mintTicket,
    onState: (state) => states.push(state),
  });
  return client;
}

/** start() and let the ticket mint + socket construction settle. */
async function startClient() {
  client.start();
  await flush();
  await flush();
  return MockSocket.instances.at(-1)!;
}

async function reconnectedSocket() {
  // Backoff delay with Math.random pinned to 0 is base * 0.5 ≤ 15s.
  await jest.advanceTimersByTimeAsync(16_000);
  await flush();
  return MockSocket.instances.at(-1)!;
}

beforeEach(() => {
  // queueMicrotask stays real — the flush() helper rides it to let the async
  // ticket mint settle while setTimeout-based backoff stays under test control.
  jest.useFakeTimers({ doNotFake: ['queueMicrotask'] });
  jest.spyOn(Math, 'random').mockReturnValue(0);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  MockSocket.instances = [];
  (globalThis as Record<string, unknown>).WebSocket = MockSocket;
  let minted = 0;
  mintTicket = jest.fn(async () => `ticket-${++minted}`);
  makeClient();
});

afterEach(() => {
  client.stop();
  jest.useRealTimers();
});

describe('websocketUrl', () => {
  it('derives ws(s):// + /ws from NEXT_PUBLIC_API_URL', () => {
    const previous = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/api/v1/';
    expect(websocketUrl()).toBe('wss://api.example.com/api/v1/ws');
    process.env.NEXT_PUBLIC_API_URL = 'http://127.0.0.1:8000/api/v1';
    expect(websocketUrl()).toBe('ws://127.0.0.1:8000/api/v1/ws');
    process.env.NEXT_PUBLIC_API_URL = previous;
  });
});

describe('connecting', () => {
  it('mints a ticket and offers it as a subprotocol, never in the URL', async () => {
    const socket = await startClient();
    expect(mintTicket).toHaveBeenCalledTimes(1);
    expect(socket.protocols).toEqual(['realtime.ticket.ticket-1']);
    expect(socket.url).not.toContain('ticket');
  });

  it('reaches connected on open and reports state transitions', async () => {
    const socket = await startClient();
    socket.open();
    expect(states).toEqual(['connecting', 'connected']);
  });

  it('mints a FRESH ticket for every attempt', async () => {
    const first = await startClient();
    first.open();
    first.serverClose(1006);
    const second = await reconnectedSocket();
    expect(second.protocols).toEqual(['realtime.ticket.ticket-2']);
  });

  it('stops when the ticket mint reports the session is gone (401)', async () => {
    mintTicket.mockRejectedValue({ response: { status: 401 } });
    makeClient();
    client.start();
    await flush();
    await flush();
    expect(states).toEqual(['connecting', 'stopped']);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(MockSocket.instances).toHaveLength(0);
  });

  it('retries with backoff when the ticket mint fails transiently', async () => {
    mintTicket.mockRejectedValueOnce(new Error('network down'));
    makeClient();
    client.start();
    await flush();
    await flush();
    expect(states).toContain('reconnecting');
    await reconnectedSocket();
    expect(MockSocket.instances).toHaveLength(1);
  });
});

describe('subscriptions', () => {
  it('holds subscribes until welcome, then sends them with `since`', async () => {
    const socket = await startClient();
    client.subscribe(['feed:listings']);
    socket.open();
    expect(socket.framesOfType('subscribe')).toHaveLength(0); // pre-welcome

    socket.frame(welcome(['user:u1']));
    expect(socket.framesOfType('subscribe')).toEqual([
      { type: 'subscribe', channels: ['feed:listings'], since: {} },
    ]);
  });

  it('never subscribes to auto-granted channels', async () => {
    const socket = await startClient();
    client.subscribe(['user:u1']);
    socket.open();
    socket.frame(welcome(['user:u1']));
    expect(socket.framesOfType('subscribe')).toHaveLength(0);
  });

  it('refcounts: two holders, one channel — unsubscribes only when both let go', async () => {
    const socket = await startClient();
    socket.open();
    socket.frame(welcome());

    const releaseA = client.subscribe(['feed:listings']);
    const releaseB = client.subscribe(['feed:listings']);
    expect(socket.framesOfType('subscribe')).toHaveLength(1);

    releaseA();
    expect(socket.framesOfType('unsubscribe')).toHaveLength(0);
    releaseB();
    expect(socket.framesOfType('unsubscribe')).toEqual([
      { type: 'unsubscribe', channels: ['feed:listings'] },
    ]);
  });

  it('drops channels the server refuses instead of asking again', async () => {
    const first = await startClient();
    client.subscribe(['listing:nope']);
    first.open();
    first.frame(welcome());
    first.frame({
      type: 'subscribed',
      channels: [],
      rejected: [{ channel: 'listing:nope', reason: 'not_authorized' }],
      replay: {},
    });

    first.serverClose(1006);
    const second = await reconnectedSocket();
    second.open();
    second.frame(welcome());
    expect(second.framesOfType('subscribe')).toHaveLength(0);
  });
});

describe('events', () => {
  it('dispatches to type handlers and dedupes on event id', async () => {
    const socket = await startClient();
    socket.open();
    socket.frame(welcome());
    const seen: string[] = [];
    client.on('listing.updated', (received) => seen.push(received.id));

    socket.frame({ type: 'event', event: event({ id: 'a', seq: 1 }) });
    socket.frame({ type: 'event', event: event({ id: 'a', seq: 1 }), replayed: true });
    socket.frame({ type: 'event', event: event({ id: 'b', seq: 2 }) });
    expect(seen).toEqual(['a', 'b']);
  });

  it('replays the gap on reconnect: resubscribes with the last applied seq', async () => {
    const first = await startClient();
    client.subscribe(['feed:listings']);
    first.open();
    first.frame(welcome());
    first.frame({ type: 'event', event: event({ id: 'a', seq: 7 }) });

    first.serverClose(1006);
    const second = await reconnectedSocket();
    second.open();
    second.frame(welcome());
    expect(second.framesOfType('subscribe')).toEqual([
      { type: 'subscribe', channels: ['feed:listings'], since: { 'feed:listings': 7 } },
    ]);
  });

  it('re-asks auto-granted channels it holds a cursor for (user-stream replay)', async () => {
    const first = await startClient();
    first.open();
    first.frame(welcome(['user:u1']));
    first.frame({
      type: 'event',
      event: event({ id: 'n1', seq: 3, channel: 'user:u1', type: 'notification.created' }),
    });

    first.serverClose(1006);
    const second = await reconnectedSocket();
    second.open();
    second.frame(welcome(['user:u1']));
    expect(second.framesOfType('subscribe')).toEqual([
      { type: 'subscribe', channels: ['user:u1'], since: { 'user:u1': 3 } },
    ]);
  });

  it('answers server pings with pongs', async () => {
    const socket = await startClient();
    socket.open();
    socket.frame(welcome());
    socket.frame({ type: 'ping' });
    expect(socket.framesOfType('pong')).toHaveLength(1);
  });
});

describe('close-code branching', () => {
  it.each([[4400], [4403], [4404]])('%i stops the client — retrying cannot help', async (code) => {
    const socket = await startClient();
    socket.open();
    socket.serverClose(code);
    expect(states.at(-1)).toBe('stopped');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(MockSocket.instances).toHaveLength(1);
  });

  it.each([[4401], [4402], [1006], [4499]])('%i reconnects with a fresh ticket', async (code) => {
    const socket = await startClient();
    socket.open();
    socket.serverClose(code);
    expect(states.at(-1)).toBe('reconnecting');
    const next = await reconnectedSocket();
    expect(next).not.toBe(socket);
  });

  it('4410 (slow consumer) forgets seq cursors — no false replay claims', async () => {
    const first = await startClient();
    client.subscribe(['feed:listings']);
    first.open();
    first.frame(welcome());
    first.frame({ type: 'event', event: event({ id: 'a', seq: 7 }) });

    first.serverClose(4410);
    const second = await reconnectedSocket();
    second.open();
    second.frame(welcome());
    expect(second.framesOfType('subscribe')).toEqual([
      { type: 'subscribe', channels: ['feed:listings'], since: {} },
    ]);
  });

  it('a protocol-version mismatch stops for good instead of reconnect-looping', async () => {
    const socket = await startClient();
    socket.open();
    socket.frame({ ...welcome(), v: 2 });
    expect(states.at(-1)).toBe('stopped');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(MockSocket.instances).toHaveLength(1);
  });
});

describe('degradation', () => {
  it('turns degraded after 15s down, and later closes do not flip it back', async () => {
    const socket = await startClient();
    socket.open();
    socket.serverClose(1006);
    await jest.advanceTimersByTimeAsync(15_000);
    expect(states.at(-1)).toBe('degraded');

    // The next attempt fails too — state must stay degraded, not "reconnecting".
    const retry = MockSocket.instances.at(-1)!;
    retry.serverClose(1006);
    expect(states.at(-1)).toBe('degraded');
  });

  it('stop() ends everything: socket closed, state idle, no retries', async () => {
    const socket = await startClient();
    socket.open();
    client.stop();
    expect(socket.readyState).toBe(MockSocket.CLOSED);
    expect(states.at(-1)).toBe('idle');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(MockSocket.instances).toHaveLength(1);
  });
});
