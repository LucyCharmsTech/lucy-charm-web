# Accessibility and Core Web Vitals

**Controls 2.6 and 2.8 · plan item 4.7.** Measured 6 September 2026.

> Hamed: *"Before traffic is sufficient, use representative mobile/lab tests;
> measure field data after launch. **Do not claim a field pass from lab results
> alone.**"*

This document keeps that distinction. Everything below is **lab**. Nothing here
is a field result, and none of it should be quoted as one.

---

## Core Web Vitals — lab, simulated mobile

Lighthouse 13.4, mobile form factor, simulated throttling, production build
(`next build` + `next start`). **The API was not running**, so pages that fetch
data render their empty state — noted per page.

| Page | Perf | LCP | CLS | TBT | Against the 2.5s / 0.10 targets |
|---|---|---|---|---|---|
| `/about` | 99 | **1.7s** | **0.00** | 20ms | ✅ |
| `/home-value` | 99 | **1.7s** | **0.00** | 20ms | ✅ |
| `/resources` | 99 | **1.7s** | **0.00** | 20ms | ✅ |
| `/sell` | 99 | **1.7s** | **0.00** | 30ms | ✅ |
| `/contact` | 93 | 3.1s | **0.00** | 20ms | LCP over |
| `/listings` | 90 | 3.3s | **0.00** | 110ms | LCP over · *API down* |

**CLS is 0.00 everywhere** — inside the premium 0.05 target, not merely the
0.10 one.

**TBT is 20–110ms.** TBT is the lab proxy for INP; INP itself needs real
interactions and cannot be measured in a lab run.

`/contact` measured three times: **3.12, 3.13, 3.14s**. Not noise — it is
genuinely slower than `/about` despite an almost identical payload (389 KiB vs
392 KiB), so the difference is what the LCP element is and when it paints,
not what is downloaded.

### One regression found and fixed during this pass

`/home-value` measured **85 / 4.3s**. The cause was mine: the form had been
made client-only (`ssr: false`) to avoid a hydration mismatch when restoring a
saved draft from `sessionStorage`, which meant the whole form waited for the
client bundle.

Replaced with `useSyncExternalStore` and a null `getServerSnapshot` — the
React-sanctioned way to read a browser-only value without the server and the
hydration pass disagreeing. Server rendering restored: **99 / 1.7s**.

### A second fix, with a wider effect

`HealthIndicator` rendered a 4px coloured bar at the top of **every production
page** and polled `/health` every ten seconds, from every open tab, forever.
It is a development aid; it now renders in development only. That removed a
request from every page load, an indefinite background timer, and a red bar
customers could see when the API was unreachable.

### What is *not* claimed

- **No field data exists.** Targets are 75th-percentile of real visits. A percentile cannot be computed from one machine on one simulated connection.
- `components/WebVitalsReporter.tsx` reports LCP, INP and CLS from real visits, so field data can be gathered once there is traffic. Without it there would be no way to ever measure the thing the control actually asks for.
- **Simulated mobile throttling is deliberately pessimistic** (~1.6 Mbps, 150ms RTT). A 3.1s lab LCP does not mean the field target is missed — nor does a 1.7s lab LCP mean it is met. Both directions of that inference are what the instruction rules out.

### Known, unfixed

- **`app/favicon.ico` is 25.9 KiB** for four small icons — roughly five times what that content needs. Fetched on every page. Not in the LCP path, so it changes no number above, but it is free bytes to reclaim. Left alone because it is a brand asset.
- **~106 KiB of unused JavaScript** per page, largely framework and shared chunks. Reducing it means route-level code splitting decisions, which is real work with real regression risk, and the pages already pass TBT comfortably.

---

## Accessibility — WCAG 2.2 AA

### Automated, per component and per page

`jest-axe` across the interactive surfaces: **29 tests, no violations**.

Covered: the two-step verification challenge and setup, recovery codes, the
"Not sure" field in both states, the confirmation step, the AI disclosure, the
Home Value report, published content sections, **all nine portal card states**,
and the About, Resources, contact, email sign-in and Home Value pages as whole
documents.

Whole pages as well as components on purpose: the failures that only exist in
composition — two `id`s colliding, a heading level skipped, a landmark nested
in another — are invisible to a component-level check.

### Lighthouse accessibility: 96 on every page

One failing audit, everywhere: **`color-contrast`**.

### The contrast failure — resolved

Hamed chose **option B: keep the brand colour exactly, darken the text.** So
`--primarycolor` is untouched at `#ff01c0`.

Implementing it surfaced **three separate cases**, not one. The first was the
one originally measured; the other two only appeared when the site was
re-measured *after* the fix:

| # | Case | Was | Now | Ratio |
|---|---|---|---|---|
| 1 | White text **on** the brand pink | `#ffffff` — 3.49 | `--primarycolor-foreground: #0a0a0a` | **5.67** light · **4.94** dark |
| 2 | The brand pink **as** text on white | `#ff01c0` — 3.48 | `--primarycolor-text: #d1019d` light, `#ff01c0` dark | **5.00 / 4.79 / 4.55** |
| 3 | `text-zinc-400`, `text-red-500` as light-mode text | 2.62 · 3.81 | `zinc-500` · `red-600` | **4.83** · **4.77** |

**Case 2 is the one worth noting.** The decision was about text *on* the pink.
The pink used *as* small text on white is the reverse situation with a
different answer, and it was invisible until the first fix was measured. So
`--primarycolor-text` is **theme-aware**: deeper in light mode, and the brand
value in dark mode, where `#ff01c0` on a dark surface already measures
5.08–5.70 and darkening it would make it *less* legible.

### Three near-misses a check against white alone would have passed

Each is a fraction below the line, invisible to the eye, and would have
shipped:

- **`#18181b` on the dark-mode brand `#eb1da3` — 4.42.** The obvious foreground colour, comfortably passing light mode at 5.08. Anyone checking one theme would have believed the job done. `#0a0a0a` is used instead: 5.67 / 4.94.
- **`zinc-500` on a `#f4f4f5` panel — 4.39.** Passes white (4.83) and `#fafafa` (4.62), then fails a zinc-100 panel **by 0.11**. There is one such place on the site; it now uses `zinc-600`.
- **The `bg-primarycolor/90` badges over listing photos.** The effective background depends on the photo. White fails on every backdrop (3.38–4.22); the token passes on all of them (4.69–5.86).

### Result

**Every page scores 100 for accessibility, with no failing audits.**

| Page | a11y | Perf | LCP | CLS |
|---|---|---|---|---|
| `/about` | **100** | 99 | 1.7s | 0.00 |
| `/chat` | **100** | 97 | 1.7s | 0.08 |
| `/contact` | **100** | 93 | 3.1s | 0.00 |
| `/home-value` | **100** | 99 | 1.8s | 0.00 |
| `/listings` | **100** | 90 | 3.3s | 0.00 |
| `/login` | **100** | 93 | 3.1s | 0.00 |
| `/register` | **100** | 93 | 3.1s | 0.00 |
| `/resources` | **100** | 99 | 1.7s | 0.00 |
| `/security` | **100** | 92 | 3.2s | 0.00 |
| `/sell` | **100** | 99 | 1.7s | 0.00 |

`lib/contrast.ts` records the decision, the rejected alternatives, and **why
each was rejected** — with tests asserting all of it, including that `#18181b`
really does fail dark mode, so nobody reintroduces it believing otherwise.

### What automation does not prove

`axe` and Lighthouse catch what is machine-checkable: missing labels, unnamed
controls, broken ARIA, invalid nesting, contrast. That is most real-world
failures and **it is not all of WCAG 2.2 AA**. These need a person:

- **Focus order and keyboard traps.** Every dialog uses `<dialog>` or a focus-managed panel, but "tab through the whole site" is a human task.
- **Whether alt text is *useful*.** A checker sees only that it exists.
- **Whether an error message explains anything.** "Invalid input" passes every automated rule and helps nobody.
- **Reflow, orientation and target size** (2.5.8, new in 2.2) — these need a real viewport.

**So: every automated AA check now passes, with no exceptions. A full manual
audit has not been done**, and this document does not claim one.
