# Sign-in Copy — "Magic Link" Removed (Web)

Tranche-one item **T4**. Checklist control **2.4** (ADD): *"Use Continue with
Google, Continue with Apple and Continue with email. Email uses a one-time
code; avoid customer-facing 'magic link' jargon."*

## 2.4 is three pieces. Only one is done.

| Piece | Status |
|---|---|
| Remove the jargon | **done** |
| Email one-time code replacing the link | later tranche — cross-repo, changes the API contract |
| Continue with Apple | **blocked.** Apple membership pending, and Hamed's Q1: *"Do not show an unusable Apple button."* |

Hamed's Q1 also sets the sequence for the OTP work: *"Build and test codes
alongside the current link method. Then stop issuing new links. Honour links
already issued until their original expiry."*

## Strings changed — 7 here, 6 more in the API

| File | Was | Now |
|---|---|---|
| `app/register/page.tsx:46` | "Continue with Google or email magic link" | "Continue with Google or email" |
| `app/register/page.tsx:74` | "or sign up with magic link" | "or sign up with email" |
| `app/login/page.tsx:74` | "or continue with magic link" | "or continue with email" |
| `components/auth/MagicLinkAuthForm.tsx:120` | "Send magic link" | "Send sign-in link" |
| `components/auth/MagicLinkAuthForm.tsx:49` | "Could not send magic link…" | "Could not send the link…" |
| `components/auth/MagicLinkCallback.tsx:62` | "Magic link is invalid or expired…" | "This link is invalid or expired…" |
| `components/auth/MagicLinkCallback.tsx:88` | "Magic link token is missing." | "This link is missing its token." |

The handoff listed five of these. `MagicLinkAuthForm.tsx:120` is a **button
label** — the most-seen string of the set — and `:49` an error fallback.

**Six more were in the API** and are equally customer-facing, reaching the user
through `getApiErrorMessage()`: two 410 bodies in `auth/resource.py` and five
`detail` strings in `auth/magic_link_service.py`. See that repo's diff.

Wording follows the house term already in the adjacent copy — "Sign-in link
problem", "Send sign-up link", "Sending link…". `MagicLinkCallback` serves both
sign-in and account recovery, so its messages stay mode-neutral; the heading
above already says which flow the reader is in.

## Internals deliberately untouched

`MagicLinkCallback`, `MagicLinkAuthForm`, `verifyMagicLink()`,
`requestMagicLink()`, the `/auth/magic-link` route,
`lib/axiosAuthRefresh.ts:20`. Renaming them crosses the API contract and
belongs with the OTP work.

Two internal code comments still say "magic link"
(`lib/completeSignIn.ts:4`, `services/authService.ts:16`), as does one OpenAPI
route summary in the API. All developer-facing.

## Guard

`tests/integration/test_user_operations.py::test_password_signup_is_gone` in the
API now asserts the **required** wording, so the jargon cannot return in a 410
body.

```bash
grep -rn "magic link\|Magic link" app/ components/ services/
# expect: only the two comments above
```
