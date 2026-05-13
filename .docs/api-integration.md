# API Integration

## Overview

The frontend connects to the **lucy-charm-api** FastAPI backend (`http://localhost:8000/api/v1` by default). All live data is fetched from the backend; mock data is retained as a fallback so the UI never breaks if the API is unreachable.

---

## Environment variable

| Variable | Default | Used in |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | `lib/axios.ts`, `lib/serverFetch.ts`, `services/chatService.ts` |

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
| `services/chatService.ts` | Client-side chat API: `createAiSession`, `sendChatMessage`, `streamChatMessage`, `getOrCreateSessionToken` |

---

## Pages

### `/` (home)
- Server component (`app/page.tsx`).
- Calls `GET /listings/featured?size=4` (ISR 120 s).
- Falls back to hardcoded `FALLBACK_FEATURED` array when the API is unavailable.

### `/listings`
- Client component (`app/listings/page.tsx`).
- Calls `GET /listings/search` on mount and whenever filters change.
- Filter state (`status`, `propertyTypes`, `beds`, `baths`, `sortBy`) is mapped to API params via `buildSearchParams` in `services/listingsService.ts`.
- When multiple property types are selected the API is queried without a type filter and results are narrowed client-side.
- Shows a loading skeleton while fetching, an empty state when no results are found, and an amber banner + mock data fallback on network error.

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
