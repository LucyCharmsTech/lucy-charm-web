## Featured listings UI (homepage)

The homepage “featured listings” block is implemented as reusable components:

- **Card**: `components/ListingCard.tsx`
- **Grid + CTA**: `components/FeaturedListingsSection.tsx`

### Props

- `ListingCard` is purely presentational and takes formatted strings for text (price, beds, baths) to keep it reusable.
- `FeaturedListingsSection` takes `listings: FeaturedListing[]` and renders the first 4.

### Accessibility + UX

- Decorative status badge is plain text and remains readable on images.
- “View Details” is a full-width button-like link with visible focus rings.
- Layout is responsive: 1 column (mobile) → 2 (md) → 4 (lg).
