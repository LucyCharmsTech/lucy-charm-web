/**
 * Realtime WebSocket transport — sockets, tickets, backoff, dedupe. Nothing
 * React-shaped lives here; components consume it through `lib/realtime/hooks.ts`
 * and the singleton in `lib/realtime/singleton.ts`.
 *
 * Three rules from the wire contract that shape this client:
 *
 *   * The socket is an accelerator, never a data source — every surface still
 *     renders from REST and refetches once after a reconnect. That blanket
 *     refetch is also why `refetch_required` replays and 4410 (slow consumer)
 *     need no dedicated callback: both end in a reconnect.
 *   * Events are at-least-once, so delivery is deduped on `event.id` here and
 *     applied by merging in the handlers. The same logical change also fans out
 *     to several channels with *distinct* event ids (an agent hears a showing
 *     change on both `user:` and `agent:`), which `event.id` dedupe cannot
 *     collapse — handlers must stay idempotent regardless.
 *   * A ticket is single-use and 30 seconds old at most, so every attempt mints
 *     a fresh one. Token freshness is the axios interceptor's problem, not ours:
 *     minting rides the shared instance, which refreshes on 401 by itself.
 */

import type { RealtimeEvent, RealtimeServerFrame } from '@/types/api';

const MAX_BACKOFF_MS = 30_000;
/** Disconnected this long → 'degraded', and fallback polling takes over. */
const DEGRADED_AFTER_MS = 15_000;
const SEEN_EVENT_LIMIT = 500;

/** Client speaks protocol v1; a `welcome` with any other version stops the client. */
const PROTOCOL_VERSION = 1;

// Close codes the reconnect strategy branches on — see realtime/models.py.
const CLOSE_AUTH_FAILED = 4401;
const CLOSE_REAUTH_REQUIRED = 4402;
const CLOSE_ORIGIN_REJECTED = 4403;
const CLOSE_PROTOCOL_ERROR = 4400;
const CLOSE_DISABLED = 4404;
const CLOSE_SLOW_CONSUMER = 4410;

export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded' // down long enough that REST polling has taken over
  | 'stopped'; // reconnecting cannot help; needs a sign-in or a config fix

export type RealtimeStateDetail = { code?: number; reason?: string };

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

export type RealtimeClientOptions = {
  /** Mint a fresh single-use ticket. Rejecting with `{ status: 401 }` stops the client. */
  mintTicket: () => Promise<string>;
  onState?: (state: RealtimeConnectionState, detail?: RealtimeStateDetail) => void;
};

/** Derive `ws(s)://…/ws` from the REST base so the two can never drift apart. */
export function websocketUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws`;
  return url.toString();
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private state: RealtimeConnectionState = 'idle';
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private degradedTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  /** True once `welcome` arrived on the current socket; gates outbound subscribes. */
  private welcomed = false;

  /** Channels components want, refcounted so overlapping mounts cannot cancel each other. */
  private desired = new Map<string, number>();
  /** Auto-subscribed by the server on connect (`user:`, `agent:`, `role:`). */
  private granted = new Set<string>();
  /** Highest applied seq per channel — sent as `since` so the server can replay gaps. */
  private lastSeq = new Map<string, number>();
  /** Recent event ids, for dedupe across replay and duplicate delivery. */
  private seen = new Set<string>();
  private seenOrder: string[] = [];

  private handlers = new Map<string, Set<RealtimeEventHandler>>();

  constructor(private readonly options: RealtimeClientOptions) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.attempt = 0;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close(1000, 'client stop');
    this.socket = null;
    this.welcomed = false;
    this.granted.clear();
    this.setState('idle');
  }

  get connectionState(): RealtimeConnectionState {
    return this.state;
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.socket) return;
    if (this.state !== 'degraded') {
      this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting');
    }

    let ticket: string;
    try {
      ticket = await this.options.mintTicket();
    } catch (error) {
      // The axios interceptor already tried a token refresh behind this call,
      // so a 401 here means the session is gone — nothing left to retry with.
      if ((error as { response?: { status?: number } })?.response?.status === 401) {
        return this.setState('stopped', { reason: 'unauthenticated' });
      }
      return this.scheduleReconnect();
    }
    // Re-check after the await: a stop()/start() cycle while the ticket was
    // minting (StrictMode's dev double-mount, a fast account switch) may have
    // opened a newer socket that this stale attempt must not clobber.
    if (this.stopped || this.socket) return;

    // Subprotocol rather than `?ticket=` — it keeps the credential out of
    // access logs, proxy logs and browser history. The server accepts both.
    const socket = new WebSocket(websocketUrl(), [`realtime.ticket.${ticket}`]);
    this.socket = socket;

    // Every callback checks it still belongs to the current socket — events
    // from a replaced connection must not touch shared state.
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempt = 0;
      this.clearDegradedTimer();
      this.setState('connected');
    };
    socket.onmessage = (message) => {
      if (this.socket !== socket) return;
      try {
        this.onFrame(JSON.parse(message.data as string) as RealtimeServerFrame);
      } catch {
        // A malformed frame is the server's bug, not a reason to crash the socket.
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.onClose(event.code);
    };
    socket.onerror = () => {
      /* onclose always follows; handle it there */
    };
  }

  // ── Close handling ─────────────────────────────────────────────────────────

  private onClose(code: number): void {
    this.socket = null;
    this.welcomed = false;
    this.granted.clear();
    if (this.stopped) return;

    switch (code) {
      // Reconnecting with the same client or config cannot succeed.
      case CLOSE_PROTOCOL_ERROR: // client is older than the server
      case CLOSE_ORIGIN_REJECTED: // origin not on REALTIME_ALLOWED_ORIGINS
      case CLOSE_DISABLED: // real-time is off in this deployment
        return this.setState('stopped', { code });

      // We fell behind and events were dropped silently. Forget the seq cursors —
      // asking to replay from them would claim a continuity we no longer have.
      // The reconnect → 'connected' transition triggers the surfaces' refetch.
      case CLOSE_SLOW_CONSUMER:
        this.lastSeq.clear();
        return this.scheduleReconnect();

      // 4401/4402 (ticket rejected, credential outlived — routine at the hourly
      // lifetime cap) and everything else — 1000/1001/1006, 4408, 4409, 4429,
      // 4499 — all recover the same way: fresh ticket, reconnect with backoff.
      case CLOSE_AUTH_FAILED:
      case CLOSE_REAUTH_REQUIRED:
      default:
        return this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    if (this.state !== 'degraded') this.setState('reconnecting');
    this.startDegradedTimer();

    // Jitter matters: without it every client reconnects in lockstep after a
    // deploy and stampedes the server back down.
    const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.attempt);
    const delay = base * (0.5 + Math.random() * 0.5);
    this.attempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  // ── Frames ─────────────────────────────────────────────────────────────────

  private onFrame(frame: RealtimeServerFrame): void {
    switch (frame.type) {
      case 'welcome':
        if (frame.v !== PROTOCOL_VERSION) {
          // Stop for good — reconnecting cannot change the server's protocol,
          // and the flag keeps onClose from scheduling a futile retry loop.
          this.stopped = true;
          this.socket?.close(1000, 'protocol mismatch');
          return this.setState('stopped', { reason: 'protocol_version' });
        }
        frame.channels.forEach((channel) => this.granted.add(channel));
        this.welcomed = true;
        this.sendSubscribe();
        return;

      case 'subscribed':
        for (const [channel, status] of Object.entries(frame.replay)) {
          // The gap is older than the server's replay buffer. Drop the cursor;
          // the reconnect refetch has already made (or will make) us whole.
          if (status === 'refetch_required') this.lastSeq.delete(channel);
        }
        for (const rejection of frame.rejected) {
          // Not retryable — it means no. Stop asking.
          this.desired.delete(rejection.channel);
          console.warn(`[realtime] channel refused: ${rejection.channel} (${rejection.reason})`);
        }
        return;

      case 'event':
        return this.dispatch(frame.event);

      case 'ping':
        return this.send({ type: 'pong' });

      case 'error':
        console.warn(`[realtime] ${frame.code}: ${frame.message}`);
        return;

      case 'pong':
      case 'unsubscribed':
        return;
    }
  }

  private dispatch(event: RealtimeEvent): void {
    if (this.seen.has(event.id)) return; // replay or duplicate — already applied
    this.remember(event.id);

    const previous = this.lastSeq.get(event.channel) ?? 0;
    if (event.seq > previous) this.lastSeq.set(event.channel, event.seq);

    for (const handler of this.handlers.get(event.type) ?? []) handler(event);
    for (const handler of this.handlers.get('*') ?? []) handler(event);
  }

  private remember(id: string): void {
    this.seen.add(id);
    this.seenOrder.push(id);
    if (this.seenOrder.length > SEEN_EVENT_LIMIT) {
      this.seen.delete(this.seenOrder.shift()!);
    }
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  /** Ask for channels for as long as the caller holds the returned dispose. */
  subscribe(channels: string[]): () => void {
    const added: string[] = [];
    for (const channel of channels) {
      const count = this.desired.get(channel) ?? 0;
      this.desired.set(channel, count + 1);
      if (count === 0 && !this.granted.has(channel)) added.push(channel);
    }
    if (added.length) this.sendSubscribe(added);
    return () => this.unsubscribe(channels);
  }

  private unsubscribe(channels: string[]): void {
    const removable: string[] = [];
    for (const channel of channels) {
      const count = this.desired.get(channel) ?? 0;
      if (count <= 1) {
        if (this.desired.delete(channel)) removable.push(channel);
      } else {
        this.desired.set(channel, count - 1);
      }
    }
    if (removable.length && this.welcomed) {
      this.send({ type: 'unsubscribe', channels: removable });
    }
  }

  /**
   * Send wanted channels with our last seen seq so the server can replay gaps.
   * With no argument (the welcome path) this also re-asks auto-granted channels
   * we hold a cursor for — re-subscribing a granted channel is accepted and is
   * the only way to get the `user:` stream replayed after a drop.
   */
  private sendSubscribe(only?: string[]): void {
    if (!this.welcomed) return; // welcome re-sends everything anyway
    const channels = only
      ? only.filter((channel) => !this.granted.has(channel))
      : [
          ...new Set([
            ...[...this.desired.keys()].filter((channel) => !this.granted.has(channel)),
            ...[...this.granted].filter((channel) => this.lastSeq.has(channel)),
          ]),
        ];
    if (!channels.length) return;

    const since: Record<string, number> = {};
    for (const channel of channels) {
      const seq = this.lastSeq.get(channel);
      if (seq !== undefined) since[channel] = seq;
    }
    this.send({ type: 'subscribe', channels, since });
  }

  /** Register a handler for one event type (or `'*'`). Returns the unregister. */
  on(type: string, handler: RealtimeEventHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  private send(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private setState(state: RealtimeConnectionState, detail?: RealtimeStateDetail): void {
    if (this.state === state) return;
    this.state = state;
    this.options.onState?.(state, detail);
  }

  private startDegradedTimer(): void {
    if (this.degradedTimer) return;
    this.degradedTimer = setTimeout(() => this.setState('degraded'), DEGRADED_AFTER_MS);
  }

  private clearDegradedTimer(): void {
    if (this.degradedTimer) clearTimeout(this.degradedTimer);
    this.degradedTimer = null;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.clearDegradedTimer();
  }
}
