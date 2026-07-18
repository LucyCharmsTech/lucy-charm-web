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
  - Tracks status for required transaction docs (`needed`, `uploaded`, `verified`).
  - Includes notes per document.
  - Stored in browser localStorage (`lucy_client_docs_v1`).

- **Showing schedule** (`ClientShowingScheduleSection`)
  - Loads client showings from `/showing_requests/me`.
  - Displays status and preferred date/time.
  - Each showing card links to the listing detail page and indicates visit-booked state.

- **Next steps checklist** (`ClientNextStepsChecklistSection`)
  - Persistent checklist for buyer workflow milestones.
  - Stored in browser localStorage (`lucy_client_next_steps_v1`).

---

## Notes

- Existing auth and authorization flows are unchanged.
- API-backed modules (favorites, chat history, showing schedule) still enforce backend access controls.
