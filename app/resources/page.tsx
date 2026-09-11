import type { Metadata } from 'next';
import Link from 'next/link';
import { RESOURCE_GUIDES } from '@/content/siteContent';
import { siteUrl } from '@/lib/siteUrl';

/**
 * Resources — plan item 4.4.
 *
 * *"Three guides at launch."* *"**No empty/fabricated articles** or new
 * publishing platform."* Writing the articles is **explicitly excluded** from
 * Option A.
 *
 * So this page renders whatever guides exist and, today, that is none. It does
 * **not** render three headings with placeholder bodies waiting to be filled —
 * that is precisely the "empty article" the instruction rules out, and it is
 * how a site ends up with three indexed pages of nothing.
 *
 * See `.docs/resources-editor-gap.md`: 4.4 assumes *"the existing editor for
 * draft/preview/publish"*, and there is no such editor in either repository.
 * Building one would be the *"new publishing platform"* the same sentence
 * rules out, so it is raised as a question rather than answered by writing
 * code.
 */
export const metadata: Metadata = {
  title: 'Guides and resources',
  description: 'Guides to buying and selling with Lucy Charms Realty.',
  alternates: { canonical: `${siteUrl()}/resources` },
};

export default function ResourcesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        Guides and resources
      </h1>

      {RESOURCE_GUIDES.length === 0 ? (
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Our guides are being written and will appear here. If there is
          something you would like to know in the meantime,{' '}
          <Link href="/contact" className="underline hover:no-underline">
            ask us
          </Link>{' '}
          — or{' '}
          <Link href="/chat" className="underline hover:no-underline">
            ask Lucy
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {RESOURCE_GUIDES.map((guide) => (
            <li
              key={guide.slug}
              className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                <Link
                  href={`/resources/${guide.slug}`}
                  className="hover:underline"
                >
                  {guide.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {guide.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
