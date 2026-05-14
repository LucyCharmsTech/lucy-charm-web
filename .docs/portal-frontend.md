# Agent and admin portals

## Purpose

Internal users with roles **agent** and **superadmin** get **separate route trees** after authentication—not a single app with role tabs. The public marketing site (`/`, `/listings`, …) stays unchanged; portals live under **`/agent`** and **`/admin`**.

## Role detection and redirect

1. After login or register, the client calls **`GET /users/me`** (`userService.fetchCurrentUser`) to load the canonical profile, including **`role`**.
2. `getPostLoginPath` in `lib/postLoginRedirect.ts` sends:
   - **agent** → `/agent`
   - **superadmin** → `/admin`
   - **client** (default) → `/` or a safe `redirect` query when allowed
3. **`AuthHydrator`** (mounted in `app/layout.tsx`) refetches `/users/me` when a refresh token exists but `user.role` is missing (e.g. older persisted session).

## Route map

| Area | Routes | Guard |
|------|--------|--------|
| Agent | `/agent`, `/agent/listings`, `/agent/listings/[id]` | `RoleGate` with `allowed="agent"` in `app/agent/layout.tsx` |
| Superadmin | `/admin`, `/admin/insights`, `/admin/inquiries`, `/admin/inquiries/[leadId]`, `/admin/chat-logs`, `/admin/listings`, `/admin/listings/[id]`, `/admin/showings` | `RoleGate` with `allowed="superadmin"` in `app/admin/layout.tsx` |

Wrong role or anonymous users are redirected (login with `redirect`, or the other portal’s home via `getPostLoginPath`).

## Data loading

- **Agent dashboard / listings**: `fetchMyAgentProfile` → `fetchListingsByAgentId(agent.id)` (`portalService.ts`).
- **Admin catalog**: `fetchAllListingsAdmin` (paginated `GET /listings/`).
- **Superadmin operations** (`superadminService.ts`):
  - **Insights**: `GET /superadmin/insights/dashboard` — funnel, intents, CTAs, top listings, handoff timing.
  - **Inquiries**: paginated `GET /leads/`, single `GET /leads/{id}`; notes/tags under `GET/POST/DELETE /superadmin/leads/{id}/internal-notes` and `…/tags`.
  - **Chat logs**: paginated `GET /ai_sessions/` and `GET /ai_messages/`; thread load via `GET /ai_messages/session/{session_id}`.
- **Agent / admin listing grids**: `ListingCard` accepts optional **`insightsHref`** and **`insightsLabel`** so the portal CTA (client activity / insights) is a **second button under View Details** on each card—not a separate link below the card.
- **Listing detail (both portals)**: `fetchListingById` + **`ListingInsightsSection`** → `GET /agents/me/listings/{id}/client_intents` (backend authorises agent and superadmin).
- The **Chat summary** column is `latest_summary` from `conversation_summaries` (rolling transcript summary), not the listing’s marketing **`ai_summary`**. It is populated when the API saves a summary after chat turns (see `CHAT_AUTO_SUMMARY_AFTER_TURN` in the API config).

## UI chrome

- **`NavBar`** returns `null` on `/agent` and `/admin` so portals use their own header.
- On the **public** site, signed-in **agents** see an **Agent workspace** item and **superadmins** see **Admin console** in the main nav (desktop and mobile), so they can jump back to their portal without opening the account menu.
- **`PortalHeader`**: brand link, portal title, sign out.
- **`PortalSidebar`**: responsive horizontal scroll on small screens, vertical nav on `md+`. **Active tab** uses longest-prefix matching so **Overview** (`/admin`, `/agent`) is not highlighted when you are on **All listings** / **My listings** (`/admin/listings`, …).

## Related API

- **`GET /users/me`** — current user (`UserRead` including `role`); used for redirects and guards.
- **`GET /agents/me`** — agent profile for users linked to an agent record.

## Local testing checklist

1. Apply API migrations and seed users with distinct roles.
2. Sign in as an **agent** → expect landing on **`/agent`** and only assigned listings.
3. Sign in as **superadmin** → expect **`/admin`** and full listing catalog.
4. Open **Insights**, **Inquiries** (open a lead for notes/tags), and **Chat logs**; confirm data or empty states.
5. Open a listing detail in each portal and confirm **client activity** loads or shows an empty state.
