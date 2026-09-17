# Resources: the "existing editor" does not exist

**Plan item 4.4.** Raised during step 22.

## What the scope says

> Three guides at launch, **reusing the existing editor for draft/preview/
> publish**. *"No empty/fabricated articles or **new publishing platform**."*
> Writing the articles is **explicitly excluded** from Option A.

## What is actually there

There is no article editor in either repository. Searched for, and did not
find:

| Looked for | Result |
|---|---|
| A content/article/post/page table | None. |
| A draft → preview → publish workflow for public copy | None. The `draft` states that exist are `seller_domain` listings and the Property Review / Home Value reports — client-specific documents, not published pages. |
| An admin editing screen | The admin app has chat logs, escalations, failed submissions, feed, inquiries, insights, listings, property reviews, sellers and showings. No content editor. |
| A headless CMS integration | None configured. |
| `ai_rules` — the closest thing | It stores markdown for **retrieval by the assistant**, indexed into chunks with a visibility flag. It is a RAG corpus, not a publishing tool: no titles, no slugs, no preview, no public rendering, and its content is written to be read by a model. |

## Why this was not simply built

The same sentence that says to reuse an existing editor says not to build a
**new publishing platform**. Building one would be the larger of the two
instructions violated, and it is a substantial piece of work — an editor, a
preview, a publish gate, a public renderer, and a permissions model — that
nobody has scoped or priced.

Writing the guides is explicitly excluded from Option A anyway, so an editor
with nothing to edit would deliver nothing this tranche.

## What was built instead

`/resources` renders the guide list from `content/siteContent.ts`. Today that
list is empty and the page says the guides are being written, pointing at
Contact and at the assistant. When guides exist, they render — **no page
rework**, which is the scope document's *"built to receive them"*.

A test refuses a guide with no body text, so the *"no empty/fabricated
articles"* rule survives whoever adds the first one.

## The question for Lucy

Three routes, roughly in ascending cost:

1. **Guides live in the codebase.** Add each as an entry in
   `content/siteContent.ts`, with a developer deploying it. Zero new platform,
   and correct if three guides is genuinely the ceiling. Lucy cannot publish
   without us.
2. **A hosted editor you already pay for** — if the brokerage has a CMS,
   Notion, or a marketing tool we have not been told about, we read from it.
   Cheapest if it exists. **This is the option the instruction seems to
   assume**, and is why we are asking rather than guessing.
3. **Build the editor.** A real piece of work, and by the scope document's own
   wording out of Option A.

Route 1 is what is in place. It costs nothing to change to route 2 later,
because the page reads a typed list either way.
