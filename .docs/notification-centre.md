# Notification centre (Web)

## Scope

Frontend for Task 10. Covers the in-platform notification centre: the header bell, the
full history page, read/unread state, timestamps, and the deep links that take a
notification back to the showing it refers to.

Email templates and the code that creates notification rows live in the API and are out
of scope for this doc.

---

## Status

Complete and live. The UI calls `/notifications/*` directly, gated only on having a
session. Nothing is mocked and there is no feature flag.

All five endpoints are deployed, and the response shapes were verified field-by-field
against the API's OpenAPI schema — `NotificationRead`, `NotificationUnreadCount`,
`NotificationMarkAllReadResponse` and `PaginatedItems_NotificationRead_` all match
`types/api.ts` exactly, including every nullable field.

---

## What already existed

- **Showing emails** (API). Acknowledgement, confirmation, and reschedule mail for both
  client and agent, sent through `SmtpMailer`. No-ops unless `SMTP_*` env is set.
- **Communication preferences.** `PrivacyPreferencesSection` on `/profile`, three toggles
  backed by `GET/PATCH /users/me/privacy`. See `.docs/privacy-account.md`.
- **The events to hang notifications off.** Showing create, confirm, reschedule, and the
  agent's ID-verification review.

There was no in-platform notification centre of any kind before this task.

---

## Surfaces

| Where | Component |
|---|---|
| Public site header | `NotificationBell` in `components/NavBar.tsx` |
| Agent / admin header | `NotificationBell` in `components/portals/PortalHeader.tsx` |
| Full history | `/notifications` → `components/notifications/NotificationsPageView.tsx` |

Bell behaviour:

- Renders nothing without a session. Rows are keyed to a user, so anonymous visitors have
  none. Anonymous showing requests are still acknowledged by email.
- `NotificationPanel` is a `next/dynamic` import. `NavBar` is in the root layout, so a
  static import would ship the panel, the rows and `ConfirmDialog` in the chunk every
  route loads. Keep it dynamic.
- Opening the panel resets the **Unread only** filter. The store outlives the
  `/notifications` page, and the dropdown has no filter control to undo it with.
- Badge polls `unread-count` every 60s (`UNREAD_POLL_MS`), cleared on unmount, and also
  refreshes on `visibilitychange` so a backgrounded tab is not a minute stale. No
  websocket or SSE.
- Opening the panel loads page 1. It does not mark everything read.
- Closes on outside click and on Escape.

The full page adds an **All / Unread** filter, **Mark all as read**, and **Load more**
past 20 rows. Signed out, it shows a sign-in link instead.

---

## API endpoints

All authenticated. `lib/axios.ts` attaches the Bearer token and handles the 401 refresh.

| Method | Path | Wrapper in `services/notificationService.ts` |
|---|---|---|
| `GET` | `/notifications/` | `fetchMyNotifications(page, size, unreadOnly)` |
| `GET` | `/notifications/unread-count` | `fetchUnreadNotificationCount()` |
| `POST` | `/notifications/{id}/read` | `markNotificationRead(id)` |
| `POST` | `/notifications/read-all` | `markAllNotificationsRead()` |
| `DELETE` | `/notifications/{id}` | `dismissNotification(id)` |

Notes for whoever builds the API side:

- The client sends the trailing slash on `/notifications/` on purpose. If `/notifications`
  answers 307, some proxies drop the `Authorization` header across the redirect. The other
  four paths take no trailing slash.
- `read-all` should return `{ updated }`, the number of rows that were actually unread, so
  a second call returns 0. It is not an unread count.
- A notification belonging to another user should return 404, not 403. A 403 confirms the
  row exists.

---

## Event types

`event_type` is typed `NotificationEventType | string` so the API can add values without
a frontend release.

- `title` and `body` carry all display copy. Nothing in the UI switches on the type for
  required text.
- `event_type` picks the icon and tone only, through `notificationVisual()` in
  `components/notifications/notificationMeta.ts`. Unknown types fall back to a neutral
  bell.
- `payload_json` is for badging and filtering, not display. Read it defensively; its keys
  are only guaranteed per event type.

The representative set for this task:

| Type | Trigger | Recipient |
|---|---|---|
| `showing.requested` | Client submits a showing request | Agent |
| `showing.confirmed` | Agent confirms it | Client |
| `showing.rescheduled` | Agent moves the time | Client |
| `report.status_updated` | ID-verification review outcome | Client |

`category` is `transactional` for all four, so it is a plain string rather than a union.

---

## Read / unread, delete, and timestamps

- Unread rows get a tinted background, a bold title, and a dot with an `sr-only` "Unread"
  label, so the state is never colour alone.
- `is_read` is the server-computed flag the UI reads. Optimistic updates write `is_read`
  and `read_at` together so the two cannot drift.
- Timestamps render through `lib/relativeTime.ts` (`just now`, `12m ago`, `3h ago`,
  `2d ago`, absolute date past a week) inside a `<time dateTime>` with the full timestamp
  as its tooltip.
- `markRead`, `markAllRead`, and `dismiss` are optimistic. On failure they roll back only
  the affected row, never the whole list, which would resurrect rows that changed in the
  meantime.
- Marking read should be idempotent server-side, so a duplicate click is harmless.
- Delete is a soft delete with no undo, so the × opens a `ConfirmDialog` first. The
  confirm state lives in `NotificationItem`, so the dropdown and the full page get the
  same prompt from one implementation.

### 404 means gone, not impossible

A 404 is expected for a row that belongs to someone else or was already deleted, so
`isGone()` in `stores/notificationStore.ts` treats any 404 as "stop showing this" and
drops the row from local state instead of raising. Double-clicking delete lands here and
is silently correct.

---

## Deep links

`deep_link` is a relative web-app path, rendered with `next/link`. Never prefix it with
the API base URL.

| Recipient | `deep_link` | Target |
|---|---|---|
| Client | `/profile?showing=<uuid>` | `ClientShowingScheduleSection` |
| Agent | `/agent/showings?showing=<uuid>` | Agent showing queue |

There is no per-showing detail route on either side, so links land on the list page that
holds the relevant section and identify the row by query param.

`lib/useShowingDeepLink.ts` resolves `?showing=<uuid>`, scrolls the matching row into view
once the list has loaded, and returns the id so the caller can highlight it. Rows opt in
by carrying `id={showingAnchorId(request.id)}`:

- `ClientShowingScheduleSection` — ring on the matching card
- `app/agent/showings/page.tsx` — tinted table row (`highlightId` prop on `ShowingTable`)

Both consumers use `useSearchParams`, so each is wrapped in a `Suspense` boundary: the
schedule section inside `ProfilePageView`, the agent queue via a `Content` + `Suspense`
split in the page file. Without those, `next build` deopts the routes out of static
prerendering. Both still show as `○ (Static)` in the build output.

`ClientShowingScheduleSection` also keeps `id="showing-schedule"`, and the hash-scroll
effect in `ProfilePageView` now resolves any hash to a matching section id, so
`/profile#showing-schedule` and `#saved-homes` both still work.

Changing the param name is a cross-repo change. The API builds these paths, and rows
already in the database keep their stored paths regardless.

---

## Modal gotcha worth knowing (`ConfirmDialog`)

Two constraints that fight each other. Both are already handled, so don't "simplify"
either away:

1. **The dialog must be portalled to `<body>`.** `NavBar`'s header is
   `sticky ... backdrop-blur`, and `backdrop-filter` creates a containing block for
   `position: fixed` descendants. A dialog rendered inline inside the bell centres itself
   in the header and gets clipped, with no full-viewport backdrop. The markup looks
   correct until you open it.
2. **But portalling breaks the dropdown's outside-click.** `NotificationBell` closes on
   any `mousedown` outside its container, and a portalled dialog is outside it, so
   clicking **Delete** would close the panel and unmount the dialog mid-decision.

What resolves it: the dialog's overlay carries `data-modal-root="true"`, and
`NotificationBell` skips both its outside-click and its Escape handler when the event
comes from inside a modal root. Any future dropdown hosting a portalled modal needs the
same two guards.

---

## Communication preferences

Unchanged by this task. `PrivacyPreferencesSection` still shows the same three flags:
`marketing_emails_enabled`, `listing_alerts_enabled`, `product_updates_enabled`.

There is no per-event-type preference and no notification mute. All four types are
transactional and are always delivered regardless of those flags. An earlier iteration
had a fourth "Appointment updates" toggle backed by `users.showing_updates_email_enabled`;
that column was never shipped and the API doc rules it out, so the toggle and its optional
type field were removed rather than left hidden. Don't re-add a control implying a user
can mute showing updates without agreeing the column and the API behaviour first.

---

## Store shape

`stores/notificationStore.ts`, zustand with `devtools`, no `persist`. Unread state is
server-owned, and a stale copy in `localStorage` would show a wrong badge after another
device marks things read.

State: `items`, `unread`, `total`, `page`, `unreadOnly`, `loading`, `loadingMore`,
`error`, `loaded`.

Actions: `loadFirstPage`, `loadNextPage`, `loadUnreadCount`, `setUnreadOnly`, `markRead`,
`markAllRead`, `dismiss`, `reset`.

- `unread` is owned by `loadUnreadCount` alone. Counting page 1 would undercount when
  unread rows sit further down the list.
- `loaded` gates the empty state so "No notifications yet" cannot flash before the first
  fetch settles.
- `reset()` is called from `NavBar.handleLogout` and `PortalHeader.handleLogout` so one
  user's notifications never survive into another session.
- A failed badge poll is swallowed. The next tick retries.
- Page size is 20.

---

## Files

**New**

- `lib/relativeTime.ts` — `formatRelativeTime`, `formatAbsoluteTime`
- `lib/useShowingDeepLink.ts` — `?showing=` resolution, scroll, and `showingAnchorId`
- `services/notificationService.ts` — the five endpoints above
- `stores/notificationStore.ts` — list, badge, optimistic mutations, 404 handling
- `components/notifications/` — `NotificationBell`, `NotificationPanel`,
  `NotificationItem`, `NotificationsPageView`, `notificationMeta.ts`
- `components/common/ConfirmDialog.tsx` — general-purpose, not notification-specific.
  Lives in `common/` because `components/ui/` holds generated shadcn primitives and no
  shadcn `dialog` is installed. See the modal note above
- `app/notifications/page.tsx`, `app/notifications/layout.tsx`

**Edited**

- `types/api.ts` — `NotificationEventType`, `AppNotification`,
  `NotificationUnreadCount`, `NotificationMarkAllReadResponse`
- `components/NavBar.tsx`, `components/portals/PortalHeader.tsx` — mount the bell, reset
  the store on logout
- `components/profile/ClientShowingScheduleSection.tsx` — deep-link anchors + highlight
- `components/profile/ProfilePageView.tsx` — generalised hash scrolling, `Suspense` boundary
- `app/agent/showings/page.tsx` — deep-link anchors + highlight, `Suspense` split

---

## What remains

Nothing on the frontend. Two open items, both backend, tracked here only because they
change what this UI shows:

- **Sensitive data in email.** Agent mail carries the client's email, phone, and
  free-text message in plain SMTP; client mail carries the agent's email. The fix is to
  cut those and link to the portal instead, which is what this centre makes possible.
  Unverified against the deployed build — the notification code that is live is not
  present in `lucy-charm-api` on `origin/main`, so it could not be reviewed.
- **Emitter coverage.** The four event types below are what this UI renders. Whether all
  four actually fire, and whether `report.status_updated` has a producer, needs checking
  against whatever branch the deployed API was built from.

---

## Local testing

Needs the API endpoints first. Point `NEXT_PUBLIC_API_URL` at the API, sign in, then:

1. Bell shows a badge; open it and expect rows newest first, unread visually distinct
2. Click a row → it marks read, the badge drops, and it lands on `/profile?showing=<uuid>`
   with the matching showing scrolled into view and ringed
3. As an agent, a `showing.requested` row lands on `/agent/showings?showing=<uuid>` with
   the matching table row tinted
4. **Mark all as read** → badge disappears; reopen and rows stay read
5. Delete a row with the × → a confirmation appears; Escape or **Keep** leaves the row
   alone, **Delete** removes it. Delete the same row twice fast and no error surfaces
6. Open `/notifications` → **Unread** filter, then **All**; **Load more** appears past 20 rows
7. Sign out → the bell disappears and `/notifications` shows the sign-in CTA
8. Background the tab for a minute, then return → the badge refreshes on focus
