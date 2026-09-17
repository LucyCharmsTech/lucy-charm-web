# Love / Maybe / Not for me (Web)

Counterpart: `lucy-charm-api/.docs/property-reactions.md`

**Controls 6.10, 6.11.** The client's clarification is the specification:

> *"Three buttons on each property in the client portal. A buyer picks one, it
> replaces whatever they picked before, and they can change or clear it at any
> time — one state per property, always reversible. Love saves the property to
> their favourites. Maybe keeps it on a shortlist without committing, so it
> stays visible while they decide. Not for me hides it from their browsing so
> it stops reappearing, with an undo in case it was tapped by accident."*

## The component

`components/reactions/PropertyReactionButtons.tsx`, placed on the listing
detail sidebar **directly beneath the save button** — because Love and saving
are one state, not two. Loving a property saves it to that same favourites
list; moving away from Love unsaves it.

Three behaviours are worth calling out, each deliberate:

**Pressing the active reaction clears it.** *"Change or clear it at any time"*
needs a route back to no reaction, and a fourth "None" button would be clutter
for something a second press expresses naturally. The `title` says so when a
button is active.

**Not for me shows an undo rather than acting silently.** It is the only one
that feels destructive — the property leaves the list under the buyer's finger
— and the client asked for the undo by name. The undo appears in a
`role="status"` line and disappears once used.

**Love confirms where the property went**: "Saved to your favourites." Without
it the buyer has no way to know Love and the heart button are the same thing.

## Accessibility

`role="group"` with a label on the set, and **`aria-pressed`** on each button —
that is what tells a screen reader these are toggles showing current state
rather than three separate actions. Errors are `role="alert"`, the undo line is
`role="status"`.

## Signed-out visitors

The component **renders nothing** and makes no request. Control 6.10 is a
*user*-property state, and a reaction that vanishes when you change device is
not one. The save button above still works for guests, as it did before —
guest saving and merging is control 6.8, a separate item.

## Failure handling

| Case | Behaviour |
|---|---|
| Failed save | `role="alert"`, and the state does **not** move — the button stays as it was |
| Failed initial read | Buttons render unset and remain usable; a lookup failure must not block reacting |
| In flight | All three disable, and the pressed one shows a spinner |

## `onChange`

Fires with the new reaction, or `null` when cleared, so a parent list can drop
a card the buyer just hid without a refetch.

## Nothing is inferred

Control 6.11 forbids reading affordability, urgency, protected traits or agent
value from reactions. The single analytics event records **that** a reaction
was set and which one — never a score, a rank or an ordering.

## Tests

```bash
npx jest __tests__/reactions --silent   # 12
```

Covers: exactly three buttons, nothing at all when signed out, picking one,
replacement (never two active), a second press clearing, the favourites
confirmation, the undo appearing and working, `onChange`, an existing reaction
shown on load, and both failure paths.

## Known limitations

- **Only on the listing detail page so far.** The client says "on each property", so listing cards in search results are the natural next place — best done with the portal work, where the shortlist and hidden lists also get their screens.
- **No shortlist or hidden-list screen yet.** The API supports both (`?reaction=maybe`, `?reaction=not_for_me`); the portal surfaces are part of the journey work.
