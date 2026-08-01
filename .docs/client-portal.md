# Client portal

## Scope

Client-facing portal features are implemented on `/profile` for authenticated users.

---

## Implemented modules

- **Saved searches** (`ClientSavedSearchesSection`)
  - Create named searches and reopen them in `/listings`.
  - Supports multiple saved searches with a maximum of 3 per user.
  - City and property-type filters are dropdowns populated from live listing values in the DB.
  - Stored in browser localStorage (`lucy_client_saved_searches_v1`).

- **Favorites** (`SavedListingsSection`)
  - Saved listing cards with save/unsave support.
  - Uses API saves in live mode and mock saves in preview mode.

- **Chat history** (`ClientChatHistorySection`)
  - Loads user sessions via `/ai_sessions/user/{user_id}`.
  - Loads transcript rows via `/ai_messages/session/{session_id}`.
  - Shows recent sessions and expandable message history.

- **Documents** (`ClientDocumentsSection`)
  - Lists showings where ID verification was requested.
  - Upload control: `ShowingIdentityUploadButton` → `POST /showing_requests/{id}/identity_documents` (PDF/JPEG/PNG, max 10 MB).
  - When `identity_document_uploaded` is true and status is not verified, shows **ID uploaded — awaiting agent verification** (no second upload).
  - Shows uploaded filename + review status (`uploaded` / `verified` / `rejected`).

- **Showing schedule** (`ClientShowingScheduleSection`)
  - Loads client showings from `/showing_requests/me`.
  - Displays the agreed visit time (`scheduled_at`, falling back to `preferred_date`).
  - When an agent has rescheduled (`rescheduled_at` set), shows the original preferred time as a secondary line.
  - Shows optional ID-verification state (`not requested`, `pending`, `verified`).
  - **Upload ID photo** button on each card when verification is requested and not yet verified (same `ShowingIdentityUploadButton`). Actions sit outside the listing link so upload does not navigate away.
  - Preferred first upload: after submitting a showing with ID verification checked, `RequestShowingIdUploadStep` in the request modal prompts for the file immediately.
  - Allows post-showing feedback submission from completed/confirmed past showings.
  - Feedback endpoint: `PATCH /showing_requests/{id}/feedback`.
  - When the client opts in, feedback signals are used to update their AI profile memory.
  - Each showing card links to the listing detail page and indicates visit-booked state.
  - Agent reschedules email the buyer and keep status as `confirmed` (see API `.docs/showing-requests.md`).

- **Next steps checklist** (`ClientNextStepsChecklistSection`)
  - Persistent checklist for buyer workflow milestones.
  - Stored in browser localStorage (`lucy_client_next_steps_v1`).

---

## Notes

- Existing auth and authorization flows are unchanged.
- API-backed modules (favorites, chat history, showing schedule) still enforce backend access controls.
