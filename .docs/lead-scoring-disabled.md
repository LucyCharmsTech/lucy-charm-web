# Lead Scoring — Display Surfaces Removed (Web)

Counterpart: `lucy-charm-api/.docs/lead-scoring-disabled.md`

Tranche-one item **T1**. Checklist control **5.20**: *"No AI lead score, hidden
value ranking or automatic agent reassignment."*

Hamed's Q2 was explicit that hiding was not enough — *"Hiding the label while
continuing scoring or ranking does not meet our requirement"* — so the API
stopped computing at the same time these surfaces came out. Removing the UI
alone would have left a genuinely **hidden** ranking, which is what 5.20
prohibits.

## Removed

| File | What |
|---|---|
| `app/admin/inquiries/page.tsx` | Temperature and Score columns — headers and cells |
| `app/admin/inquiries/[leadId]/page.tsx` | Temperature and Score definition-list entries |
| `components/agent/AgentLeadsView.tsx` | Both cells, both headers, **and the `TEMPERATURE_STYLES` / `temperatureTone()` colour-coding helper** |

No `colSpan` in either table needed adjusting.

## Deliberately kept

`types/api.ts` still declares `lead_temperature` and `lead_score` on
`LeadRead`. **This is correct** — the API still returns them, because Hamed's
Q2 preserves the existing records under the retention policy. The web simply no
longer renders them.

`LeadStageSelect` and everything stage-related is untouched. Stage is a
different concept — hand-changed, no automatic transitions — and both control
5.8 and Hamed's *"keep normal follow-up tasks and explicit routing"* require it
to stay.

## Verify

```bash
grep -rn "lead_temperature\|lead_score\|temperatureTone" app/ components/
# expect: nothing
```

Then, signed in as superadmin: `/admin/inquiries`, a lead detail page, and the
agent leads view — no temperature or score anywhere.
