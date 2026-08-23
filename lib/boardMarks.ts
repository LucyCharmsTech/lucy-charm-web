/**
 * The board marks that have to appear alongside feed listings.
 *
 * `docs/normalized_listing_schema.json` sets `logo_required: true` for every
 * live-feed adapter and names the components: AttributionBlock, IDXDisclaimer,
 * MLSLogo, EqualHousingLogo.
 *
 * The slot is here and wired; the artwork is not, deliberately. A board's
 * trademark cannot be approximated — an incorrect mark is a worse compliance
 * position than none at all, because it misrepresents the board rather than
 * merely omitting it. Drop the official files into `public/board/` and set the
 * paths below, and both marks appear everywhere the notice does.
 *
 * Marks with an empty `src` are skipped, so this file is safe to ship as-is.
 */
export type BoardMark = {
  /** Path under /public, or '' until the official asset is supplied. */
  src: string;
  alt: string;
  /** Rendered height in px. Boards specify a minimum; check before changing. */
  height: number;
};

/** Named in the attribution line and the copyright notice. */
export const BOARD_NAME = process.env.NEXT_PUBLIC_BOARD_NAME?.trim() || 'TRREB';

export const BOARD_MARKS: BoardMark[] = [
  {
    // e.g. '/board/trreb-mls.svg'
    src: process.env.NEXT_PUBLIC_BOARD_LOGO_URL?.trim() || '',
    alt: `${BOARD_NAME} MLS®`,
    height: 28,
  },
  {
    // e.g. '/board/equal-housing.svg'
    src: process.env.NEXT_PUBLIC_EQUAL_HOUSING_LOGO_URL?.trim() || '',
    alt: 'Equal Housing Opportunity',
    height: 28,
  },
];
