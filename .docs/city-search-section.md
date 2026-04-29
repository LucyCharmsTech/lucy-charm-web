## City search section (homepage)

This UI is the “Find your dream home in Canada” block under the hero.

- **Component**: `components/CitySearchSection.tsx`
- **Behavior**:
  - Submitting the form navigates to `/buy?city=<value>`
  - City chips link to `/buy?city=<City>`

### Design + UX notes

- **Responsive**: pill search scales to mobile, chips wrap naturally
- **Accessible**: input has an `aria-label`, visible focus rings on chips and button
- **Dark mode**: uses translucent surfaces with `dark:` variants
