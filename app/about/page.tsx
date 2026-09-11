import type { Metadata } from 'next';
import Link from 'next/link';
import { AiDisclosure } from '@/components/common/AiDisclosure';
import { ContentSection } from '@/components/content/ContentSection';
import { ABOUT_CONTENT, isPublished } from '@/content/siteContent';
import { siteUrl } from '@/lib/siteUrl';

/**
 * About — plan item 4.3.
 *
 * Built to receive Hamed's copy, in his section order, and to publish **none**
 * of it until it arrives. Every section is a `ContentSection`, which renders
 * nothing for an unsupplied block: no heading, no placeholder, no "coming
 * soon".
 *
 * Hamed: *"Do not invent registration details or publish unconfirmed team
 * profiles."*
 *
 * Supplying content is editing `content/siteContent.ts`. No component changes,
 * no layout work — which is the *"built to receive them, so content can be
 * added later without reworking the page"* the scope document asks for.
 */
export const metadata: Metadata = {
  title: 'About Lucy Charms Realty',
  description: 'About the brokerage, and how Lucy the assistant works.',
  alternates: { canonical: `${siteUrl()}/about` },
};

export default function AboutPage() {
  const sections = [
    { key: 'identity', block: ABOUT_CONTENT.brokerageIdentity },
    { key: 'title', block: ABOUT_CONTENT.permittedTitle },
    { key: 'registration', block: ABOUT_CONTENT.registrationAndDisclosure },
    { key: 'service-area', block: ABOUT_CONTENT.serviceArea },
    { key: 'team', block: ABOUT_CONTENT.team },
    { key: 'ai', block: ABOUT_CONTENT.aiExplanation },
  ];
  const published = sections.filter(({ block }) => isPublished(block));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        About Lucy Charms Realty
      </h1>

      {published.map(({ key, block }) => (
        <ContentSection key={key} block={block} id={key} />
      ))}

      {/*
        The AI disclosure is the one thing on this page that is not waiting on
        approval — it states what the software is, a fact about our own system.
        4.3 puts the *fuller* explanation here, and that is Lucy's to write
        because it speaks for the brokerage about how it uses the tool.
        So this stays whether or not `aiExplanation` has been supplied.
      */}
      {!isPublished(ABOUT_CONTENT.aiExplanation) && (
        <section id="ai" className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            About Lucy, the assistant
          </h2>
          <AiDisclosure variant="banner" className="mt-2" />
        </section>
      )}

      {published.length === 0 && (
        /*
          Says the honest thing rather than nothing at all. A page with a
          heading and no body looks broken; a page that says the details are
          being confirmed is accurate, and — crucially — invents no registration
          number, address or profile to fill the space.
        */
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          Our full brokerage details are being confirmed and will be published
          here. In the meantime, you can{' '}
          <Link href="/contact" className="underline hover:no-underline">
            contact us directly
          </Link>
          .
        </p>
      )}
    </main>
  );
}
