# Lead management (Task 6, reduced scope) — frontend

Admin and agent surfaces for the lead pipeline: stages, assignment, the
Unassigned queue, the agent "My leads" page, and tags. Backend counterpart
(rules, endpoints, HubSpot): `lucy-charm-api/.docs/lead-pipeline.md`.

Out of this phase (client's cut): auto stage transitions, overdue/reminders,
notes changes, sync-status badges.

---

## Surfaces

| Where | What |
|---|---|
| `/admin/inquiries` | "All leads / Unassigned" tabs, per-row **Stage** dropdown, **Agent** column (name or amber Unassigned badge) |
| `/admin/inquiries/[leadId]` | "Pipeline" card: stage select + assigned-agent picker (admin-only action) |
| `/agent/leads` (new nav item "My leads") | Own leads only: contact, stage dropdown, temperature badge, score, source, **listing link**, **AI summary** (3-line clamp, full on hover), tag chips with inline add/remove |
| `/admin/insights` | **"Lead pipeline (current stage)"** panel: all 8 stages as bars, plus Total leads and Unassigned tiles (the latter links to Inquiries when non-zero) |

**Two panels, two meanings — label them clearly.** "Lead pipeline (current
stage)" shows where leads sit now; the older "Lead funnel" below it counts
events that happened. They are not duplicates and will not agree numerically.

## Services

- `services/leadService.ts` — staff calls shared by both portals:
  `fetchLeadsByAgent`, `updateLeadStage`, `fetchLeadTags`, `addLeadTag`,
  `removeLeadTag`. Backend enforces per-lead access (agent = own leads).
- `services/superadminService.ts` — admin-only additions: `assignLeadAgent`,
  `fetchAgentsAdmin`, `unassigned` param on `fetchLeadsAdmin`.

## Types

`types/api.ts`: `LeadStage` union + `LEAD_STAGES` const (8 stages, ordered),
`status: LeadStage` on `LeadRead`.

## Components

- `components/common/LeadStageSelect.tsx` — the shared stage dropdown.
  Optimistic: sets the value, calls the API, **rolls back on failure** and
  reports via `onError`. Exports `leadStageLabel()`.
- `components/agent/AgentLeadsView.tsx` — the agent page. Loads
  `fetchMyAgentProfile()` → `fetchLeadsByAgent(me.id)`. `LeadTagsCell` keeps
  per-row tag state; tag errors surface on the page-level alert.

## Behaviour notes

- Stage changes and reassignment are enforced server-side; the UI failing
  "politely" (rollback + message) is the expected UX for a 403.
- The agent page intentionally has **no notes** (explicitly out of scope) and
  no detail page — the listing link + AI summary cover the follow-up-call
  context.
- Unassigned leads exist by birth only (no listing, or legacy). Assignment is
  never cleared, so the Unassigned tab is a queue of never-owned leads.
- A signed-in user's chat lead shows their real name/email (backend
  enrichment); anonymous chat leads render "—" until the visitor signs up or
  books a showing with the same browser (anonymous-session merge).

## Tests

- `__tests__/leads/LeadStageSelect.test.tsx` — renders all 8 stages in order,
  label mapping, saves + notifies parent on change, rolls back on API
  rejection (the agent-403 UX).
- `__tests__/leads/SuperadminDashboardView.test.tsx` — the pipeline panel:
  every stage label present including empty ones, total/unassigned counts,
  the "Assign them" shortcut appearing only when something is unassigned, and
  stage counts rendering from the API payload.

Run with `npx jest __tests__/leads`.
