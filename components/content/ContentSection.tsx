import type { ContentBlock } from '@/content/siteContent';
import { isPublished } from '@/content/siteContent';

/**
 * Renders a block of approved copy — or nothing at all.
 *
 * The scope document: *"Nothing is invented — no registration details, team
 * profiles, office details or article text are written or published without
 * your approval."*
 *
 * The obvious way to build a page for copy you do not have is to leave the
 * headings in with placeholder text underneath. That produces exactly the
 * failure the constraint guards against: a live page announcing *"Brokerage
 * registration: [TBC]"*, or a plausible-looking number somebody typed to see
 * how the layout worked and never removed. A wrong registrant identity is a
 * regulatory problem, not a cosmetic one.
 *
 * So an unsupplied block returns `null` — no heading, no wrapper, no spacing.
 * The page is shorter until the words arrive, and then it is longer. Nothing
 * in between says anything untrue.
 */
export function ContentSection({
  block,
  id,
}: {
  block: ContentBlock;
  id?: string;
}) {
  if (!isPublished(block)) return null;

  return (
    <section id={id} className="mt-8 first:mt-0">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {block.heading}
      </h2>
      {block.paragraphs?.map((paragraph) => (
        <p
          key={paragraph}
          className="mt-2 whitespace-pre-line text-zinc-700 dark:text-zinc-300"
        >
          {paragraph}
        </p>
      ))}
    </section>
  );
}
