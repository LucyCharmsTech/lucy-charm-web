import type { Metadata } from 'next';
import { HomeValueForm } from '@/components/homeValue/HomeValueForm';
import { siteUrl } from '@/lib/siteUrl';

/**
 * What is my home worth — plan item 4.2.
 *
 * A **public** page, per Hamed: *"public page and form start open; sign-in at
 * submission."* Indexable, unlike the portal, because it is a service the
 * brokerage offers and someone searching for it should find it.
 */
export const metadata: Metadata = {
  title: 'What is my home worth?',
  description:
    'Ask a Lucy Charms representative to prepare a valuation of your property.',
  alternates: { canonical: `${siteUrl()}/home-value` },
};

export default function HomeValuePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        What is my home worth?
      </h1>
      {/*
        States what this is *and* what it is not, in the first thing anyone
        reads. Hamed: "Use the existing human-reviewed report workflow — not an
        instant public valuation number." A page that promised a number and then
        produced a form would be a worse experience than one that never
        promised it, and someone arriving from a search for "instant home
        valuation" deserves to know immediately.
      */}
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Tell us about your property and a Lucy Charms representative will
        prepare a valuation for you, with the reasoning and the limitations set
        out. This is a considered opinion from a person — not an automatic
        online estimate.
      </p>

      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <HomeValueForm />
      </div>
    </main>
  );
}
