# Client code review findings — full history

Every issue the client's code review has flagged across both review rounds,
where the code actually lives, which commit is at fault, and what was done
about it. Covers both repos since several issues are cross-repo pairs (a
backend gap made live by a frontend caller, or vice versa).

**Status:** Round 1 fixed on `feature/document_centre`. Round 2 fixed on
`feature/analytics` (see the **Fix** notes below).

> ### ⚠️ Branch note — read before requesting a re-review of `feature/analytics`
>
> `feature/document_centre` and `feature/analytics` are **sibling branches**,
> diverged at `4792c53`. Each has one commit the other lacks:
>
> | Branch | Unique commit | Contains |
> |---|---|---|
> | `feature/document_centre` | API `28b0501`, Web `65a836b` | the **Round 1 fixes** |
> | `feature/analytics` | API `0f53817`, Web `fffc608` | the analytics work |
>
> Both branches share the document-centre and lead-pipeline commits as
> ancestors, so the `feature/analytics` PR diff against `main` **still
> contains all four Round 1 bugs** — `documents/service.py` (+1477 lines),
> `leads/service.py`, and `services/documentService.ts` all appear in it in
> their pre-fix form.
>
> **Decision: leave as-is.** `feature/document_centre` merges to `main` first,
> then `feature/analytics` is rebased onto `main` and picks the fixes up.
>
> **Consequence to expect:** until that rebase happens, anyone reviewing the
> `feature/analytics` PR in isolation will re-report Round 1 issues #1–#4.
> That is expected, not a regression — point them at this document.

---

## Round 1

### 1. Web uploads fail because the multipart boundary is overridden

**Repo/file:** Web — `services/documentService.ts:141` and `:161–163`.
`uploadDocument()` and `uploadDocumentRevision()` hardcoded:

```ts
headers: { 'Content-Type': 'multipart/form-data' }
```

which overrides axios/the browser's own header, stripping the
`boundary=...` parameter the server needs to parse the multipart body.

**Fault:** `04a0a8e` — "refactor: migrate identity document handling to
document centre" — **parry11**, 2026-08-10. This commit is what first wired
the frontend to the new document-centre upload endpoints; both upload
functions, and the bad header, were added fresh here.

---

### 2. Expired identity documents leave showings marked as verified

**Repo/file:** API — `app/api/documents/service.py:812` (the expiry job)
and `:1284` (the sync helper's missing `expired` branch).

**Fault:** two commits, same author, same day:

- `ad03495` — "Add the document centre: private storage, review workflows,
  and an audit trail" — **parry11**, 2026-08-10 — added
  `expire_accepted_documents()`, which never called any sync helper (it
  didn't exist yet).
- `221a469` — "Implement ID verification synchronization for document
  uploads" — **parry11**, 2026-08-10 — added
  `_sync_showing_id_verification()` with branches for accepted / rejected /
  replacement-needed / requested / uploaded, but no `expired` branch, and
  didn't retrofit the expiry job to call it.

---

### 3. Document replacement is not atomic and is race-prone

**Repo/file:** API — `app/api/documents/service.py:350` (create-then-supersede
sequence) and `:1075` (`_mark_superseded()` only catches
`IllegalTransitionError`).

**Fault:** `ad03495` — "Add the document centre: private storage, review
workflows, and an audit trail" — **parry11**, 2026-08-10. This is the commit
that introduced the entire document lifecycle/versioning model — the race
was present from the first version of this code, not a later regression.

---

### 4. Lead unassignment is not possible

**Repo/file:** API — `app/api/leads/service.py::update()`.
`if payload.assigned_agent_id is not None:` can't distinguish "field
omitted" from "field explicitly set to null," so a PATCH meaning "clear the
assignment" is silently ignored.

**Fault:** two events, four months apart:

- `b6d85ac` — "Update environment configuration, refactor Makefile
  commands, and implement new API endpoints for agents and AI escalations"
  — **Geleta116**, 2026-04-22 — wrote the original `is not None` check. At
  the time there was no "Unassigned" UI concept, so the gap was dormant.
- `4792c53` — "Add lead pipeline documentation and implement lead status
  management" — **parry11**, 2026-08-10 — added the `unassigned=True` list
  filter and the admin "Unassigned" queue it powers, with no matching way to
  *produce* that state via PATCH. This is what turned the old gap into a
  visible, reported bug.

---

## Round 2

### 1. High — Agent PII is exposed to every authenticated user

**Repo/file:** API — `app/api/agents/resource.py:100`
(`list_all_agents()`, `GET /agents/`, depends only on `get_current_user()`,
no role check) and `app/api/agents/models.py:56` (`AgentRead` includes
`email`, `phone`, `license_number`). Web —
`services/superadminService.ts:51` (`fetchAgentsAdmin()`), which calls that
endpoint to feed an admin agent-assignment dropdown.

**Fault:** two events, four months apart:

- `b6d85ac` — "Update environment configuration, refactor Makefile
  commands, and implement new API endpoints for agents and AI escalations"
  — **Geleta116**, 2026-04-22 (API repo) — wrote `list_all_agents()` with no
  authorization check at all. This is on `main` and every branch —
  pre-existing, not specific to this feature branch.
- `a0d414f` — "feat: enhance admin inquiries and lead detail pages with
  agent assignment and filtering" — **parry11**, 2026-08-10 (Web repo) —
  added `fetchAgentsAdmin()`, calling that same endpoint from a real admin
  feature. Didn't create the hole, but is what made it live — before this,
  nothing called `GET /agents/` from a context where the caller might not
  already be staff.

**Fix:** `list_all_agents` now depends on
`require_role(UserRole.SUPERADMIN)` instead of bare `get_current_user()` —
the same dependency `admin_insights/resource.py` already used, so no new
mechanism was introduced. Every existing caller (`fetchAgentsAdmin`,
`fetchAllAgents` on the showings and sellers pages) is superadmin-only UI, so
nothing legitimate lost access; a restricted `id`/`name`-only picker endpoint
was therefore unnecessary.

**Tests:** new `tests/integration/test_agents_access.py` — a client gets 403,
an agent gets 403, a superadmin gets 200 with the directory, and an
unauthenticated caller gets 401.

---

### 2. Medium — Agent insights load all records into application memory

**Repo/file:** API — `app/api/agents/service.py:133`
(`get_my_insights()`), pulling every confirmed showing row for the agent and
computing count/avg/min/max in a Python list comprehension instead of one
SQL aggregate.

**Fault:** `0f53817` — "Implement admin dashboard pipeline summary and
enhance lead status tracking" — **parry11**, 2026-08-11. The whole function
is new in this commit's diff.

**Fix:** the row fetch and Python reduction were replaced with a single
aggregate query — `COUNT`, `AVG`, `MIN`, `MAX` over
`EXTRACT(EPOCH FROM confirmed_at - created_at)`. The "confirmation predates
the request" guard moved from a list-comprehension filter into a
`WHERE confirmed_at >= created_at` clause, so clock-skewed rows are excluded
by the database rather than after transfer. Memory use is now constant
regardless of how much showing history an agent has.

**Tests:** the old `tests/unit/test_agent_insights.py` stubbed the SQLAlchemy
result object, which can no longer stand in for a query that Postgres must
actually execute — it was replaced by
`tests/integration/test_agent_insights.py`, running the same five cases
(avg/min/max maths, empty stats, skewed-row exclusion, own-data-only, and
404 without an agent profile) against a real database.

---

### 3. Medium — PostHog is not actually lazy-loaded

**Repo/file:** Web — `lib/analytics.ts:15` — `import posthog from
'posthog-js';` is a static import, so the package ships in every visitor's
bundle regardless of consent, despite `.docs/analytics.md` documenting it as
consent-gated.

**Fault:** `fffc608` — "feat: integrate PostHog analytics for visitor
tracking and consent management" — **parry11**, 2026-08-11. This is the
single commit that added the entire analytics module — the static import
was there from the start.

**Fix:** the static `import posthog from 'posthog-js'` became a type-only
import plus a dynamic `await import('posthog-js')` inside `initAnalytics()`,
which only runs after consent and with a key configured. The loaded instance
is held in a module-level `posthogInstance`; `track()` no-ops until it lands.

Because `initAnalytics()` is now async, two callers can legitimately overlap
(the banner's accept handler and the `Providers` effect) and both passed the
`initialized` guard before either finished, double-initialising the SDK. The
in-flight promise is therefore memoised in `initPromise`, cleared on failure
so a transient chunk-load error can retry.

**Verified against a real production build**, not just by reading the source:
the 242 KB PostHog chunk appears in **no** build manifest (so no page loads
it eagerly) and all four eager root-bundle chunks contain **zero** `posthog`
references — it is now fetched on demand only.

**Tests:** `__tests__/analytics/analytics.test.ts` gained cases for
"accepting dynamically loads and initialises posthog" and "with no key
configured, posthog never loads even after acceptance". Note the suite's
`beforeEach` deliberately no longer calls `jest.resetModules()` — resetting
the registry hands the dynamic import a *different* mock instance than the
one the test file asserts on.

---

### 4. Medium — Analytics error handling does not match the stated guarantee

**Repo/file:** Web — `lib/analytics.ts:82` (`track()` wraps only
`posthog.capture()` in try/catch; `localStorage.getItem`/`setItem` and
`posthog.init()` are unguarded) and the `{ ...audience, ...properties }`
merge order, which lets a caller-supplied property silently overwrite the
protected audience fields. Also `components/Providers.tsx:21` — the
`CookieConsentBanner` is genuinely lazy-loaded, but `initAnalytics` (which
pulls in `posthog-js` transitively) is imported statically and called
directly in the same file, so the banner being lazy doesn't stop the SDK
loading on every page.

**Fault:** `fffc608` — "feat: integrate PostHog analytics for visitor
tracking and consent management" — **parry11**, 2026-08-11. Same commit as
issue #3 — both the incomplete error handling and the spread-order bug were
part of the original analytics module.

**Fix:** three separate changes:

- **Storage.** Added `safeGetItem`/`safeSetItem` helpers wrapping
  `localStorage` in try/catch. A blocked read now reads as "no consent yet";
  a blocked write means the choice applies for the page load but doesn't
  persist. Either way the banner can't throw.
- **Init.** The whole dynamic-import-and-init block sits in a try/catch, so
  a failed chunk load or a throwing `posthog.init()` just leaves tracking
  off instead of propagating into the consent handler.
- **Spread order.** `track()` now merges `{ ...properties, ...audience }` —
  audience last — so a call-site property named `user_role` or
  `is_authenticated` can no longer make an event lie about who sent it.

**Tests:** `analytics.test.ts` gained "a storage read that throws reads as
'no consent' rather than crashing" and "a storage write that throws does not
break accepting consent" (both via `jest.spyOn(Storage.prototype, ...)`).
`audience.test.ts` gained "a call-site property can never overwrite the
protected audience segment", which fails against the old spread order.

---

### 5. Low/Medium — Pipeline totals can disagree with displayed stages

**Repo/file:** API — `app/api/admin_insights/service.py::dashboard_summary()`
— `by_stage` is built strictly from the fixed `LEAD_STAGES` tuple (unknown
statuses dropped), while `total_leads` comes from a separate, unfiltered
count. `tests/unit/test_admin_pipeline_summary.py
::test_unknown_status_from_the_database_is_not_rendered` explicitly locks in
this behavior with a seeded `"legacy_stage"` status.

**Fault:** `0f53817` — "Implement admin dashboard pipeline summary and
enhance lead status tracking" — **parry11**, 2026-08-11. Same commit as
issue #2 — built and tested with this behavior intentionally.

**Fix:** `dashboard_summary()` now sums any status outside `LEAD_STAGES` into
a single `unknown` bucket appended to `by_stage`. The bucket is only present
when the count is non-zero, so a healthy database renders exactly the stages
it did before and the dashboard keeps its stable shape. `total_leads` and the
sum of the bars now always reconcile.

Chose the `unknown` bucket over migrating/validating statuses because a
migration fixes today's rows but not the next retired stage — the bucket
makes the panel self-consistent permanently, and surfaces the problem rather
than hiding it.

**Tests:** `test_unknown_status_from_the_database_is_not_rendered` — the test
that previously *locked in* the bug — was rewritten as
`test_an_unknown_status_is_bucketed_as_unknown_not_dropped`, which asserts
the retired stage still doesn't get its own named bar, that `unknown` holds
its count, and that the bars sum to `total_leads`. Added
`test_no_unknown_bucket_when_every_status_is_known` to pin the no-regression
case.

---

## Fault summary

| # | Issue | Repo(s) | Commit(s) | Author(s) | Status |
|---|---|---|---|---|---|
| R1-1 | Multipart boundary override | Web | `04a0a8e` | parry11 | Fixed |
| R1-2 | Expired docs / showing sync | API | `ad03495`, `221a469` | parry11 | Fixed |
| R1-3 | Non-atomic replacement | API | `ad03495` | parry11 | Fixed |
| R1-4 | Lead unassignment | API | `b6d85ac` (root) → `4792c53` (exposed) | Geleta116 → parry11 | Fixed |
| R2-1 | Agent PII exposure | API + Web | `b6d85ac` (root) → `a0d414f` (exposed) | Geleta116 → parry11 | Fixed |
| R2-2 | Agent insights in Python | API | `0f53817` | parry11 | Fixed |
| R2-3 | PostHog not lazy | Web | `fffc608` | parry11 | Fixed |
| R2-4 | Analytics error handling | Web | `fffc608` | parry11 | Fixed |
| R2-5 | Pipeline totals mismatch | API | `0f53817` | parry11 | Fixed |

### Round 2 — files changed

**API (`lucy-charm-api`)**

| File | Change |
|---|---|
| `app/api/agents/resource.py` | `list_all_agents` gated behind `require_role(UserRole.SUPERADMIN)` |
| `app/api/agents/service.py` | `get_my_insights` rewritten as a single SQL aggregate |
| `app/api/admin_insights/service.py` | `unknown` bucket added to `by_stage` |
| `tests/integration/test_agents_access.py` | **new** — 4 authorization tests |
| `tests/integration/test_agent_insights.py` | **new** — 5 tests, replaces the unit test |
| `tests/unit/test_agent_insights.py` | **deleted** — stubbed a query that must now hit Postgres |
| `tests/unit/test_admin_pipeline_summary.py` | bug-preserving test rewritten; +1 regression test |

**Web (`lucy-charm-web`)**

| File | Change |
|---|---|
| `lib/analytics.ts` | dynamic import, memoised init promise, safe storage helpers, spread order |
| `__tests__/analytics/analytics.test.ts` | +4 tests; dropped `jest.resetModules()` |
| `__tests__/analytics/audience.test.ts` | +1 spread-order test; `enableTracking` now async |

### Verification

- **API:** 14 targeted tests pass; full suite 355 passed / 11 failed. Those
  11 failures (`test_auth.py`, `test_realtime_ws.py`, `test_user_operations.py`,
  `test_showing_lifecycle_notifications.py`) were confirmed **pre-existing** by
  stashing all changes and re-running — identical failures on clean `HEAD`.
  They relate to password login, which is disabled in this environment.
- **Web:** 130 tests pass, `tsc --noEmit` clean, production build succeeds, and
  the PostHog lazy-load was verified against the built bundle (see R2-3).
