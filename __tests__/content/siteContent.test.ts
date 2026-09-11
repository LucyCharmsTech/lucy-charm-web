import {
  ABOUT_CONTENT,
  RESOURCE_GUIDES,
  isPublished,
  type ContentBlock,
} from '@/content/siteContent';

/**
 * The guard on plan items 4.3 and 4.4.
 *
 *     "Nothing is invented — no registration details, team profiles, office
 *      details or article text are written or published without your
 *      approval."
 *
 * This file is the thing that keeps that true after today. Every failure mode
 * it checks for is one that ships silently:
 *
 * - A placeholder typed in to see how the layout looks, and never removed.
 * - A plausible-looking registration number invented for a screenshot.
 * - A section heading left in with nothing underneath, so the live page
 *   announces a category of information it does not have.
 *
 * None of these breaks a build, throws an error, or looks wrong in review. A
 * test is the only thing that notices.
 */

const ALL_BLOCKS: Array<[string, ContentBlock]> = Object.entries(ABOUT_CONTENT);

/** Text that is obviously scaffolding rather than approved copy. */
const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /\bTBC\b/,
  /\bTBD\b/,
  /\bXXX+\b/,
  /coming soon/i,
  /placeholder/i,
  /\[.*\]/, // "[brokerage name]", "[insert address]"
  /\{\{.*\}\}/, // template syntax that never got substituted
  /your (name|address|number) here/i,
  /sample text/i,
  /^\s*$/,
];

/**
 * Shapes that look like real regulatory identifiers.
 *
 * The one that matters most. A registration number invented to fill a layout
 * is indistinguishable from a real one to anyone reading the page, and a wrong
 * registrant identity is a regulatory problem rather than a cosmetic one.
 *
 * This does not stop Lucy supplying a genuine number — it stops one appearing
 * without the `expectedApprovedContent` acknowledgement below being updated,
 * which is a deliberate act rather than an accident.
 */
const REGISTRATION_LIKE = [
  /\bRECO\s*#?\s*\d{4,}/i,
  /registration\s*(no\.?|number|#)\s*:?\s*\d{4,}/i,
  /\blicen[cs]e\s*(no\.?|number|#)\s*:?\s*\d{4,}/i,
];

describe('nothing is invented', () => {
  test.each(ALL_BLOCKS)(
    '%s contains no placeholder text',
    (_name, block) => {
      const text = [block.heading ?? '', ...(block.paragraphs ?? [])].join(' ');
      if (!text.trim()) return; // Not supplied at all — the expected state.

      for (const pattern of PLACEHOLDER_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    },
  );

  test.each(ALL_BLOCKS)(
    '%s has both a heading and a body, or neither',
    (_name, block) => {
      // A heading with no body is a promise the page does not keep — it
      // announces a category of information the brokerage does not publish.
      // A body with no heading has nowhere to sit in the document outline
      // that screen readers and search engines both rely on.
      const hasHeading = Boolean(block.heading?.trim());
      const hasBody = Boolean(
        block.paragraphs?.some((paragraph) => paragraph.trim().length > 0),
      );
      expect(hasHeading).toBe(hasBody);
    },
  );

  test('no registration-shaped number appears without being approved', () => {
    // Update this list, deliberately, when Lucy supplies real details.
    // registrationAndDisclosure carries the client-approved RECO numbers.
    const approvedSectionsWithNumbers: string[] = ['registrationAndDisclosure'];

    for (const [name, block] of ALL_BLOCKS) {
      if (approvedSectionsWithNumbers.includes(name)) continue;
      const text = [block.heading ?? '', ...(block.paragraphs ?? [])].join(' ');
      for (const pattern of REGISTRATION_LIKE) {
        expect(text).not.toMatch(pattern);
      }
    }
  });
});

describe('the receiver is in the state we expect today', () => {
  test('only the client-approved About sections are published', () => {
    // The client supplied and approved these for public display; the rest are
    // still to come. Add to this list as more sections are approved.
    const publishedSections = ['brokerageIdentity', 'registrationAndDisclosure'];
    for (const [name, block] of ALL_BLOCKS) {
      expect([name, isPublished(block)]).toEqual([
        name,
        publishedSections.includes(name),
      ]);
    }
  });

  test('there are no resource guides yet', () => {
    // 4.4: "No empty/fabricated articles." Writing them is explicitly
    // excluded from Option A, so an entry appearing here without approved
    // body text would be the exact thing that instruction rules out.
    expect(RESOURCE_GUIDES).toEqual([]);
  });

  test('a guide, once added, must carry real body text', () => {
    for (const guide of RESOURCE_GUIDES) {
      expect(guide.title.trim().length).toBeGreaterThan(0);
      expect(guide.summary.trim().length).toBeGreaterThan(0);
      // An article stub with a title and no body is the "empty article" the
      // instruction names.
      expect(guide.body.trim().length).toBeGreaterThan(200);
      for (const pattern of PLACEHOLDER_PATTERNS) {
        expect(guide.body).not.toMatch(pattern);
      }
    }
  });
});

describe('isPublished', () => {
  test('requires both a heading and real body text', () => {
    expect(isPublished({ heading: null, paragraphs: null })).toBe(false);
    expect(isPublished({ heading: 'Our brokerage', paragraphs: null })).toBe(false);
    expect(isPublished({ heading: null, paragraphs: ['Real copy.'] })).toBe(false);
    expect(isPublished({ heading: 'Our brokerage', paragraphs: [] })).toBe(false);
    // Whitespace is not content — an empty paragraph array entry would
    // otherwise publish a heading with a blank space under it.
    expect(isPublished({ heading: 'Our brokerage', paragraphs: ['   '] })).toBe(false);
    expect(isPublished({ heading: 'Our brokerage', paragraphs: ['Real copy.'] })).toBe(
      true,
    );
  });
});
