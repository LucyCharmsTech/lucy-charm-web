# Task 11 — Document Centre & Secure File Workflows: Summary

**Branches:** `feature/document_centre` on both repos
**Backend:** `lucy-charm-api` — commits `ad03495` (document centre) and `221a469` (ID verification sync)
**Frontend:** `lucy-charm-web` — working tree (pending commit)

The task converted the mock document centre into secure client, agent, and admin
workflows. Two headline changes:

1. **Documents now live in private S3** — files moved off server disk into a
   private bucket, reachable only through short-lived signed URLs, with every
   access audited.
2. **ID verification rebuilt on the document centre** — the showing ID flow now
   runs on the full document lifecycle (request → upload → review → replace →
   expire), and the showing's verification badge stays in sync automatically.

---

## Backend changes (`lucy-charm-api`)

**New API: `/api/v1/documents`** (11 endpoints)
upload · upload revision/replacement · request a document (staff) · review
(staff) · mark missing (staff) · list by resource · get · version history +
audit trail · signed download URL · signed preview URL · soft delete.

- **Private S3 storage** with ~5-minute presigned URLs; downloads are a
  two-step flow (JSON with a signed URL, never the file through the API).
  The previously unauthenticated `POST /upload` into public storage was locked
  down (agent/superadmin only, magic-byte validation, nosniff/CSP headers).
- **Nine-status lifecycle** enforced through a single transition table:
  `requested, missing, uploaded, under_review, accepted, rejected,
  replacement_needed, expired, superseded`. Illegal transitions return 409.
- **Role-based access:** documents are visible only to their owner, the
  managing agent, and superadmins. Cross-user access returns **404, never
  403** (a 403 would confirm the document exists). Staff can attach
  **internal-only** files the client never sees.
- **Client reason vs. internal note:** `client_reason` (shown to the client)
  and `review_note` (staff only) are separate columns, so showing the client
  their rejection reason can never leak staff notes.
- **Versioning:** a re-upload creates a new version and marks the old one
  `superseded`; the rejected file and its reason stay readable (as promised to
  the client). Filling a `requested` placeholder keeps the same id.
- **Append-only audit log** covering every action — upload, view, download,
  review, replace, delete, expiry, purge. Signed URLs audit *before* they
  mint, so no download can go unlogged.
- **Upload validation:** 10 MB cap, PDF/JPEG/PNG/WebP only (GIF deliberately
  excluded for documents), real magic-byte checks against the declared type.
- **Notifications & realtime:** five new events (`document.requested`,
  `.reminder`, `.uploaded`, `.reviewed`, `.expired`) through the existing
  notification centre and WebSocket. Notification bodies are deliberately
  vague; reasons live behind the authenticated deep link.
- **Background jobs:** document expiry (driven by the document's own
  `expires_at`), overdue-request reminders (max once/day), and retention
  purge, plus `run_document_jobs.py` to run them.
- **ID verification sync** (`221a469`): identity-document actions move the
  showing request's `id_verification_status` exactly like the legacy flow —
  upload → `pending`, accept → `verified`, reject / replacement needed →
  `pending`. A voluntary re-upload never demotes a verified showing. Each
  change publishes `showing.id_verification_changed` so open pages update live.
- **Migration:** new `documents` + `document_audit_log` tables, and an
  idempotent backfill script that moves legacy showing IDs from local disk
  into S3 (see rollout notes below).
- **Tests:** ~84 new tests across lifecycle, validation, storage, workflows,
  access control, and upload security.

## Frontend changes (`lucy-charm-web`)

**New service layer** — `services/documentService.ts`: typed client for all 11
endpoints, error classification (404 renders "not available", never "no
permission"; 409 treated as "your view is stale — refetch"), client-side
upload preflight mirroring the server limits, and status helpers. Document
types added to `types/api.ts`.

**Client (buyer) side**
- Profile **Documents section** rebuilt on the new API: per-showing document
  list, upload for requested/rejected documents, statuses that say what the
  agent actually did ("Requested by your agent", "Rejected", "New copy
  requested", "Approved", "In review", "Expired"), the agent's reason shown on
  rejected/replacement documents, and "Preferred by" due dates that never
  block a late upload.
- **Upload button hides once a document is approved** — it returns only when
  staff act again (new request, rejection, replacement ask) or the document
  expires.
- **Safe in-browser preview** (PDF/JPEG/PNG/WebP) over signed URLs — minted at
  the moment of use, re-minted before expiry, never cached or logged;
  sandboxed iframe for PDFs; graceful download fallback for anything else.
- **Version history** ("Show history" / "Close history") with every previous
  version, its outcome, reason, and download.
- Post-showing-request ID upload step and profile schedule section rewired to
  the new flow; live updates when a document notification arrives on the
  socket.

**Agent / admin side**
- New **Documents dialog** on both showings pages (button always available):
  document list with staff statuses, preview/download (review stays disabled
  until the file has been opened), **three review outcomes** (accept, reject,
  ask for a new copy) with the client-visible reason required unless
  accepting, and the internal note visually separated ("the client never sees
  this").
- **Request a document** form — category, note to the client, and a
  "Preferred by" date (labelled honestly: it is a preference, not a deadline).
- Mark an outstanding request **missing**, full history with the audit trail,
  internal-only badges, and stale-review handling (if the client replaced the
  file mid-review, the dialog says so and refreshes).
- `/documents/[id]` page so notification deep links land somewhere useful;
  notification icons for the five new event types.
- All legacy identity components and API calls removed.

---

## Scope — included

Per the task and the client's answers to our queries:

- ID is the **only live document category**, on infrastructure built for more.
  The request dropdown also offers proof of funds, pre-approval, and a generic
  "other"; the API accepts further categories beyond those. All work
  end-to-end through the same generic flow. *(Client answers 1, 7)*
- Clients **see their rejected file and the reason**, not just the latest
  upload. *(Answer 2)*
- Agents/admins can **request a document** with a preferred due date — no
  expiry, nothing enforced when the date passes. *(Answer 3)*
- **Replacement needed** as a third review outcome. *(Answer 4)*
- **Expiry driven by the document's own validity date.** *(Answer 5)*
- **Internal staff files/notes** invisible to clients; agent + admin
  visibility. *(Answer 6)*
- Upload, download, safe preview, categories, descriptions, expiry dates,
  version handling, full status set, role-based access, private storage,
  signed URLs, size/type limits, audit history, notifications, retention jobs
  — all task bullets except where noted below.

## Scope — excluded / deferred

- **Malware scanning — excluded.** The *gate* exists (`scan_status` column;
  infected files are refused with 403) but **no scanner is wired**; every
  document currently reads `skipped`. Wiring a real scanner (e.g. ClamAV or an
  S3 scanning service) is a follow-up.
- **Legacy endpoint re-pointing (phase 2) — deferred.** The old
  `/showing_requests/{id}/identity_documents` endpoints still exist and read
  the old table. They are no longer used by the frontend and should be
  re-pointed at the document centre (or removed) after the backfill has run
  everywhere.
- **Dedicated UI for non-ID categories — deferred by design.** The client
  asked only for a manageable foundation; the UI is generic, but no flows
  besides ID verification exist today.
- **Anonymous document access — intentionally unsupported.** Every document
  endpoint requires login; a document request against a showing with no client
  account is refused (there is nobody to ask).
- **Auto-fail on due date — intentionally excluded** per the client: due dates
  are a preference. Only staff can mark a request missing, and a late upload
  is always accepted.
- **Office/SVG preview — excluded.** Preview covers PDF and images; everything
  else falls back to download.

## Rollout prerequisites

1. **S3 configuration** per environment (bucket, credentials — see
   `.env.spec`); `verify_s3_storage.py` checks the wiring.
2. **Run the backfill** per environment until it reports nothing left:
   `uv run python -m app.scripts.backfill_identity_documents` (supports
   `--dry-run`). Existing IDs won't appear in the document centre until then.
3. **Schedule the jobs** (`run_document_jobs.py`) for expiry, reminders, and
   retention purge.
4. Restart the API so the ID-verification sync is live.
