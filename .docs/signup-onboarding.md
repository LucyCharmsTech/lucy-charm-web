# Signup onboarding flow

## Purpose

Collect a small onboarding profile once for newly registered client users so listing experience and AI guidance can be personalized without adding signup friction.

---

## Route

- New route: `/onboarding`
- Page file: `app/onboarding/page.tsx`
- UI component: `components/onboarding/SignupOnboardingWizard.tsx`

---

## Flow

1. User signs up (email/password or Google).
2. App fetches `GET /users/me`.
3. If role is `client` and `onboarding_completed` is `false`, redirect to `/onboarding`.
4. User completes 3-step wizard and submits `PUT /users/me/onboarding`.
5. On success, user is redirected to `/`.

If onboarding is already completed, `/onboarding` redirects home.

---

## Questions captured

Step 1:

- Primary intent (`buyer`, `seller`, `investor`, `exploring`)
- Timeline (`asap`, `1_3_months`, `3_6_months`, `6_plus_months`)

Step 2:

- Preferred country
- Preferred city
- Property types (up to 3)

Step 3:

- Financing status (optional)
- Listing alerts opt-in

---

## Client integration details

- `types/api.ts` adds onboarding request/response types and `UserMe` fields:
  - `onboarding_completed`
  - `onboarding_completed_at`
- `services/userService.ts` adds:
  - `fetchCurrentUserOnboarding()`
  - `submitCurrentUserOnboarding()`
- `lib/postLoginRedirect.ts` now routes incomplete client profiles to `/onboarding`.

---

## Accessibility and UX

- Semantic `fieldset`/`legend` grouping for question sets.
- Native radio/checkbox controls with visible labels.
- Keyboard and screen-reader friendly form interactions.
- Progress indicator and small step count for clarity.
- Dark-mode compatible styling consistent with existing auth pages.
