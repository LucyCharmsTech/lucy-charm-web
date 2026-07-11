# PROPTX Mock Mode

## Purpose

Keep the buyer experience testable before PROPTX is connected by running listings, saved homes, and preference matching on curated mock data.

---

## Toggle

- Env var: `NEXT_PUBLIC_PROPTX_LIVE`
- Default behavior: mock mode (`false` / unset)
- Live mode: set `NEXT_PUBLIC_PROPTX_LIVE=true`

---

## What mock mode affects

- Home featured cards: uses `MOCK_LISTINGS` first 4 entries.
- Listings page: uses `MOCK_LISTINGS` with filters + preference-based ranking.
- Saved homes:
  - Uses browser localStorage key `lucy_mock_saved_listing_ids_v1`.
  - Save/unsave works on mock listing IDs (non-UUID values).
- Matching logic:
  - Reads stored onboarding responses from `GET /users/me/onboarding`.
  - Applies lightweight scoring in `lib/listingMatching.ts`.

---

## Preference storage and reuse

- Onboarding writes to `users.onboarding_responses` through `PUT /users/me/onboarding`.
- Frontend reads those responses via `fetchStoredUserPreferences()` and uses them for mock ranking now.
- Once PROPTX is live, the same preference payload can be sent to live matching without changing onboarding capture.
