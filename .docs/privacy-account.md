# Privacy & Account Controls (Web)

## Profile sections

Authenticated users find two new sections on `/profile`:

1. **Privacy & notifications** — toggles for listing alerts, marketing email, and product updates (`GET/PATCH /users/me/privacy`).
2. **Data & account controls** — JSON export, privacy request form, deactivate, and delete account.

## Services

`services/userService.ts`:

- `fetchPrivacyPreferences()` / `updatePrivacyPreferences()`
- `exportCurrentUserData()`
- `submitDataRequest({ request_type, notes? })`
- `deactivateCurrentAccount()`
- `deleteCurrentAccount()`

## Chat history

`ClientChatHistorySection` calls `GET /ai_sessions/me` via `fetchMyChatSessions()` so the client never passes another user's id.

## Authorization note

Portal routes (`/agent`, `/admin`) remain guarded by `RoleGate` in the UI. The API enforces ownership and role checks independently — never rely on UI-only guards for security.

See API details: `lucy-charm-api/.docs/privacy-account.md`
