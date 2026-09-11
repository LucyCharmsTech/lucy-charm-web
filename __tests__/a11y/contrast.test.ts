import {
  AA_LARGE_TEXT,
  AA_NON_TEXT,
  AA_NORMAL_TEXT,
  BRAND_CONTRAST_DECISION,
  BRAND_FOREGROUND,
  PALETTE,
  REJECTED_LIGHT_TEXT_COLOURS,
  contrastRatio,
} from '@/lib/contrast';

/**
 * Colour contrast — WCAG 2.2 AA, controls 2.6 and 2.8.
 *
 * Arithmetic rather than `axe`, because jsdom has no layout engine and axe
 * returns "incomplete" for contrast rather than a result. A test that reported
 * "incomplete" as a pass would be claiming something never measured.
 */

test('the maths agrees with a known reference pair', () => {
  // Black on white is 21:1 by definition — if this drifts, every other number
  // in this file is wrong too.
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
});

test('secondary text on white meets AA', () => {
  // zinc-400 was in use on white and measures 2.62 — it was the header
  // tagline Lighthouse flagged. zinc-500 is the lightest that passes.
  expect(contrastRatio(PALETTE.zinc400, PALETTE.white)).toBeLessThan(AA_NORMAL_TEXT);
  expect(contrastRatio(PALETTE.zinc500, PALETTE.white)).toBeGreaterThanOrEqual(
    AA_NORMAL_TEXT,
  );
  expect(contrastRatio(PALETTE.zinc600, PALETTE.white)).toBeGreaterThanOrEqual(
    AA_NORMAL_TEXT,
  );
});

test('zinc-400 still passes as non-text, so icons may keep using it', () => {
  // §1.4.11 asks 3:1 for icons and borders, not 4.5. Sweeping every
  // `text-zinc-400` to a darker value would have darkened decorative icons
  // for no accessibility gain and a visible cost.
  expect(contrastRatio(PALETTE.zinc400, PALETTE.white)).toBeLessThan(AA_NON_TEXT);
});

describe('the brand colour', () => {
  test('white on the brand pink is why this change was made', () => {
    // Recorded rather than forgotten. Every primary button is 14px semibold,
    // which is normal text by WCAG's definition.
    const measured = contrastRatio(PALETTE.white, PALETTE.brandPink);
    expect(measured).toBeLessThan(AA_NORMAL_TEXT);
    expect(measured).toBeCloseTo(BRAND_CONTRAST_DECISION.whiteOnBrandLight, 1);
  });

  test('it does pass the large-text threshold', () => {
    // Which is why it was a near miss rather than an obvious one, and why it
    // survived this long.
    expect(contrastRatio(PALETTE.white, PALETTE.brandPink)).toBeGreaterThanOrEqual(
      AA_LARGE_TEXT,
    );
  });

  test('the brand colour itself was not changed', () => {
    // Hamed's decision: keep the pink exactly, darken the text. If someone
    // later edits `--primarycolor`, this fails and they have to say why.
    expect(BRAND_CONTRAST_DECISION.brandLight).toBe('#ff01c0');
    expect(BRAND_CONTRAST_DECISION.brandDark).toBe('#eb1da3');
  });

  test('the chosen foreground passes AA on the brand in BOTH themes', () => {
    // The whole point of the token. Checking one theme would have shipped a
    // dark-mode failure.
    expect(
      contrastRatio(BRAND_FOREGROUND, PALETTE.brandPink),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(
      contrastRatio(BRAND_FOREGROUND, PALETTE.brandPinkDark),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  test('zinc-900 would have failed dark mode, which is why it was not used', () => {
    // The trap: it passes light mode comfortably at 5.08, so someone checking
    // one theme would believe the problem solved.
    const { zinc900Foreground } = BRAND_CONTRAST_DECISION.rejected;
    expect(
      contrastRatio(zinc900Foreground, PALETTE.brandPink),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrastRatio(zinc900Foreground, PALETTE.brandPinkDark)).toBeLessThan(
      AA_NORMAL_TEXT,
    );
  });

  test('the rejected darker brand would also have worked', () => {
    // Kept so the decision is legible: it was a choice between two working
    // fixes, not a choice between a fix and a workaround.
    expect(
      contrastRatio(PALETTE.white, BRAND_CONTRAST_DECISION.rejected.darkenBrand),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  test('the badge over a listing photo passes on any backdrop', () => {
    // `bg-primarycolor/90` blends with whatever photo is behind it, so the
    // effective background is unknowable. Both extremes have to pass.
    const blend = (fg: string, bg: string, alpha: number) => {
      const parse = (hex: string) =>
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const [f, b] = [parse(fg), parse(bg)];
      return (
        '#' +
        f
          .map((c, i) =>
            Math.round(alpha * c + (1 - alpha) * b[i])
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
      );
    };

    for (const backdrop of ['#ffffff', '#000000', '#808080']) {
      const effective = blend(PALETTE.brandPink, backdrop, 0.9);
      expect(
        contrastRatio(BRAND_FOREGROUND, effective),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      // And white would have failed on every one of them.
      expect(contrastRatio(PALETTE.white, effective)).toBeLessThan(AA_NORMAL_TEXT);
    }
  });
});


describe('the colours that were replaced', () => {
  test.each(Object.entries(REJECTED_LIGHT_TEXT_COLOURS))(
    '%s fails AA as light-mode text, which is why it is no longer used',
    (_name, colour) => {
      // Each of these was found by measuring the built site rather than by
      // reading the code, and each is a shade someone reaches for from habit.
      // Asserting the failure means nobody reintroduces one believing it
      // passes.
      expect(contrastRatio(colour, PALETTE.white)).toBeLessThan(AA_NORMAL_TEXT);
    },
  );

  test('the replacements pass on white and on the #fafafa panels', () => {
    // Not just pure white: the site uses #fafafa panels, and a value that
    // only clears 4.5 against white fails on those.
    const surfaces = [PALETTE.white, PALETTE.offWhite];
    const replacements = [PALETTE.zinc500, PALETTE.brandPinkText, PALETTE.red600];

    for (const colour of replacements) {
      for (const surface of surfaces) {
        expect(contrastRatio(colour, surface)).toBeGreaterThanOrEqual(
          AA_NORMAL_TEXT,
        );
      }
    }
  });

  test('zinc-100 panels need zinc-600, not zinc-500', () => {
    /*
     * The edge this test exists for. `zinc-500` clears AA on white (4.83) and
     * on #fafafa (4.62) and then **fails on a #f4f4f5 panel at 4.39** — a
     * 0.11 miss that no eye would catch and that a check against white alone
     * would call a pass.
     *
     * There is one such place on the site today (the listing photo
     * placeholder) and it uses zinc-600. This is here so the next person
     * putting muted text on a zinc-100 panel finds out from a test rather
     * than from an audit.
     */
    expect(contrastRatio(PALETTE.zinc500, PALETTE.panel)).toBeLessThan(
      AA_NORMAL_TEXT,
    );
    expect(contrastRatio(PALETTE.zinc600, PALETTE.panel)).toBeGreaterThanOrEqual(
      AA_NORMAL_TEXT,
    );
    // Same trap for error text.
    expect(contrastRatio(PALETTE.red600, PALETTE.panel)).toBeLessThan(
      AA_NORMAL_TEXT,
    );
  });

  test('the brand pink stays the brand pink for non-text use', () => {
    // Hamed's decision. Backgrounds, the logo and accents keep #ff01c0
    // exactly; only text on it, and the pink used *as* small text, changed.
    expect(BRAND_CONTRAST_DECISION.brandLight).toBe(PALETTE.brandPink);
    // And as a background behind the chosen foreground, it passes.
    expect(
      contrastRatio(BRAND_FOREGROUND, PALETTE.brandPink),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
