# Realtime — tests and scope

Companion to [`realtime.md`](./realtime.md): what already existed before the
realtime task, what the task actually added to this repo, and the Jest suite
that pins the added behaviour down.

## What already existed (not built here)

**Backend (`lucy-charm-api`, its own commit and 43 tests).** The entire server
side: `POST /ws/ticket`, the `GET /ws` socket, channel taxonomy and
deny-by-default authorization, the in-memory/Redis backplane with per-channel
`seq` and replay buffer, heartbeats, connection caps, close codes — and the
producers that publish notification, listing, and showing events. The frontend
consumes this; none of it lives in this repo.

**Frontend surfaces the realtime layer plugs into (earlier tasks).** The
notification centre (`notificationStore`, bell, panel, `/notifications` page,
its 60s polling), the showings surfaces (`/agent/showings` queue, profile
`ClientShowingScheduleSection`, ID upload/review, feedback dialog), the
listings grid and server-rendered detail page, and the auth stack (`authStore`,
axios instance with 401-refresh interceptor). These already rendered from REST;
they did not update live.

## What this task built (all frontend)

| Piece | Files |
|---|---|
| Wire types mirroring the API | `types/api.ts` § Realtime |
| Ticket service | `services/realtimeService.ts` |
| Transport client (backoff, dedupe, seq/replay, close-code branching) | `lib/realtime/client.ts` |
| Channel builders, singleton, React hooks | `lib/realtime/channels.ts`, `singleton.ts`, `hooks.ts` |
| Connection state store + lifecycle manager + status chip | `stores/realtimeStore.ts`, `components/realtime/` |
| Notification live-apply (idempotent store actions + bell rewire, poll → fallback-only) | `stores/notificationStore.ts`, `components/notifications/useLiveNotifications.ts`, `NotificationBell.tsx` |
| Showings live-apply, shared by both surfaces | `lib/useLiveShowingRequests.ts` + wiring in the agent page and profile section |
| Listings live-apply (grid patch/refetch, detail `router.refresh` + `revalidate: 0`) | `app/listings/page.tsx`, `components/listings/detail/ListingDetailLiveUpdates.tsx` |
| This Jest suite | `__tests__/realtime/`, `jest.config.mjs` |

## Running the tests

```bash
npm test          # jest — 54 tests across 4 suites, no network, no backend
```

Jest runs through `next/jest` (SWC, jsdom, `@/` alias mapped in
`jest.config.mjs`). The suite needs nothing running — the socket is a mock; the
tests exercise this repo's state machine and stores, not the server (the server
has its own suite in `lucy-charm-api/tests/`).

## Test catalog

### `client.test.ts` — the transport state machine (mocked socket)

| Covers | Acceptance criterion it pins |
|---|---|
| Ticket minted per attempt, offered as `realtime.ticket.<t>` subprotocol, never in the URL | auth handshake |
| `connecting → connected` transitions; fresh ticket on every reconnect | automatic reconnect |
| Ticket mint 401 → `stopped` (session gone); transient mint failure → backoff retry | reconnect vs. give-up |
| Subscribes held until `welcome`, then sent with `since`; auto-granted channels never re-requested blind | user-specific channels |
| Refcounted subscribe/unsubscribe — two holders, one wire subscription | no duplicate traffic |
| Server-refused channels are dropped and never re-requested | authorization respected |
| Event dispatch dedupes on `event.id` (replays and duplicates apply once) | duplicate events |
| Reconnect re-subscribes with the last applied `seq` — including auto-granted `user:` cursors | gap replay |
| `ping` → `pong` | connection health |
| 4400/4403/4404 → `stopped`, zero retries; 4401/4402/1006/4499 → reconnect; 4410 forgets cursors | close-code contract |
| Protocol-version mismatch stops for good (no reconnect loop) | forward compatibility |
| 15s down → `degraded`, later failures don't flap the state; `stop()` ends everything | offline fallback trigger |

### `notificationStore.test.ts` — realtime appliers

Prepend-once with the server-recomputed badge; duplicate/replayed `created` is
a no-op; badge-only updates before the first list fetch; `unread_count: null`
(failed recount) keeps the previous badge — except `read_all`, where zero is
correct by definition; `read`/`dismissed` merge idempotently and no-op for rows
this tab never had.

### `hooks.test.tsx` — the policies in the React bindings

`useChannels` subscribes for the mount lifetime; `useRealtimeEvent` keeps the
handler fresh without resubscribing and unregisters on unmount;
`useRefetchOnReconnect` fires on reconnecting/degraded → connected but never on
the first connect; `useRestFallback` is true exactly for `degraded` and
`stopped`.

### `useLiveShowingRequests.test.tsx` — the shared showings wiring

Status changes merge into the row (echo-safe); reschedules stamp
`rescheduled_at`; a `previous_status: null` (brand-new request) refetches, and
the multi-channel duplicates of one change coalesce into a single debounced
refetch; withdrawal removes the row; ID upload and review outcomes patch the
verification state both directions; feedback lands as structured fields only;
in `degraded` the hook polls every 30s, stops when connected, and refreshes
when a hidden tab becomes visible.

## What Jest deliberately does not cover

Real sockets, two browsers, and the running backend — Jest mocks the wire.
Cross-session behaviour ("agent confirms → buyer's open page changes") was
verified against the live dev stack in real Chrome during development, and the
repeatable manual walkthrough lives in `realtime.md` § Manual test checklist.
The server half (authorization, replay buffer, caps, ticket reuse) is covered
by `lucy-charm-api/tests/integration/test_realtime_ws.py`.
