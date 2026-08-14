# Client code review — fixes (Web)

## Scope

The client's code review flagged four issues across the frontend and API repos.
This doc covers the one that lives in this repo. The other three are backend —
see `lucy-charm-api/.docs/client-review-fixes.md`.

---

## Document uploads sent the wrong `Content-Type`

**File:** `services/documentService.ts` — `uploadDocument()` and
`uploadDocumentRevision()`.

**The bug.** A multipart file upload needs a `Content-Type` header like:

```
multipart/form-data; boundary=----WebKitFormBoundary7MA4YWx...
```

The `boundary` value is random per-request and is what lets the server tell
where one field/file ends and the next begins. Only the browser (or axios,
reading the `FormData` body) can generate it correctly.

Both upload functions were setting the header manually to the literal string
`multipart/form-data`, with no boundary:

```ts
headers: { 'Content-Type': 'multipart/form-data' }
```

This overrides whatever axios would have set automatically, so the request
went out with no boundary at all — the API could reject or misparse the body
before the upload handler even ran.

**Why it happened.** `lib/axios.ts` sets a client-wide default of
`Content-Type: application/json` on the shared `api` instance. Whoever wrote
these two calls was (correctly) trying to override that default for a
`FormData` body, but overrode it with a hardcoded string instead of clearing
it.

**The fix.** Set the header to `undefined` instead of a string. This unsets
the JSON default for just this request, and axios/the browser fill in the
correct value — including the boundary — when they see the body is
`FormData`.

```ts
headers: { 'Content-Type': undefined }
```

Applied to both call sites (`/documents` and `/documents/:id/file`).

**Tests.** No dedicated automated test — this only manifests against a real
browser/axios multipart encoder, not against a mocked client. Verify manually:
upload a document from the client profile page and confirm it lands as
`uploaded` rather than failing.
