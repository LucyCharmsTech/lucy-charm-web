# Property Checkup — Handoff / Progress Doc

**Read this first if you're a new Claude Code session picking this up.** It captures everything done so far so you can resume without re-deriving context. Update it as you go — don't let it go stale.

## Quick orientation

- **Two repos, one feature**: `lucy-charm-api` (FastAPI backend) and `lucy-charm-web` (Next.js frontend), both sibling directories under this root.
- **Branch**: both repos are on `feature/property_checkup`.
- **Nothing is committed yet.** Every change described below is sitting uncommitted in the working tree of both repos. Run `git status` in each before doing anything destructive.
- **The spec**: three source documents exist at `~/Downloads/`:
  - `Lucy_Charms_Property_Checkup_Revised_Developer_Build_Spec_v2_3_FINAL_AUDITED.docx`
  - `Lucy_Charms_Property_Checkup_Clarifications_Part_1_DEVELOPER_FORMATTED.docx`
  - `Lucy_Charms_Property_Checkup_Clarifications_Part_2_DEVELOPER_FORMATTED.docx`
  - These `.docx` files have no plain-text version checked into the repo. If you need to re-read them, extract with Python's `zipfile`/`ElementTree` against `word/document.xml` — `pandoc` is not available on this machine. **The Clarifications documents override the base spec wherever they're more specific** — always check both before assuming the base spec's wording is current.

## What Property Checkup is

A buyer-facing feature on the listing detail page: a deterministic (no-LLM) rules engine reads a listing's structured feed fields and surfaces a short, neutral list of things worth verifying (e.g. "Condominium property → Status certificate, fee inclusions, and reserve fund"). Buyers can save a question for themselves, add a question to an upcoming showing, or request a human-reviewed "Deeper Property Review."

## Architecture

**Backend** (`lucy-charm-api/app/api/property_checkup/`), standard 5-file module:
- `models.py` — `PropertyCheckupCache`, `PropertyCheckupQuestion`, `PropertyReviewRequest` tables + Pydantic schemas
- `rules.py` — `RULES` tuple of `CheckupRule` dataclasses, `RULES_VERSION = "CA-ON-2026.08.1"`. 7 enabled rules (condo, septic, well, tenant-occupied, finished-basement, pool, fireplace), 2 disabled stubs (land-lease, rented-equipment) kept off because the feed field isn't reliable enough — do not enable without re-verifying against real data.
- `engine.py` — pure evaluate/dedupe/sort/field-signature logic, no I/O
- `repository.py` — `PropertyCheckupCacheRepository`, `PropertyCheckupQuestionRepository`, `PropertyReviewRequestRepository`
- `service.py` — `PropertyCheckupService`, all business logic
- `resource.py` — FastAPI routes under `/property_checkup`
- `exceptions.py`

**Frontend** (`lucy-charm-web/`):
- `components/listings/detail/PropertyCheckupCard.tsx` — quiet teaser on the listing page
- `components/listings/detail/PropertyCheckupPanel.tsx` — the expanded checkup, buyer actions
- `components/listings/detail/RequestShowingModal.tsx` — pending showing-questions preview (modified, not new)
- `components/property-checkup/PropertyReviewsQueue.tsx` — staff (admin+agent) review queue
- `components/profile/ClientPropertyReviewsSection.tsx` — buyer's own review-request status
- `components/showings/ClientFlaggedQuestionsDialog.tsx` — full-text modal for "Client flagged N things"
- `lib/propertyCheckupLocalQuestions.ts` — signed-out "Save question" local-storage bookmark
- `services/propertyCheckupService.ts` — API client functions

## Current status: feature-complete against spec + Clarifications

A full gap analysis was done against the Definition of Done (spec Section E1) and both Clarifications docs. Everything in the DoD checklist is built and verified, including:
- Instant checkup generation, caching (rules-version + field-signature), "View full checkup" reveal beyond the 5-item first-view cap
- "Property Checkup updated since your last visit" banner
- Save question (signed-out local-storage + signed-in, syncs on sign-in)
- Add to showing questions (signed-in only — see "Save vs Add" below)
- Deeper Property Review: create → auto-assign from existing lead → Requested/Under Review/Response Ready → staff assign/clear-compliance/respond
- Feature-level jurisdiction rollout flag (`config.property_checkup_enabled`, env-togglable, no deploy needed)
- Staff review queue UI (was entirely missing at first pass — backend endpoints existed with zero frontend surface; built admin + agent pages)
- Buyer-facing review-status section in profile

**Deliberately not built**: the "marketing consent checkbox" from Clarifications Part 1 §6. It's not in the DoD checklist, introduces new consent/versioning storage with nothing to reuse, and touches compliance territory better left to a product decision than a guess.

## Test status (last verified run)

- Backend unit: **750 passed**
- Backend integration (excluding IDX-credential-only failures unrelated to this feature — `test_idx_child_sync.py`, `test_idx_failed_records.py`, `test_idx_freshness.py`, `test_idx_key_reconciliation.py`, `test_idx_run_lifecycle.py`, `test_idx_checkpointing.py` — all fail with `RuntimeError: IDX bearer token is not configured`, confirmed pre-existing and not caused by this work): **226 passed**
- `tests/integration/test_property_checkup.py` specifically: **9 passed**
- Frontend: **220 passed**
- `npx tsc --noEmit`: clean
- `ruff check` / `eslint`: clean except one pre-existing, already-confirmed-non-blocking `react-hooks/set-state-in-effect` lint rule that fires on `useEffect(() => { load(); }, [load])`-style code that predates this feature across the codebase (e.g. `ProfilePageView.tsx:54` on unmodified code). Not worth chasing.

Run commands:
```bash
# backend, from lucy-charm-api/
TEST_DB_CONNECTION_URL="postgresql://postgres:postgres@localhost:5432/lucy_charm_test_db" uv run pytest tests/unit -q
TEST_DB_CONNECTION_URL="postgresql://postgres:postgres@localhost:5432/lucy_charm_test_db" uv run pytest tests/integration/test_property_checkup.py -q

# frontend, from lucy-charm-web/
npx tsc --noEmit
npx jest --silent
```

Dev DB is `lucy_charm_db` (not the test DB) on `localhost:5432`, real SMTP is configured in `.env` (a real Gmail account), so magic-link sign-in actually sends email. Seeded agent accounts on `@yopmail.com` (e.g. `marcus.chen@yopmail.com`, `hannah.wilson@yopmail.com`) are checkable at the public inbox `yopmail.com` without a password — useful for testing the agent/admin side without owning that inbox. `superadmin@lucycharms.ca` is not reachable this way.

## Bugs found and fixed this session (in case any regress)

1. **Finished-basement rule never fired** — was requiring both `has_basement` (mapped from unreliable `BasementYN`) and `basement` text to be truthy; they disagree on almost every real record. Fixed by dropping the `has_basement` condition.
2. **Cache-regeneration `IntegrityError`** — constructing a *new* `PropertyCheckupCache` object with an *existing* row's id caused an INSERT collision. Fixed by mutating the tracked object in place.
3. **`attach_to_showing` was dead code** — wired but never called from `ShowingRequestsService.create()`. Fixed; questions now actually reach the agent when a showing is submitted.
4. **`database_is_clean()` test helper didn't clean up the 3 new Property Checkup tables** — any test leaving a row behind broke the *next* test with a stale FK. Fixed the deletion order in `tests/steps/database.py`.
5. **`find_showing_questions_for_listing` never filtered by attachment** — a question already sent with an earlier showing kept reappearing as "about to be sent" in the Request Showing modal for a *later* showing, but would silently never actually attach (the attach step already skips attached rows). Fixed by filtering to `showing_request_id IS NULL`.
6. **The same root cause was worse than just a display bug** — the unique index on `(user_id, listing_id, source_rule_id, kind)` was a *full* unique index, so once a rule's showing-question had been sent once, it could **never** be added to a *different, later* showing on the same listing — `add_question`'s idempotent lookup would just keep handing back the old, permanently-attached row. Fixed with migration `i7j8k9l0m1_showing_question_reuse.py`: the index is now partial (`WHERE showing_request_id IS NULL`), so uniqueness only applies to still-pending rows. `find_existing()` updated to match.
7. **Button state (Saved / Added) never survived a page refresh** — it only lived in React state, nothing re-read it from the DB on mount. Fixed by adding `GET /property_checkup/listing/{id}/my_questions` (hydrates saved rows + still-pending showing-questions, correctly excluding already-sent ones) and wiring it into `PropertyCheckupPanel` on load.
8. **Local-storage bookmark entries saved before a schema field existed rendered as literal `"undefined"`** — happened once mid-session when a field was added to the local-storage shape; the read path now needs to tolerate old shapes if this pattern is touched again. (This particular field was later reverted — see below — but the general lesson: any change to what's stored in `lucy-property-checkup-local-questions` needs a read-time guard against pre-change entries already sitting in a real browser's storage.)

## Design decisions worth knowing before you change anything

- **"Save question" and "Add to showing questions" are deliberately different, per spec** (Clarifications Part 2 §7 vs §8). Save = personal bookmark, never reaches anyone. Add to showing questions = explicit hand-off, only actually reaches the agent once the buyer *submits* a showing request (attach happens then, not at click time). This was relitigated once mid-session — an earlier attempt to show signed-out "Save question" bookmarks inside the Request Showing modal was **built and then reverted** because it blurred this exact distinction. Don't reintroduce that without being sure it's wanted.
- **"Add to showing questions" is signed-in only, and that's intentional**, confirmed against the literal spec text: Clarifications Part 1 §7 carves out an explicit signed-out exception for Save question only; no equivalent exists for Add to showing questions anywhere in the documents.
- Both action buttons are now toggleable (click again to unsave/remove) and turn green when active — this was a deliberate UX improvement beyond the literal spec text, requested directly by the user in this session.
- Buyer-facing status model for Deeper Review is the **3-state** one from Clarifications Part 1 §5 (Requested → Under Review → Response Ready), which explicitly overrides the base spec's more granular status list.

## Known gaps / open questions for whoever resumes

- Marketing consent checkbox (Clarifications Part 1 §6) — not built, flagged as a product decision, not a technical one.
- No frontend surface for staff to write `internal_notes` on a review request (the DB field exists, no endpoint accepts it) — spec doesn't clearly require it at launch, wasn't built.
- The browser automation tooling used during manual verification this session was intermittently flaky (blank screenshots, non-registering clicks) independent of app correctness — if you hit the same thing, prefer DB-level verification (`psql` against `lucy_charm_db`) or `javascript_tool` DOM queries over relying on screenshots.

## If the user just says "resume" or gives you a new Property Checkup task

1. Re-read this file in full first.
2. Check `git status` in both repos to see if anything's changed since this was written (was it committed? did someone else touch it?).
3. Run the test commands above to confirm the baseline still holds before making changes.
4. If the ask references the spec, re-extract the `.docx` files rather than trusting paraphrase from memory — the Clarifications documents especially have specific wording that matters (exact button copy, exact status names, etc.).