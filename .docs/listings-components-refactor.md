## Listings page component split

The listings screen logic was separated into reusable pieces to keep `app/listings/page.tsx` focused on composition.

- `components/listings/data.ts`: mock listing dataset + type
- `components/listings/constants.ts`: filter/sort constants
- `components/listings/FilterChip.tsx`: reusable filter chip button
- `components/listings/FilterPanel.tsx`: sidebar filter UI
- `components/listings/ListingsToolbar.tsx`: count, sort selector, grid/list toggle

`app/listings/page.tsx` now handles only page-level state and rendering.
