# Email One-Time Code Sign-in (Web)

Counterpart: `lucy-charm-api/.docs/email-one-time-code.md`

**Control 2.4:** *"Use Continue with Google, Continue with Apple and Continue
with email. **Email uses a one-time code**; avoid customer-facing 'magic link'
jargon."*

The earlier work removed the *wording*. This removes the *mechanism* — the
email method now sends a code, which is what the control actually asks for.

## What changed

| | Before | Now |
|---|---|---|
| Component | `MagicLinkAuthForm` | **`EmailCodeAuthForm`** |
| Flow | one step → "check your inbox for a link" | **two steps** → email, then code |
| Button | "Send sign-in link" | "Send sign-in code" |
| Sign-in completes | on the `/auth/magic-link` callback page | **in the form**, no page hop |

`components/auth/MagicLinkAuthForm.tsx` is **deleted**. The form that issued
links is exactly what the client's Q1 means by *"then stop issuing new links"*.

**`MagicLinkCallback` and `/auth/magic-link` stay.** Q1 requires links already
issued to be honoured to their original expiry, and that page is what honours
them. Nothing sends a new one.

## The two steps

`components/auth/EmailCodeAuthForm.tsx`, one component because they are one
task — both steps share the address, and splitting them would mean lifting that
state somewhere just to pass it back down.

**Step 1** — email (plus name on sign-up). On success it advances and shows the
expiry the API reported, rather than a hardcoded number.

**Step 2** — the code, with:

- `inputMode="numeric"` for a phone keypad, but **`type="text"`** — `type="number"` strips a leading zero and `"012345"` is a valid code
- `autoComplete="one-time-code"`, which is what lets iOS and Android offer the code straight from the notification
- separators stripped, so a pasted `"123 456"` works
- **Continue disabled until six digits are present**
- focus moved to the field when it appears, so the user can type straight after switching back from their mail app
- **Send a new code**, which clears the box — the server retires the previous code, so holding a stale value would mislead
- **Use a different email**, for a mistyped address

## Failure handling

| Case | Behaviour |
|---|---|
| Wrong code | `role="alert"`, and the field is **cleared** — a rejected code is never right on a second submit |
| Attempt limit hit (429) | The API's own message reaches the user: "Too many incorrect attempts. Please request a new code." |
| Send failure | Reported, the step does **not** advance, and the address is preserved so it need not be retyped |
| Deactivated account | Routed to `/account-status` via the existing `getInactiveAccountDetails` |

## Sign-in completion

The same two-step `setAuth` as `MagicLinkCallback`: seat the tokens with a
placeholder user first — `fetchCurrentUser` needs the Authorization header the
store supplies — then replace it with the real account, run `completeSignIn()`
to claim anonymous saves, and route via `getPostLoginPath` so role and
onboarding state decide the destination.

Copied deliberately rather than refactored. Changing that shared shape belongs
with retiring the link route, not with adding the code.

## Tests

```bash
npx jest __tests__/auth/EmailCodeAuthForm.test.tsx --silent   # 12
```

Covers both steps, the sign-up name field, the expiry coming from the API, the
input attributes that make mobile autofill work, verification seating the
session and routing on, pasted separators, the disabled-until-six rule, a
rejected code being cleared, the attempt-limit message, resend clearing the
box, going back to fix the address, and a send failure preserving what was
typed.

## Known limitations

- **No Apple button.** Control 2.4 lists three methods; Apple is blocked on the Lucy-owned Developer membership, and Hamed's Q1 is explicit: *"Do not show an unusable Apple button."*
- **MFA is not in this flow yet.** A code is primary auth. Staff MFA (1.13/C6) adds a second challenge after it, and this code-entry field is the component to reuse.
- **`requestMagicLink` remains in `services/authService.ts`** with no caller, kept so the callback's counterpart is visible while the route winds down. Remove both with the API routes once every issued link has expired.
