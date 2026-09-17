/**
 * Copy that is Lucy's to write, not ours — plan items 4.3 and 4.4.
 *
 * The scope document's governing constraint:
 *
 *     "Nothing is invented — no registration details, team profiles, office
 *      details or article text are written or published without your
 *      approval."
 *
 * and the licence that makes this file possible:
 *
 *     "Where wording, titles, addresses or profile details are still to come,
 *      the page is built to receive them, so content can be added later
 *      without reworking the page."
 *
 * So: every field below is `null`, and every page renders **nothing at all**
 * for a `null` field. Not a placeholder, not "Coming soon", not a greyed-out
 * heading.
 *
 * ### Why absent means absent
 *
 * The obvious way to build a page for content you do not have is to leave the
 * headings in with placeholder text under them. That produces the exact
 * failure the constraint is guarding against: a page that goes live announcing
 * *"Brokerage registration: [TBC]"*, or worse, a plausible-looking number
 * somebody typed to see how the layout worked and never took out. A registrant
 * identity that is wrong is not a cosmetic problem — it is a regulatory one.
 *
 * A section with no content therefore does not exist. The page is shorter
 * until Lucy supplies the words, and then it is longer. Nothing in between
 * says anything untrue.
 *
 * ### How to supply content
 *
 * Replace a `null` with the approved text. Nothing else changes — no component
 * edits, no layout work. `__tests__/content/siteContent.test.ts` will refuse
 * anything that looks like a placeholder rather than an approved answer.
 */

export type ContentBlock = {
  /** Heading as it should appear. Null means this section is not published. */
  heading: string | null;
  /** Body copy. Paragraphs, in order. Null or empty means not published. */
  paragraphs: string[] | null;
};

const NOT_SUPPLIED: ContentBlock = { heading: null, paragraphs: null };

/** A registered brokerage office. Phone and hours are not published yet. */
export type BrokerageOffice = {
  city: string;
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
};

/**
 * Verified brokerage details, supplied and approved by the client for public
 * display on About, Contact and in the footer. Single source of truth for the
 * pages and the structured data. A public phone number and opening hours are
 * deliberately absent — still to be confirmed.
 */
export const BROKERAGE = {
  publicName: 'Lucy Charms Realty',
  legalName: 'Lucy Charms Inc.',
  email: 'info@LucyCharms.com',
  reco: {
    brokerage: '6026720',
    branch: '6027141',
  },
  offices: [
    {
      city: 'Toronto',
      streetAddress: '140 Yonge Street, Unit 228',
      locality: 'Toronto',
      region: 'ON',
      postalCode: 'M5C 1X6',
      country: 'CA',
    },
    {
      city: 'Ottawa',
      streetAddress: '222 Queen Street, Unit 1045',
      locality: 'Ottawa',
      region: 'ON',
      postalCode: 'K1P 5V9',
      country: 'CA',
    },
  ] satisfies BrokerageOffice[],
} as const;

/** One office as a single display line, e.g. "140 Yonge Street, Unit 228, Toronto, ON M5C 1X6". */
export function formatOffice(office: BrokerageOffice): string {
  return `${office.streetAddress}, ${office.locality}, ${office.region} ${office.postalCode}`;
}

/**
 * About — plan item 4.3.
 *
 * Hamed: *"Do not invent registration details or publish unconfirmed team
 * profiles."*
 *
 * The section list is his, in his order. Each is here so the page is ready for
 * it; none has content because none has been supplied.
 */
export const ABOUT_CONTENT: {
  /** Brokerage legal name, and the registrant identity behind it. */
  brokerageIdentity: ContentBlock;
  /**
   * The title the brokerage and its people are permitted to use.
   * Regulated wording — ours to display, never to compose.
   */
  permittedTitle: ContentBlock;
  /** Registration numbers and the disclosure wording that must accompany them. */
  registrationAndDisclosure: ContentBlock;
  /** Where the brokerage operates. */
  serviceArea: ContentBlock;
  /** Approved team profiles. Unconfirmed profiles are not published. */
  team: ContentBlock;
  /**
   * The fuller explanation of how Lucy the assistant works.
   *
   * 4.3 places it here — *"with a short disclosure at the chat/action itself
   * — not only a footer link."* That short disclosure **is** built and lives
   * in `components/common/AiDisclosure.tsx`; it states what the assistant is,
   * which is a fact about our own system rather than copy anyone needs to
   * approve. This longer explanation is Lucy's to write because it speaks for
   * the brokerage about how it uses the tool.
   */
  aiExplanation: ContentBlock;
} = {
  brokerageIdentity: {
    heading: 'Who we are',
    paragraphs: [
      `${BROKERAGE.publicName} is the registered brokerage name of ${BROKERAGE.legalName}, a real estate brokerage in Ontario.`,
    ],
  },
  permittedTitle: NOT_SUPPLIED,
  registrationAndDisclosure: {
    heading: 'Registration',
    paragraphs: [
      `${BROKERAGE.publicName} is registered with the Real Estate Council of Ontario (RECO).`,
      `RECO brokerage registration number: ${BROKERAGE.reco.brokerage}.`,
      `RECO branch registration number: ${BROKERAGE.reco.branch}.`,
    ],
  },
  serviceArea: NOT_SUPPLIED,
  team: NOT_SUPPLIED,
  aiExplanation: NOT_SUPPLIED,
};


/**
 * The privacy notice — required wherever the site asks permission.
 *
 * Your Q6: *"Hamed supplies/confirms Lucy's full identity, mailing address,
 * contact method and privacy notice **for each consent request**."*
 *
 * There was no privacy page on the site at all, and nothing for a consent
 * line to point at. The page now exists and each section below is a field it
 * renders — empty ones render as nothing, exactly like About.
 *
 * ### The link appears on its own
 *
 * Until at least one section is published, the consent notices on the contact
 * form, sign-up and Home Value form deliberately **carry no link** — see
 * `isPrivacyPolicyPublished`. A link to a page that says nothing is worse
 * than no link: it looks like the policy exists and answers nothing. When
 * content arrives the links appear everywhere at once, with no code change.
 *
 * `retention` is the section that depends on a decision rather than on
 * drafting: nothing on the site is deleted today because no schedule has been
 * set, so there is currently no true sentence to write here.
 */
export const PRIVACY_CONTENT: {
  /** Legal identity, mailing address, contact method — Q6 requires all three. */
  whoWeAre: ContentBlock;
  whatWeCollect: ContentBlock;
  whyWeCollectIt: ContentBlock;
  whoWeShareItWith: ContentBlock;
  /** How long each kind of record is kept. Waiting on the retention schedule. */
  retention: ContentBlock;
  yourRights: ContentBlock;
  howToContactUs: ContentBlock;
} = {
  whoWeAre: NOT_SUPPLIED,
  whatWeCollect: NOT_SUPPLIED,
  whyWeCollectIt: NOT_SUPPLIED,
  whoWeShareItWith: NOT_SUPPLIED,
  retention: NOT_SUPPLIED,
  yourRights: NOT_SUPPLIED,
  howToContactUs: NOT_SUPPLIED,
};

/**
 * Whether there is a privacy notice worth linking to.
 *
 * Consent lines check this before offering a link. One published section is
 * enough — a partial notice is still something a reader can use, whereas an
 * empty page is a dead end that implies an answer exists.
 */
export function isPrivacyPolicyPublished(): boolean {
  return Object.values(PRIVACY_CONTENT).some(isPublished);
}

/**
 * Resources — plan item 4.4.
 *
 * *"Three guides at launch."* *"No empty/fabricated articles."* Writing the
 * articles is **explicitly excluded** from Option A, so this list is empty and
 * the page renders no article list until it is not.
 *
 * See `.docs/resources-editor-gap.md`: 4.4 says to reuse *"the existing editor
 * for draft/preview/publish"*, and there is no such editor in either
 * repository. That is a question for Lucy, not something to solve by building
 * the *"new publishing platform"* the same sentence rules out.
 */
export type ResourceGuide = {
  slug: string;
  title: string;
  summary: string;
  /** Markdown body. */
  body: string;
  publishedAt: string;
};

export const RESOURCE_GUIDES: ResourceGuide[] = [];

/**
 * True when a block has something real to render.
 *
 * Both halves are required: a heading with no body is a promise the page does
 * not keep, and a body with no heading has nowhere to sit in the outline that
 * screen readers and search engines both rely on.
 */
export function isPublished(block: ContentBlock): boolean {
  return Boolean(
    block.heading?.trim() &&
      block.paragraphs &&
      block.paragraphs.length > 0 &&
      block.paragraphs.some((paragraph) => paragraph.trim().length > 0),
  );
}
