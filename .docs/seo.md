# Search Engine Foundations (Web)

Option A §4, "Search engine foundations". **Control 2.12:** *"Use crawlable
content, unique metadata, canonical URLs, sitemap, robots controls and accurate
structured data. **Do not expose private portal content.**"*

Before this, none of it existed: no `robots.txt`, no `sitemap.xml`, no root
metadata, and therefore no working canonical URLs anywhere.

## One shared source of truth

`lib/siteUrl.ts` holds the public origin and the private-path list, and
`robots.ts`, `sitemap.ts` and the root `metadata` all read it.

That is the point. A canonical URL on one origin and a sitemap on another is a
common and quietly damaging mistake, and a path excluded from the sitemap but
left crawlable is worse. One list, three consumers.

| Export | Purpose |
|---|---|
| `siteUrl()` | Public origin, no trailing slash |
| `PRIVATE_PATH_PREFIXES` | Never indexed, never in the sitemap |
| `PUBLIC_ROUTES` | The sitemap's explicit allow-list |

### `NEXT_PUBLIC_SITE_URL` — needs setting before launch

`siteUrl()` falls back to `http://localhost:3000` so a developer build has a
valid `metadataBase` rather than throwing. **In production this must be set**,
or every canonical URL and the sitemap will point at localhost.

There is no `.env.example` in this repo, so it is recorded here. Owner: Geleta
(A3/A5 assign domain control to Lucy); Hamed confirms the production domain.

## `app/robots.ts`

Allows `/`, disallows every `PRIVATE_PATH_PREFIXES` entry, and declares the
sitemap and host.

`/unsubscribe` is on the disallow list because **its URL is itself a
credential** — indexing one would publish a working unsubscribe link for a real
recipient. The page also sets its own `robots: index false`, so it is covered
twice deliberately.

`/saved` is listed even though it redirects to `/profile#saved-homes`, so the
redirect target and the redirect are both private.

## `app/sitemap.ts`

The seven static public routes, from `PUBLIC_ROUTES`. An **explicit allow-list**
rather than a filesystem crawl: publishing a route should be a decision, not an
accident of where a file landed.

The homepage entry is the bare origin with no trailing slash, matching the root
canonical — `${base}` and `${base}/` are two URLs to a crawler.

### Listings are deliberately not in the sitemap yet

Listing detail pages are public and indexable, so they belong in a sitemap
eventually. Two things have to be settled first, and neither is ours:

1. **Volume.** Sitemaps cap at 50,000 URLs, so a full IDX catalogue needs a paginated sitemap index, not one file.
2. **Lifecycle.** Control 3.9 requires removed, expired, suspended and sold/gated records to show *"the correct permitted state"*. A sitemap naming a listing that has left the feed points crawlers at a dead or gated URL, so it must be generated from **active** listings at request time and revalidated as the feed changes.

Building that against a feed whose integration tests cannot currently run — the
IDX bearer token is unset outside staging, which is why 50 IDX tests fail —
would be guesswork. Recorded as a limitation rather than half-built.

## Metadata and canonicals

`app/layout.tsx` sets `metadataBase` from `siteUrl()`, a `title.template`
(`'%s | Lucy Charms Realty'`), a default description, the root canonical and
index/follow defaults.

**`metadataBase` is the load-bearing part.** Without an absolute base, Next
cannot resolve a relative `alternates.canonical` on a child page, so every
page-level canonical silently does nothing.

Five public routes are `'use client'` and cannot export `metadata`, so each got
a thin `layout.tsx` — the standard App Router split:

| Route | Title | Indexed |
|---|---|---|
| `/` | site default | yes |
| `/listings` | Homes for sale | yes |
| `/sell` | Sell your home | yes |
| `/contact` | Contact | yes |
| `/chat` | Ask Lucy | yes |
| `/login` | Sign in | **no** — a sign-in form has no search value and competes with the homepage |
| `/register` | Create your account | **no** |
| `/listings/[id]` | already had `generateMetadata` | yes |

`/chat`'s description names Lucy as an AI assistant and says a licensed
representative handles advice — control 2.5 and 4.1, in the one piece of
metadata a search result actually shows.

## Structured data — deliberately not added

Control 2.12 asks for *"accurate structured data"* and it is **not** here, on
purpose. Both plausible schemas are blocked:

- **`RealEstateAgent` / `Organization`** for the brokerage needs the verified brokerage and registrant identity, permitted title and registration wording. Hamed supplies those and instructs *"Do not invent registration details or publish unconfirmed team profiles."* Inventing them in JSON-LD would be publishing them.
- **`RealEstateListing`** for listing pages republishes listing data in a machine-readable form, which is a **rights question** under the IDX agreement, not a technical one. Control 3.1 requires an approved field map for public display and 3.13 forbids unapproved sources. Hamed's Q4 shows how narrowly he reads permitted use.

So this is the one part of 2.12 that stays open, and it is blocked on inputs
rather than on effort. Both are a small change once answered.

## Tests

```bash
npx jest __tests__/seo --silent   # 9
```

The tests that matter are the private-path ones. The risk here is not a missing
sitemap; it is a portal path quietly becoming crawlable, which nobody notices
until it is indexed.

## Verify the built output

```bash
npx next build
cat .next/server/app/robots.txt.body
cat .next/server/app/sitemap.xml.body
```

Both routes appear in the build output as `○ /robots.txt` and `○ /sitemap.xml`.
