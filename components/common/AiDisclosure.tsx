import Link from 'next/link';
import { InfoIcon } from 'lucide-react';

/**
 * "Lucy is an AI assistant" — said where the person is, not in a footer.
 *
 * **Control 4.3**: the fuller explanation belongs on the About page, *"with a
 * short disclosure **at the chat/action itself — not only a footer link**."*
 *
 * The chat surface had none. The `/chat` page header said "Ask Lucy" and
 * nothing else; the only statement that Lucy is an assistant rather than a
 * person lived in the page's `<meta name="description">`, which no visitor
 * reads. Someone arriving at a chat box labelled with a first name has every
 * reason to assume they are talking to staff.
 *
 * ### Why this is not blocked on Hamed
 *
 * Everything else about the About page is Lucy's to write. This is not: it
 * states what the software **is**, which is a fact about our own system rather
 * than a claim about the brokerage. The fuller explanation — how the brokerage
 * uses the tool, what it will and will not do on their behalf — is copy Lucy
 * approves, and lives in `ABOUT_CONTENT.aiExplanation`.
 *
 * ### Why the wording says what a human does
 *
 * *"Lucy is an AI assistant"* alone tells someone what they are talking to and
 * not what to do about it. The second clause is the useful half: it says
 * advice comes from a licensed person, which is the boundary the whole
 * escalation system enforces server-side (control 4.8 / C5). The disclosure
 * and the behaviour should describe the same product.
 */

type AiDisclosureProps = {
  /**
   * `inline` sits under a chat header; `banner` stands alone above an action.
   * Both say the same thing — the difference is only how much room there is.
   */
  variant?: 'inline' | 'banner';
  /** Link to the fuller explanation. Omitted until About publishes it. */
  showLearnMore?: boolean;
  className?: string;
};

export const AI_DISCLOSURE_TEXT =
  'Lucy is an AI assistant. It can share general information and find ' +
  'listings, but advice comes from a licensed representative.';

export function AiDisclosure({
  variant = 'inline',
  showLearnMore = false,
  className = '',
}: AiDisclosureProps) {
  if (variant === 'inline') {
    return (
      <p
        className={`text-xs text-zinc-500 dark:text-zinc-400 ${className}`}
        // Not `role="alert"`: this is context, not a problem. An alert would
        // interrupt a screen-reader user every time the chat renders.
      >
        {AI_DISCLOSURE_TEXT}
        {showLearnMore && (
          <>
            {' '}
            <Link href="/about#ai" className="underline hover:no-underline">
              How Lucy works
            </Link>
          </>
        )}
      </p>
    );
  }

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      <InfoIcon
        className="mt-0.5 size-4 shrink-0 text-zinc-500 dark:text-zinc-400"
        aria-hidden="true"
      />
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        {AI_DISCLOSURE_TEXT}
        {showLearnMore && (
          <>
            {' '}
            <Link href="/about#ai" className="underline hover:no-underline">
              How Lucy works
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
