# Realtime updates (WebSocket)

Live UI updates over the API's WebSocket channel — notifications, listings, and
showing requests change on screen without a reload, across every open session.
Backend counterpart: `lucy-charm-api/app/api/realtime/` (wire contract in
`app/api/realtime/models.py`).

## Mental model

Three rules, all inherited from the wire contract:

1. **The socket is an accelera¯tor, never a data source.** Every surface still
   renders from its REST call; events only make what is already on screen
   change sooner. With the socket down (or `REALTIME_ENABLED=false` server-side)
   the app works exactly as before.
2. **Events are at-least-once — apply idempotently.** The client dedupes on
   `event.id`, but the API also publishes one logical change to several
   channels with *distinct* ids (an agent hears a showing change on both
   `user:` and `agent:`), so handlers merge by field and never append or
   increment blindly.
3. **Your own actions echo back.** The server does not filter the actor — that
   is what keeps a user's other tabs in sync. The echo of an optimistic update
   must be a no-op, which field-merging gives for free.

## Connection

A browser cannot set an `Authorization` header on a WebSocket upgrade, so
connecting is two steps: `POST /ws/ticket` (Bearer, via the shared axios
instance) mints a 30-second single-use ticket, then the socket opens against
`ws(s)://…/api/v1/ws` carrying the ticket as a `realtime.ticket.<value>`
subprotocol — never in the query string, which would leak it into logs. A fresh
ticket is minted for **every** attempt; token freshness is the axios refresh
interceptor's job, so the realtime code never touches tokens.

The socket URL derives from `NEXT_PUBLIC_API_URL` — there is no second env var
to drift out of sync. Before production, backend's `REALTIME_ALLOWED_ORIGINS`
must include the web origin (it ships as `*`; once tightened, a missing origin
closes with 4403).

Reconnects use exponential backoff with jitter, capped at 30s. Close codes
branch three ways: 4400/4403/4404 stop the client (retrying cannot help),
4410 (slow consumer) drops the replay cursors before reconnecting, everything
else — including the routine hourly 4402 lifetime cap — just reconnects with a
fresh ticket.

**Transport reality check (verified against the live server):** the API sends
4401/4403/4404/4409 by closing *before* accepting the upgrade, which uvicorn
turns into an HTTP 403 — a browser sees a generic handshake failure (1006-ish),
never those codes. So in practice a disabled or origin-rejected deployment
lands the client in `degraded` (chip + REST fallback polling + capped retries),
not `stopped` — the app stays fully functional either way, verified in Chrome.
The `stopped` branches still matter for post-accept closes and protocol
mismatch. If backend ever wants clients to give up cleanly on 4403/4404, the
server must accept-then-close so the code actually reaches the browser.

## Files

| File | Role |
|------|------|
| `services/realtimeService.ts` | `POST /ws/ticket` |
| `lib/realtime/client.ts` | Transport: socket, backoff, dedupe, seq cursors, subscriptions. Framework-free |
| `lib/realtime/channels.ts` | Channel name builders (`user:`, `listing:`, `feed:listings`, …) |
| `lib/realtime/singleton.ts` | The one client per tab, wired to the store |
| `lib/realtime/hooks.ts` | `useChannels`, `useRealtimeEvent`, `useRefetchOnReconnect`, `useRestFallback` |
| `stores/realtimeStore.ts` | Connection state for rendering (chip, fallback polling). Not persisted |
| `components/realtime/RealtimeManager.tsx` | Starts/stops the client on sign-in/out. Mounted in the root layout |
| `components/realtime/ConnectionStatus.tsx` | Quiet chip while reconnecting; banner when live updates are off |
| `types/api.ts` § Realtime | Envelope, server frames, and every event payload, mirroring the API |

## Consumers

- **Notifications** — `components/notifications/useLiveNotifications.ts`
  (registered once, in `NotificationBell`) routes `notification.*` events into
  `notificationStore` via the `applyRealtime*` actions. Events ride the
  auto-granted `user:{me}` channel and carry the recomputed `unread_count`
  (null means the recount failed — keep the previous value, never render 0).
  The bell's unread poll now runs only in REST fallback (30s); a visible-again
  refresh stays as a safety net.
- **Listings index** (`app/listings/page.tsx`) — subscribes `feed:listings`
  when PROPTX is live. `listing.updated` replaces the row from the event's full
  read model; `listing.deleted` drops it; `listing.created` refetches silently
  because the event cannot know the current filters. Rows outside the filters
  simply aren't present — those misses are ignored, never re-filtered
  client-side.
- **Listing detail** (`ListingDetailLiveUpdates`, mounted for UUID listings) —
  subscribes `listing:{id}`; updates call `router.refresh()` (the page's
  `serverFetch` runs with `revalidate: 0` so the refresh cannot serve the
  pre-change value; the route was already dynamic), deletion redirects to
  `/listings`.
- **Showing requests** — `lib/useLiveShowingRequests.ts`, shared by the agent
  queue and the client schedule section, which hold the same `ShowingRequest[]`
  state. Status/schedule/ID-verification/feedback events merge into the row;
  `showing.withdrawn` removes it; a `previous_status: null` event is a
  brand-new request the wire cannot build (no buyer fields), so the list
  refetches — debounced 300ms to coalesce the multi-channel duplicates. While
  the socket is down the hook polls every 30s and refreshes on tab visibility.

## Degradation and recovery

- `reconnecting` → 15s grace → `degraded`: `useRestFallback()` turns true and
  the polling surfaces take over. `stopped` (origin rejected, realtime
  disabled, protocol mismatch, session gone) behaves the same, plus the status
  banner.
- **Every reconnect triggers a refetch** (`useRefetchOnReconnect`) on live
  surfaces. This blanket rule is why `refetch_required` replay verdicts and
  4410 drops need no special handling — both end in a reconnect, and the
  refetch reconciles whatever the finite replay buffer could not.
- The client re-asks granted channels it holds a seq cursor for on reconnect,
  so short drops usually replay missed `user:` events before the refetch even
  lands; dedupe by `event.id` makes the overlap harmless.

## Sensitive fields never ride the wire

Payloads carry ids, statuses and display copy only. Reviewer notes, feedback
comments and contact details stay behind authenticated REST reads — matching
`notifications/redaction.py`. Anything needing that detail refetches behind the
deep link.

## Not wired (deliberately)

- `lead.assigned` / `lead.status_changed` are reserved in the contract but the
  API publishes nothing yet (backend task 6). The admin surfaces poll as before.
- `/admin/showings` — showing events go to participants' channels, not
  `role:superadmin`, so there is nothing to subscribe to there yet.
- No `SharedWorker` socket sharing. The per-user cap is 8 connections; a user
  with nine tabs sees 4409 on the ninth, which backs off and retries. Revisit
  only if support actually sees it.

## Manual test checklist

The automated half — Jest over the client state machine, stores, and hooks —
is catalogued in [`realtime-testing.md`](./realtime-testing.md) (`npm test`).
This checklist covers what unit tests cannot: two sessions and a live socket.
Mirrors `lucy-charm-api/tests/integration/test_realtime_ws.py`.

- [ ] Two tabs, same user: trigger a notification — both bells increment once,
      no refresh. A third tab as another user sees nothing.
- [ ] Agent edits a listing price/beds — buyer's open detail page and the
      `/listings` grid update in place; soft-delete redirects the detail page.
- [ ] Agent confirms/reschedules — buyer's profile schedule updates live.
      Buyer uploads an ID — agent's queue flips to "Review ID" live.
- [ ] DevTools offline 30s — chip shows "Reconnecting…", socket returns by
      itself, missed changes appear exactly once (no duplicate rows).
- [ ] `REALTIME_ENABLED=false` on the API — banner appears, every page still
      works, badge/lists refresh on the 30s polls.
- [ ] Leave a tab open past an hour — it re-tickets and reconnects silently
      (4402 is routine, not a bug).
