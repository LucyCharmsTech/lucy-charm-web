# Passwordless Auth UI

## Scope

Frontend auth now supports only:

- Google Sign-In
- Email magic link

Email/password UI has been removed from `/login` and `/register`.

---

## Routes

- `/login` → Google + magic link form
- `/register` → Google + magic link form (same auth methods as login)
- `/auth/magic-link` → callback verifier that exchanges token for app tokens

---

## Components

- `components/auth/GoogleAuthButton.tsx`
- `components/auth/MagicLinkAuthForm.tsx`
- `components/auth/MagicLinkCallback.tsx`

---

## Service methods

`services/authService.ts` includes:

- `requestMagicLink({ email, redirect_path? })`
- `verifyMagicLink({ token })`
- `googleLogin(idToken)`

---

## Flow

1. User requests a magic link from login/register.
2. User clicks the emailed link to `/auth/magic-link?token=...&redirect=...`.
3. Callback page calls `/auth/magic-link/verify`.
4. App stores tokens, fetches `/users/me`, then routes using `getPostLoginPath`.

---

## Accessibility and UX

- Native email input + submit button (keyboard and screen-reader friendly).
- Clear success and error states.
- Keeps existing light/dark theme style and spacing.
