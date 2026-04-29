## AI-powered section (homepage)

This section is the pink panel + chat preview block shown below the featured listings.

- **Component**: `components/AiPoweredSection.tsx`
- **Purpose**: market the AI experience (Lucy) and provide a strong CTA into `/chat`.

### Structure

- Left: badge, headline, supporting copy, prompt input -> submits to `/chat?q=...`
- Right: visual chat preview (mock UI, no live functionality)
- Below: 4-key stats row

### Accessibility

- Inputs have `aria-label`s
- Interactive elements have visible focus rings
- The chat preview is keyboard-safe (buttons are real buttons)
