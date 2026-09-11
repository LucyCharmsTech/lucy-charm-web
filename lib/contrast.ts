/**
 * WCAG contrast arithmetic — controls 2.6 and 2.8, plan item 4.7.
 *
 * Here rather than only in a test because the brand colour has a measured
 * contrast ratio, that ratio is currently **below AA for white text**, and the
 * number should live somewhere a person can read rather than in a report
 * nobody opens.
 *
 * jsdom has no layout engine, so `axe` cannot evaluate contrast in the unit
 * tests — it returns "incomplete" rather than a result. Reporting that as a
 * pass would claim something never measured, so contrast is checked two ways
 * instead: this arithmetic on the palette, and Lighthouse against the built
 * site. See `.docs/accessibility-and-cwv.md`.
 */

/** WCAG 2.2 §1.4.3 — normal text. */
export const AA_NORMAL_TEXT = 4.5;

/** ≥18.66px bold, or ≥24px. */
export const AA_LARGE_TEXT = 3.0;

/** §1.4.11 — icons, borders, focus rings and other non-text. */
export const AA_NON_TEXT = 3.0;

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The palette values these checks are made against.
 *
 * Duplicated from `app/globals.css` deliberately: a test that read the
 * stylesheet would follow a change and keep passing, which is the opposite of
 * what a guard is for. If someone edits the CSS, the test fails and they have
 * to come here and say what they meant.
 */
export const PALETTE = {
  white: '#ffffff',
  /** The lightest surface a panel uses, not just pure white. */
  offWhite: '#fafafa',
  panel: '#f4f4f5',
  /** `--primarycolor`, light mode. */
  brandPink: '#ff01c0',
  /** `--primarycolor`, dark mode. */
  brandPinkDark: '#eb1da3',
  zinc400: '#9f9fa9',
  zinc500: '#71717b',
  zinc600: '#52525c',
  zinc900: '#18181b',
  /** `--primarycolor-text`, light mode — the brand pink made legible as text. */
  brandPinkText: '#d1019d',
  red500: '#fb2c36',
  red600: '#e7000b',
} as const;

/**
 * The brand contrast decision, and what was done about it.
 *
 * White on `#ff01c0` measures **3.49:1**. AA wants 4.5:1 for text under
 * 18.66px bold, and every primary button is 14px semibold. It passes the
 * *large-text* threshold (3.0), which is why the near-miss survived so long.
 *
 * Three fixes were measured and costed. **Hamed chose to keep the brand colour
 * exactly and darken the text instead** — so `--primarycolor` is untouched at
 * `#ff01c0`, and text sitting on it uses `--primarycolor-foreground`.
 *
 * ### Why `#0a0a0a` and not `#18181b`
 *
 * One value has to work in both themes, and against the **dark-mode** brand
 * (`#eb1da3`) zinc-900 reaches only **4.42** — still short of AA. That is easy
 * to miss: someone checking light mode alone would believe the problem solved.
 *
 * `#0a0a0a` gives **5.67** on light and **4.94** on dark, so a single token
 * passes everywhere and there is no theme-specific branch that can drift out
 * of sync.
 *
 * ### The badges over listing photos
 *
 * `bg-primarycolor/90` sits over a photo, so the effective background is
 * unknowable. Measured across white, mid-grey and black backdrops the token
 * gives **4.69–5.86**; white gives **3.38–4.22** and fails in every case.
 */
export const BRAND_FOREGROUND = '#0a0a0a';

export const BRAND_CONTRAST_DECISION = {
  chosen: 'keep-brand-darken-text',
  /** Untouched, by decision. */
  brandLight: PALETTE.brandPink,
  brandDark: PALETTE.brandPinkDark,
  foreground: BRAND_FOREGROUND,
  /** The measurement that prompted the change. */
  whiteOnBrandLight: 3.49,
  rejected: {
    darkenBrand: '#db01a5',
    /** Fails AA against the dark-mode brand at 4.42 — see above. */
    zinc900Foreground: PALETTE.zinc900,
  },
} as const;


/**
 * Colours that were in use as light-mode text and failed AA.
 *
 * Kept as a list rather than a comment because each was found by *measuring*
 * the built site, not by reading the code — and each is the kind of value that
 * gets reached for again by anyone picking a "muted" or "error" shade from
 * habit.
 *
 * Every one of these is now unused as light-mode text; a test asserts they
 * fail, so nobody reintroduces one believing it passes.
 */
export const REJECTED_LIGHT_TEXT_COLOURS = {
  /** Secondary text and icons. Fails even the 3:1 non-text threshold. */
  zinc400: PALETTE.zinc400,
  /** The brand pink as small text. Replaced by `--primarycolor-text`. */
  brandPink: PALETTE.brandPink,
  /** Error and status text. Replaced by red-600. */
  red500: PALETTE.red500,
} as const;
