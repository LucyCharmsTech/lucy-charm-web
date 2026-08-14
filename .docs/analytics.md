# Analytics & visitor tracking (Task 17, reduced scope) — frontend

Consent-gated PostHog tracking plus the agent's own response-time card.
Backend counterpart: `lucy-charm-api/.docs/agent-insights.md`.

Client's reduced scope: PostHog visitor tracking + the "visitor chats with AI →
becomes a lead → reaches an agent" journey, and agents seeing their response
times. **Out of this phase:** error tracking (client cut it globally), the
feedback feature, PostHog panels embedded in our admin Insights page, and the
baseline snapshot document (needs live traffic first).

---

## The two data worlds — do not blur them

| | PostHog | Our database |
|---|---|---|
| Holds | Anonymous behaviour: pages, searches, journey milestones | Leads, showings, scores, agent performance |
| Contains PII | **Never** | Yes (names, emails, chat text) |
| Gated by cookie consent | Yes | No — declining costs zero business data |
| Source of truth for | Traffic, funnels, drop-off (directional; consent-limited) | Every business number (exact) |

Where the two overlap, the database wins. That rule is what keeps "how many
leads did we get" answerable even when half the visitors decline cookies.

## Consent

`lib/analytics.ts` owns everything:

- `initAnalytics()` — loads posthog-js **only** after an explicit accept and
  only when `NEXT_PUBLIC_POSTHOG_KEY` is set. Idempotent.
- `track(event, props?)` — safe no-op without consent/key/init, and swallows
  its own errors. A tracking failure must never surface in a product flow.
- Consent doubles as an external store (`subscribeToConsent`,
  `getConsentSnapshot`, `getConsentServerSnapshot`) so the banner reads it via
  `useSyncExternalStore`: no setState-in-effect, no hydration mismatch. The
  server snapshot is `'unknown'`, which keeps the banner out of prerendered
  HTML — that is why every route stays `○ (Static)`.
- Choice persists in localStorage under `lucy-analytics-consent`; the banner
  (`components/common/CookieConsentBanner.tsx`, dynamic-imported from
  `Providers`) never re-appears once chosen.

**`autocapture` is deliberately off.** We send the named events below and
nothing else — autocapture would hoover up button text and form context, which
is exactly the PII we promised never to send.

## Audience segment (signed-in vs not)

Every event automatically carries two properties, merged in by `track()` so no
call site passes them:

| Property | Values |
|---|---|
| `is_authenticated` | `true` / `false` |
| `user_role` | `visitor` (signed out) / `client` / `agent` / `superadmin` |

`setAnalyticsAudience(role)` is called from `AnalyticsPageviews` in `Providers`
whenever the auth store changes, so it stays correct across login, logout, and
session hydration.

Two uses: answering "how many visitors are signed in versus not", and
**filtering staff out of visitor numbers** in PostHog (exclude
`user_role = agent` / `superadmin`), which otherwise inflates traffic every
time the team clicks around.

**This is a segment, never an identity.** No user id, email, or name is sent,
and `posthog.identify()` is never called — deliberately, because identifying
people would make analytics data linkable to accounts and would contradict what
the client was told. Tests in `__tests__/analytics/audience.test.ts` fail if
either rule is broken. Per-user journeys and cohorts would need that step and
should be raised with the client as its own decision.

## Events

| Event | Where it fires | Props |
|---|---|---|
| `$pageview` | `AnalyticsPageviews` in `Providers` (App Router `usePathname`) | path |
| `search_performed` | `app/listings/page.tsx` → `updateSearchParam` | `city` or `country` |
| `listing_viewed` | `ListingDetailInteractiveShell` mount | `listing_id` |
| `listing_saved` | `SaveListingButton`, after a confirmed save (both API and mock paths) | `listing_id` |
| `chat_opened` | Listing widget open; `/chat` page mount | `listing_id` / `surface` |
| `chat_started` | First user message of a session (ref-guarded, not message-count) | `listing_id` / `surface` |
| `chat_escalated` | Response arrives with `escalation_flag` | `listing_id` / `surface` |
| `showing_requested` | `RequestShowingModal` success | `listing_id` |
| `signup_completed` | Onboarding wizard submit success | — |

**The client's funnel** is `$pageview → chat_started → chat_escalated`. The
honest definition, which belongs in any client-facing explanation: for chat
journeys the escalation **is** the lead-creation and agent-handoff moment (it
creates the lead and, on listing chats, its assigned agent), so one event marks
both of those funnel steps. `showing_requested` is the parallel high-intent
conversion. "Visitors who took no action" is the `$pageview`-only segment.

All events are frontend-side. No backend→PostHog integration exists (or is
needed): every funnel step is already visible to the browser, which keeps
PostHog PII-free by construction and needs no server key.

## Agent response times

`components/agent/AgentResponseTimeCard.tsx` on `/agent`, fed by
`fetchMyAgentInsights()` → `GET /agents/me/insights`. Shows average / fastest /
slowest time to confirm a showing, and how many were measured. **Database, not
PostHog** — the numbers are per-agent and role-scoped on the server. Durations
render coarse (`3h 12m`, `2d 4h`); seconds would be noise.

Empty state is expected for a new agent, and escalation response times are
absent on purpose: nothing assigns escalations to agents yet (that is separate
from Task 6's lead assignment), so the metric would always read zero.

## Tests

`__tests__/analytics/`:

- `analytics.test.ts` — declining never loads PostHog or sends events,
  `track()` is a safe no-op before init, consent subscribers fire on change,
  the choice persists.
- `CookieConsentBanner.test.tsx` — shows only to first-time visitors, hides and
  records on accept/decline, never re-appears.
- `audience.test.ts` — defaults to anonymous visitor, resets on sign-out, each
  role marked authenticated, the segment rides on every event, and the two
  hard rules: no PII in the properties and `identify()` never called.

Run: `npx jest __tests__/analytics`.

## Setup

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...                 # project key — write-only, safe in the browser
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or eu.i.posthog.com, must match the account region
```

Nothing needs pre-creating inside PostHog — it accepts new event names on
sight. After a day of traffic, assemble one dashboard there (funnel + traffic +
top pages + session duration); that is presentation, not setup.
