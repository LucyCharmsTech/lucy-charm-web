## Listing detail page

Route: `/listings/[id]`

- **Server component**: `app/listings/[id]/page.tsx` loads data, calls `notFound()` for unknown IDs, and composes `ListingDetailPageView` (same file) with section components under `components/listings/detail/`.
- **Formatting helpers**: `components/listings/detail/listingDetailFormat.ts` — `getListingDetailMetrics`, `getListingMapUrls`.
- **Data**: `components/listings/listingDetailData.ts` — `getListingDetail(id)` merges `MOCK_LISTINGS` with default detail fields; listing `1` has copy aligned to marketing mocks.

Map uses an OpenStreetMap embed; coordinates link out to Google Maps for parity with the reference UI.
