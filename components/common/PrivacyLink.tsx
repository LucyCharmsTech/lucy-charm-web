import Link from 'next/link';
import { isPrivacyPolicyPublished } from '@/content/siteContent';

/**
 * A link to the privacy notice — or nothing, while there is no notice.
 *
 * Every consent line on the site should point at a privacy notice. Until one
 * is published, these render **nothing**, because a link to a page that
 * answers no questions is worse than no link: it implies the answer exists
 * and sends the reader to a dead end.
 *
 * When the notice arrives, every consent line gains its link at once, with no
 * change to any of them. That is the whole reason this is a component rather
 * than an inline `<Link>` repeated five times.
 */
export function PrivacyLink({ prefix = ' ' }: { prefix?: string }) {
  if (!isPrivacyPolicyPublished()) return null;

  return (
    <>
      {prefix}
      <Link href="/privacy" className="underline hover:no-underline">
        See our privacy notice
      </Link>
      .
    </>
  );
}
