# API Integration

## Overview

The frontend connects to the **lucy-charm-api** FastAPI backend (`http://localhost:8000/api/v1` by default). All live data is fetched from the backend; mock data is retained as a fallback so the UI never breaks if the API is unreachable.

---

## Environment variable

| Variable | Default | Used in |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | `lib/axios.ts`, `lib/serverFetch.ts`, `services/chatService.ts` |
| `NEXT_PUBLIC_PROPTX_LIVE` | `true` (live mode) | `lib/proptxMode.ts`, listings + saved homes flows |

Set this in `.env` (or `.env.local`) before starting the dev server.

---

## Architecture

### Server components (SSR / ISR)
- Use **`lib/serverFetch.ts`** — a thin `fetch` wrapper with ISR revalidation.
- Cannot use Axios because it reads `localStorage` (browser-only).
- Returns `null` on any error so callers can fall back to mock data.

### Client components (`'use client'`)
- Use **`lib/axios.ts`** — shared Axios instance with auth-token interceptors.
- Service wrappers in `services/` provide typed, named functions.

---

## New files

| File | Purpose |
|---|---|
| `types/api.ts` | TypeScript types mirroring backend Pydantic schemas (`ApiListing`, `PaginatedItems`, `AiSession`, `ChatSendRequest/Response`, etc.) |
| `lib/listingAdapter.ts` | Converts `ApiListing` → `ListingItem` / `ListingDetail` (the shapes expected by UI components) |
| `lib/serverFetch.ts` | Server-side fetch helper; `isUuid()` and `buildQuery()` utilities |
| `services/listingsService.ts` | Client-side listings API: `fetchFeaturedListings`, `searchListings`, `fetchListingById`, `buildSearchParams` |
| `services/chatService.ts` | Client-side chat API: `createAiSession`, `sendChatMessage` (uses `CHAT_SEND_TIMEOUT_MS`, currently 5 minutes — `/chat/send` can include reply + intent + server-side rolling summary), `streamChatMessage`, `getOrCreateAnonToken` |

---

## Pages

### `/` (home)
- Server component (`app/page.tsx`).
- Calls `GET /listings/featured?size=4` (ISR 120 s).
- Falls back to hardcoded `FALLBACK_FEATURED` array when the API is unavailable.

### `/listings`
- Client component (`app/listings/page.tsx`).
- Calls `GET /listings/search` on mount and whenever filters change.
- Filter state (`status`, `country`, `city`, `propertyTypes`, `beds`, `baths`, `sortBy`) is mapped to API params via `buildSearchParams` in `services/listingsService.ts`.
- **Country** and **city** are stored in the URL (`/listings?country=ca&city=Toronto`) so filters survive refresh and deep links from the homepage city search work.
- **Country** filter sends `country=ca` or `country=us` to `GET /listings/search` (ISO codes, lowercased). Omit or choose “All countries” to search every market.
- When the API is unreachable, offline mock cards still respect country/city filters (mock data is Canadian-only).
- When multiple property types are selected the API is queried without a type filter and results are narrowed client-side.
- Shows a loading skeleton while fetching, an empty state when no results are found, and an amber banner + mock data fallback on network error.
- While `NEXT_PUBLIC_PROPTX_LIVE` is disabled, listings use mock cards with preference-based ranking from onboarding responses.

### `/listings/[id]`
- Server component (`app/listings/[id]/page.tsx`).
- If `id` is a UUID → `GET /listings/{id}` → adapt with `apiListingToDetail`.
- If `id` is a legacy mock integer (e.g. `1`) → `getListingDetail(id)` from mock data.
- 404 when the UUID is valid but the API returns nothing.

### `/chat`
- Client component (`app/chat/page.tsx`).
- On mount: calls `POST /ai_sessions` with an anonymous `session_token` stored in `sessionStorage`.
- On message send: calls `POST /chat/send` with `session_id` + `message_text`.
- Accepts `?q=` query param (pre-fills the input — linked from the homepage AI section).
- Shows typing indicator, suggested prompts, send errors with input restoration.

### Lead capture (Phase 0)

- **`POST /lead_capture/contact_form`** — public; body includes name, email, message, optional `topic`, optional `listing_id`, optional `lead_type` (`buyer` \| `seller` \| `investor`). Optional JWT or `X-Anonymous-Session-Token` for merge. Returns **202** immediately; capture runs in a background task (same pattern as showing-request lead hooks).

---

- **Where in the UI:** `/profile` → **Saved homes** section (`SavedListingsSection`), or directly `/profile#saved-homes`. Guests use the same page; the API keys saves by `X-Anonymous-Session-Token` from `localStorage` (`lib/anonymousSession.ts`).
- **Nav:** **Saved homes** in the header (guests and signed-in menu) links to `/profile#saved-homes`. Legacy `/saved` redirects there.
- **Mock mode behavior:** saves are stored in localStorage (`lucy_mock_saved_listing_ids_v1`) for testing non-UUID mock listings before PROPTX is live.

---

## Graceful degradation

All data-fetching paths fail **silently**:

- Server fetch failures → `null` → fallback to static/mock data.
- Client fetch failures → error banner + mock data (listings page) or error message + input restoration (chat page).
- The UI is never blank or broken due to a missing API.

---

## Next steps

- Replace mock coordinate fallback in `lib/listingAdapter.ts` with real geocoding when listings have coordinates.
- Add `useUser` / JWT context so authenticated users get personalised chat sessions.
- Integrate `POST /chat/stream` (SSE) for real-time streaming in the chat page.
- Wire `CitySearchSection` quick-links to `/listings?city={city}` and read the `city` param in the listings page to pre-filter.
