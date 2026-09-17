import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentSection } from '@/components/content/ContentSection';
import { PRIVACY_CONTENT, isPublished } from '@/content/siteContent';
import { siteUrl } from '@/lib/siteUrl';

/**
 * The privacy notice.
 *
 * Required wherever the site asks permission — Q6 asks for *"Lucy's full
 * identity, mailing address, contact method and privacy notice for each
 * consent request."* There was no such page, and nothing for a consent line to
 * link to.
 *
 * Built to receive the text, and publishing **nothing** until it arrives: each
 * section renders as nothing at all rather than as a heading with a
 * placeholder. A privacy notice is the last page on a site where invented
 * wording would be acceptable — it is a statement of legal obligations, and a
 * plausible-looking draft is worse than an honest absence, because a reader
 * would rely on it.
 */
export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'How Lucy Charms Realty handles your information.',
  alternates: { canonical: `${siteUrl()}/privacy` },
};

export default function PrivacyPage() {
  const sections = [
    { key: 'who-we-are', block: PRIVACY_CONTENT.whoWeAre },
    { key: 'what-we-collect', block: PRIVACY_CONTENT.whatWeCollect },
    { key: 'why', block: PRIVACY_CONTENT.whyWeCollectIt },
    { key: 'sharing', block: PRIVACY_CONTENT.whoWeShareItWith },
    { key: 'retention', block: PRIVACY_CONTENT.retention },
    { key: 'your-rights', block: PRIVACY_CONTENT.yourRights },
    { key: 'contact', block: PRIVACY_CONTENT.howToContactUs },
  ];
  const published = sections.filter(({ block }) => isPublished(block));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Privacy notice
      </h1>

      {published.map(({ key, block }) => (
        <ContentSection key={key} block={block} id={key} />
      ))}

      {published.length === 0 && (
        <>
          {/*
            Says the honest thing, and gives the reader somewhere to go.
            Deliberately makes no claim about what we do or do not do with
            information — that claim is the notice itself, and it has not been
            approved.
          */}
          <p className="mt-4 text-zinc-700 dark:text-zinc-300">
            Our full privacy notice is being finalised and will be published
            here.
          </p>
          <p className="mt-3 text-zinc-700 dark:text-zinc-300">
            In the meantime, if you want to know what information we hold about
            you, ask us to correct it, or ask us to delete it, please{' '}
            <Link href="/contact" className="underline hover:no-underline">
              contact us
            </Link>{' '}
            and we will answer directly.
          </p>
          {/*
            The one thing worth saying without approval, because it is a
            verifiable fact about this software rather than a policy claim: the
            site runs no analytics unless the visitor agrees.
          */}
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            We do not run any visitor analytics unless you accept the cookie
            notice, and you can decline it without losing any part of the site.
          </p>
        </>
      )}
    </main>
  );
}
