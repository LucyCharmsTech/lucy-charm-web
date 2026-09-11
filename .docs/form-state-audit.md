# Form state audit — control 2.9

> *"Validation, loading, success, **duplicate** and recoverable error states,
> preserving what was typed across a failure."*

Every form on the site, audited against the five states. Plan item 4.6.

## Result

**16 forms. The one thing that was uniformly right is the one that matters
most:** not a single form clears its fields on failure. Control 2.10 calls the
alternative *silent lead loss*, and it is the failure that costs a customer
rather than an interaction.

Three real defects, all fixed:

| # | Form | Defect | Fix |
|---|---|---|---|
| 1 | Request a showing | **No duplicate protection at all.** A buyer who pressed send twice got two requests; an agent got two notifications about one viewing and someone made a phone call | Server matches (who, listing, time) and returns the existing request with `was_duplicate: true`. Nine tests |
| 2 | Profile account | `catch {}` discarded the error entirely, so a server explaining *why* produced "Could not save changes. Please try again." — the person retries identical input and gets an identical result | Shows the server's message, and distinguishes retryable from final |
| 3 | All forms | The five states were re-implemented at every call site, so **duplicate** had been dropped everywhere except Contact | `lib/formStates.ts` + `lib/useFormSubmission.ts`, defined once |

## Per-form

Legend: ✅ present · ➖ not applicable · ❗ was missing

| Form | Validation | Loading | Success | Duplicate | Recoverable error | Preserves input |
|---|---|---|---|---|---|---|
| Contact | ✅ | ✅ | ✅ | ✅ content digest | ✅ | ✅ |
| Request a showing | ✅ | ✅ | ✅ | ❗ **→ fixed** | ✅ | ✅ |
| Home Value | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ + `sessionStorage` |
| Unsubscribe | ✅ | ✅ | ✅ | ✅ idempotent | ✅ | ➖ |
| Email code sign-in | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ address kept |
| MFA challenge | ✅ | ✅ | ✅ | ➖ | ✅ | *clears deliberately* † |
| MFA enrolment | ✅ | ✅ | ✅ | ✅ 409 on re-enrol | ✅ | *clears deliberately* † |
| Account recovery | ✅ | ✅ | ✅ | ➖ same answer either way | ✅ | ✅ |
| Profile account | ✅ | ✅ | ✅ | ➖ | ❗ **→ fixed** | ✅ |
| Sell / explorer | ✅ | ✅ | ✅ | ➖ resumes a session | ✅ | ✅ |
| Seller portal actions | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ |
| Onboarding wizard | ✅ | ✅ | ✅ | ➖ idempotent per step | ✅ | ✅ |
| Showing documents | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ |
| Showing feedback | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ |
| Property Checkup panel | ✅ | ✅ | ✅ | ✅ existing questions shown | ✅ | ✅ |
| Preference prompt | ✅ | ✅ | ✅ | ➖ | *silent by design* ‡ | ✅ |
| Admin lead notes | ✅ | ✅ | ✅ | ➖ | ✅ | ✅ |

† **The two auth forms clear on failure on purpose.** A rejected six-digit code
is never right on a second submit, and a spent recovery code never will be.
Leaving it in place invites the person to press the button again on a value
that cannot work. This is the one place where *not* preserving input is the
correct behaviour, and it is commented as such at each site.

‡ **The preference prompt fails silently on purpose.** It is optional by
definition — an error banner for a nicety that could not load is worse than the
nicety being absent.

## Where "not applicable" is a real answer

Duplicate is marked ➖ where a repeat submission is **not a distinguishable
event**:

- **Account recovery and email sign-in** answer identically whether or not an
  account exists — that is what stops them being used to enumerate addresses.
  A duplicate state would leak exactly what the generic answer conceals.
- **Onboarding steps** are idempotent by construction: setting the same step
  twice is the same state, not a second record.
- **Profile updates** overwrite. Saving the same name twice is one name.

This distinction matters: adding a duplicate state where repeats are not
distinguishable would mean *inventing* a signal, and a wrong duplicate warning
("we already have this") on a submission that did not arrive is worse than none.

## What is not covered here

Loading and validation are per-form and were verified by reading each; they are
uniformly present because they are the two states a form cannot ship without
somebody noticing. Duplicate is the opposite — a 409 falling through to the
generic error branch **looks fine to whoever wrote it**, which is why it was
missing in the one place it mattered.
