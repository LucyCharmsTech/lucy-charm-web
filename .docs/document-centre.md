# Document centre (Web)

## Scope

Frontend for Task 11. Covers the secure document workflows built on
`/api/v1/documents`: client upload/preview/history on the profile, the staff
review dialog on both showings pages, document requests with preferred due
dates, the expiry date field, the notification deep-link page, and the sync
between identity documents and the showings "ID verification" column.

Storage, validation, the audit log, the lifecycle rules, and the jobs live in
the API — see `lucy-charm-api/.docs/document_centre.md`. The integration
contract this UI was built against is `document_centre_frontend.md` at the repo
root. Tests for this task: `__tests__/document-centre/`, described in the
companion section at the end.

---

## Status

Complete. The UI calls `/documents/*` directly; nothing is mocked and there is
no feature flag. The legacy identity-document components and the
`/showing_requests/{id}/identity_documents` service calls were **removed** from
this repo — the old endpoints still exist in the API but have no frontend
callers.

Verified end-to-end against a live local API (upload → pending, accept →
verified, voluntary re-upload keeps verified, reject → pending, request →
pending), plus `tsc`, the Jest suite, and a production build.

Rollout prerequisites live API-side: S3 credentials per environment, the
identity-document backfill script, and the expiry/reminder/purge jobs.

---

## What already existed

- **Showing ID verification (legacy).** Upload during/after a showing request,
  agent review with verify/reject, files on the API server's local disk, three
  statuses, no history (a re-upload replaced the file), no document requests,
  no audit trail. Components: `ShowingIdentityUploadButton`,
  `ShowingIdentityAwaitingMessage`, `ShowingIdentityReviewDialog` — all deleted
  by this task.
- **The rails this task plugs into.** The notification centre and its
  `notificationMeta` visuals, the realtime layer (`lib/realtime/`), the
  showings surfaces on both portals, and `lib/axios.ts` with its 401-refresh.

---

## Surfaces

| Where | Component |
|---|---|
| Client profile → Documents | `components/profile/ClientDocumentsSection.tsx` |
| Post-booking "Upload your ID" step | `components/listings/detail/RequestShowingIdUploadStep.tsx` |
| Agent / admin showings → Documents | `components/documents/ShowingDocumentsDialog.tsx` |
| Notification deep links | `app/documents/[id]/page.tsx` |
| Shared pieces | `components/documents/` — card, badge, upload button, preview dialog, history list |

---

## The two statuses — do not conflate them

The single most confusing thing in this feature, and the first thing to check
when a badge "does not update":

1. **A document's own status** (`requested … superseded`) belongs to the
   document row and changes for **every** category. It renders via
   `DocumentStatusBadge` on cards and in the dialog.
2. **The showings "ID verification" column** (`not_requested | pending |
   verified`) belongs to the showing request and reflects **only the
   `identity` category**. Requesting, uploading, or reviewing a
   proof-of-funds or pre-approval document changes that document's own
   status and is *supposed* to leave this column alone.

The API keeps the column in sync for identity documents: request or upload →
`pending` (never demoting `verified`), accept → `verified`, reject /
replacement needed → `pending`. Each change publishes
`showing.id_verification_changed`, which `useLiveShowingRequests` already
patches into both showings surfaces. The frontend contains **no** sync logic —
an earlier workaround that PATCHed the showing after review was removed once
the API took this over. Don't reintroduce it: a double writer means double
realtime events.

---

## Service layer

`services/documentService.ts`. All endpoints authenticated via `lib/axios.ts`.

| Method | Path | Wrapper |
|---|---|---|
| `GET` | `/documents?resource_type&resource_id[&category]` | `fetchDocuments()` |
| `GET` | `/documents/{id}` | `fetchDocument()` |
| `GET` | `/documents/{id}/history` | `fetchDocumentHistory()` |
| `POST` | `/documents` (multipart) | `uploadDocument()` |
| `POST` | `/documents/{id}/file` (multipart) | `uploadDocumentRevision()` |
| `POST` | `/documents/request` | `requestDocument()` |
| `POST` | `/documents/{id}/review` | `reviewDocument()` |
| `POST` | `/documents/{id}/missing` | `markDocumentMissing()` |
| `DELETE` | `/documents/{id}` | `deleteDocument()` |
| `GET` | `/documents/{id}/download` | `mintDownloadUrl()` / `downloadDocumentFile()` |
| `GET` | `/documents/{id}/preview` | `mintPreviewUrl()` |

Every wrapper throws `DocumentError { status, detail, code }`. The `code`
union (`not_found | forbidden | conflict | too_large | invalid_file |
invalid_input | not_previewable | gone | storage_down | unknown`) is what UI
branches on; `documentErrorMessage()` turns it into user copy. Two rules are
encoded there and must survive refactors:

- **404 renders "This document isn't available", never "no permission".** The
  API returns 404 for someone else's document precisely so existence is not
  confirmed; wording that hints at permissions undoes that.
- **409 means "your view is stale".** Refetch, then explain — it nearly always
  means the document moved underneath the user (e.g. a review racing a
  replacement).

Upload behaviour is decided by the **target**, not a flag: `uploadDocument()`
creates a first version; `uploadDocumentRevision(id)` fills a file-less
`requested`/`missing` row **in place** (same id, still v1) or supersedes a row
that has a file (new id, v+1). A replacement therefore changes **two** rows —
always refetch the collection, never patch one entry.

---

## Signed URLs

`/download` and `/preview` return JSON holding a presigned S3 URL
(`expires_in` ≈ 300s), not the file. The URL is a bearer credential:

- Minted at the moment of use, never cached, never stored, never logged.
- `downloadDocumentFile()` creates an `<a download>`, clicks it, and removes it
  so no URL lingers in the DOM. No "copy link" affordance anywhere.
- `DocumentPreviewDialog` re-mints at 80% of the TTL (30s floor) so a preview
  left open does not break; PDFs render in a **sandboxed** iframe; a 415 falls
  back to a download button rather than an error.
- Every mint writes a server-side audit row attributed to the caller — do not
  prefetch speculatively; it manufactures "viewed" events.

---

## Status model in the UI

`DocumentStatusBadge` has two vocabularies: client copy says what the agent
did ("Requested by your agent", "Rejected", "New copy requested", "Approved",
"In review", "Still needed", "Expired"); staff surfaces pass `staff` for the
literal state. Product decisions baked into helpers, with the reasoning:

- `SHOWS_UPLOAD_CTA` = `ACCEPTS_UPLOAD` minus `accepted`. The API accepts a
  voluntary re-upload on an approved document; the UI deliberately doesn't
  offer it. The button returns when staff act again (request, reject,
  replacement) or the document expires.
- `isDocumentOverdue()` is UI-only: `due_date` is **advisory** (the client
  asked for "a preferred due date", not a deadline). Show an Overdue chip,
  sort overdue first, never gate the upload on it. `missing` is set by staff
  explicitly — never computed from the date.
- `superseded` rows are history: excluded from main lists
  (`isHistoryDocument`), reachable through "Show history", where the rejected
  file stays downloadable next to its `client_reason` — both promised to the
  client.
- The same endpoint returns two shapes; `isStaffDocument()` probes for a
  staff-only key (`review_note`) instead of trusting the viewer's role, because
  an agent who doesn't manage the showing gets the client shape.

`client_reason` (client-visible) and `review_note` (staff-only) are separate
fields end-to-end. The review form labels them "the client will read this" /
"the client never sees this" and styles them apart — that labelling is the
only thing standing between a reviewer and pasting an internal note into the
client-facing box.

---

## Upload validation and the expiry field

`preflightDocumentFile()` mirrors the server for instant feedback: empty file,
10 MB cap (`DOCUMENT_MAX_BYTES`), PDF/JPEG/PNG/WebP only, extension must match
the declared MIME type. **GIF is deliberately absent** — the listing-image
allowlist accepts it, documents do not; don't copy one into the other. The
server remains the authority (it checks magic bytes, the browser can't) — a
422 `detail` is written for end users and is surfaced verbatim.

`DocumentUploadButton` takes `withExpiryField` — an optional "Document expiry
date" input (the date printed on the document, e.g. an ID card's expiry),
enabled on all three client upload spots. It posts as end-of-day so a document
stays valid through its printed date; the picker's `min` starts tomorrow
because the API rejects past dates. This is `expires_at` (drives
`accepted → expired` via the API's job) — a different thing from the staff
request form's advisory `due_date`, and a different thing again from
`retention_expires_at`, which is staff-shape-only and never rendered.

---

## Notifications and realtime

Five event types render in the bell via `notificationMeta.ts`:
`document.requested`, `.reminder`, `.uploaded`, `.reviewed`, `.expired`, all
deep-linking to `/documents/{id}`. Titles/bodies are deliberately vague — a
rejection reason must never reach a lock screen or email subject, so the UI
never tries to read one out of a notification payload; it fetches the document
and reads `client_reason`.

`ClientDocumentsSection` refetches on `notification.created` events whose
`resource_type` is `document`, and on socket reconnect
(`useRefetchOnReconnect`). The showings badges update through the existing
`showing.id_verification_changed` handling — nothing new was added there.

---

## Files

**New**

- `services/documentService.ts` — wrappers, `DocumentError`, preflight, status
  helpers
- `components/documents/` — `ClientDocumentCard`, `DocumentStatusBadge`,
  `DocumentUploadButton`, `DocumentPreviewDialog`, `DocumentHistoryList`,
  `ShowingDocumentsDialog`
- `app/documents/[id]/page.tsx`, `app/documents/layout.tsx` — deep-link target
- `__tests__/document-centre/` — see below

**Edited**

- `types/api.ts` — document types (§ Document centre), five notification event
  types, legacy `ShowingVerificationDocument` removed
- `components/profile/ClientDocumentsSection.tsx` — rebuilt on `/documents`
- `components/profile/ClientShowingScheduleSection.tsx` — inline upload
  replaced with a "Manage ID documents" link to `#documents`
- `components/listings/detail/RequestShowingIdUploadStep.tsx` — new upload flow
- `app/agent/showings/page.tsx`, `app/admin/showings/page.tsx` — Documents
  button (always visible), `ShowingDocumentsDialog`
- `components/notifications/notificationMeta.ts` — icons/tones for the five
  event types
- `services/showingService.ts` — four legacy identity wrappers removed

**Deleted**

- `components/profile/ShowingIdentityUploadButton.tsx`
- `components/profile/ShowingIdentityAwaitingMessage.tsx`
- `components/agent/ShowingIdentityReviewDialog.tsx`

---

## Out of scope / excluded

- **Malware scanning.** The gate exists API-side (`scan_status`; an `infected`
  file is refused and the dialog badges it) but **no scanner is wired** —
  everything reads `skipped` today. Do not build UI treating `skipped` as a
  problem; that flags every document in the system.
- **Dedicated UI for non-ID categories.** The frontend offers four categories
  (`identity`, `proof_of_funds`, `pre_approval`, `other` — see
  `DOCUMENT_CATEGORY_LABELS`); `agreement` and `inspection` were dropped from
  the dropdown as never client-confirmed, though the API still accepts them.
  All offered categories work end-to-end through the generic components; only
  the ID flow has purpose-built UX, and only `identity` drives the showings
  ID-verification column. This matches the client's "only ID for now, keep it
  modifiable" answer.
- **Anonymous document access.** Every endpoint requires a session. Requesting
  a document on a showing with no client account returns 409 — the dialog
  shows "there is nobody to send the request to".
- **Office/SVG preview.** PDF and images only; everything else falls back to
  download.

---

## Local testing

Needs the API with S3 configured (`verify_s3_storage.py` to check). Sign in as
a client with a showing, and as its agent, then:

1. Agent → showings → **Documents** → *Request a document*, type left as
   **ID document** → the row's ID verification column flips to `pending`
   immediately; the client gets a `document.requested` notification
2. Client → profile → Documents → the request shows "Requested by your agent"
   with the note and "Preferred by" date → upload a PNG/PDF, optionally set the
   expiry date → status "In review"; column stays `pending`
3. Agent → dialog → **Preview** (Review stays disabled until viewed) → Accept →
   column flips to `verified`; client gets `document.reviewed`
4. Client uploads a new copy voluntarily → column **stays** `verified`
5. Agent → Reject with a reason → column back to `pending`; the client card
   shows the reason and "Upload a new copy"; **Show history** lists the
   rejected version, still downloadable
6. Repeat step 1 with type *Proof of funds* → the document flows normally but
   the ID verification column does **not** move (see "The two statuses")
7. Upload an 11 MB file or a `.txt` → refused locally with the reason before
   any network call
8. Open a notification → lands on `/documents/{id}` with preview, history, and
   (if action is needed) the upload button

---

## Companion tests (`__tests__/document-centre/`)

Same philosophy as `.docs/realtime-testing.md`: pin down the decisions that a
refactor could quietly undo, not line coverage.

| File | Pins down |
|---|---|
| `documentService.test.ts` | preflight mirror of the server (cap, allowlist, extension mismatch, GIF excluded), error-copy rules (404 wording, scan-blocked 403, verbatim 422), advisory-due-date logic, `SHOWS_UPLOAD_CTA` vs `ACCEPTS_UPLOAD`, staff-shape probe, client sort order |
| `DocumentStatusBadge.test.tsx` | client vs staff vocabulary, Overdue chip only on an overdue `requested` row |
| `ClientDocumentCard.test.tsx` | a file-less `requested` row renders without crashing, reason shown on rejection, upload hidden on `accepted`, history toggle labels |

Run with `npm test`.
