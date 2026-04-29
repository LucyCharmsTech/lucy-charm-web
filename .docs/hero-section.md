## Hero section

The homepage hero is implemented as a standalone component for reuse and clean separation of concerns.

- **Component**: `components/HeroSection.tsx`
- **Illustration**: `components/BlimpIllustration.tsx` (inline SVG, decorative, `aria-hidden`)

### Design goals

- **Responsive**: single column on mobile, two-column layout on `lg+`
- **Accessible**: visible focus rings, semantic heading, decorative SVG is not announced by screen readers
- **Dark mode**: background + text colors adapt automatically via Tailwind’s `dark:` utilities
