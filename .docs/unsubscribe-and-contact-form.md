# Unsubscribe Page & Contact Form (Web)

Counterparts: `lucy-charm-api/.docs/unsubscribe-and-consent-ledger.md` and
`lucy-charm-api/.docs/contact-form-integrity.md`

Tranche-one items **T5** and **T2**. Checklist controls **5.15**, **2.9**,
**2.10**, **2.1**, **2.17**, **6.18**.

## `/unsubscribe` — the only page that must work with no session

`app/unsubscribe/page.tsx` → `components/consent/UnsubscribeManager.tsx`
Service: `services/unsubscribeService.ts`

Reached from the footer link in every promotional email. The client was told
unsubscribe *"works without signing in"*, so the page authorizes on a token
from the URL and nothing else.

| Requirement | How |
|---|---|
| A separate choice per stream | Each of the four streams is listed with its own On/Off and its own button |
| A stop-all | One control switches every promotional stream off |
| Show what was turned off | A `role="status"` line after each change, and each row states On or Off |
| An accidental tap is recoverable | Per-stream **Resubscribe**, one explicit choice at a time (Q6: *"Re-enabling requires an explicit user choice"*) |

`?stop_all=1` applies the stop-all **on arrival**, which is what makes the
footer's "Stop all promotional emails" line genuinely one click. The plain link
opens the per-stream choices instead.

`robots: index false` — the URL carries a token.

When nothing promotional is left on, the stop-all control is replaced by a
statement of the fact plus the reassurance that service email still arrives.
That mirrors 5.15's *"necessary service communications remain correctly
classified"* — the page must not imply a showing confirmation was switched off.

**Stream labels and descriptions live in `unsubscribeService.ts`**, not in the
component, so the preference centre and this page can read the same words.

**Note on the missing-token case:** it is a **render branch**, not an effect.
Handling it in the effect tripped `react-hooks/set-state-in-effect`, and a link
with nothing to look up does not need an effect at all.

## `/contact` — fixes a live 404

`app/contact/page.tsx` → `components/contact/ContactForm.tsx`
Service: `services/leadCaptureService.ts`

`components/NavBar.tsx:372` has been linking to `/contact` and getting a **404**
— failing 2.17 (*"test real routes"*) and 2.1 (*"one primary action and a clear
route back"*). The route now exists.

Fields and topics are exactly what Hamed specified: *"Require name, email,
topic and message; phone optional"*, with topics **Buying**,
**Selling/Home Value**, **Existing request**, **General question**. Topics are
**data, not markup** — he called them *"initial configurable topics"*, so the
list is meant to move. `TOPIC_LEAD_TYPE` maps Selling/Home Value to `seller` so
a seller does not land as a buyer.

### All five states control 2.9 requires

| State | How |
|---|---|
| Validation | Native `required` on name, email, topic, message; phone is not required |
| Loading | Button shows "Sending…" and is disabled, so a second click cannot fire |
| Success | The **reference** returned by the API, with "please quote this" |
| Duplicate | `is_new: false` → "We already have this message… we have not opened a second request", with the **original** reference |
| Recoverable error | `role="alert"` and **nothing is cleared** |

That last one matters most: a 503 is retryable, and making someone retype their
message is exactly the silent lead loss 2.10 is about. A test asserts every
field survives a failure.

An omitted phone is sent as `null`, not `""`.

`X-Anonymous-Session-Token` is sent for a visitor so their earlier activity
links to the lead; a signed-in submitter is identified by their JWT.

### What the page deliberately does not contain

No office address, phone number, opening hours or response-time promise. Hamed
withheld all of it: addresses *"will be provided"*; the public email value,
phone decision and hours *"remain to be supplied"*; *"Do not invent values or
imply walk-in availability"*; *"Omit a fixed response-time promise for now"*.
Figma frames are *"not confirmed"* and *"Do not begin a separate design
exercise"*.

**So this is the form, not the finished Contact page of control 2.1.** The rest
goes in when he supplies the content and approves the final form and privacy
copy.

## Types

`types/api.ts` — `UnsubscribeState`, `ContactFormSubmission`,
`ContactFormReceipt`. `UnsubscribeState` carries only the address and stream
on/off: the unsubscribe token proves control of a mailbox, not identity, so it
must not expose profile data.

## Tests

```bash
npx jest __tests__/consent --silent    # 9
npx jest __tests__/contact --silent    # 8
```

This repo does **not** load `jest-dom`, so assertions use plain DOM properties
(`.required`, `.disabled`) — matching the existing suites.
