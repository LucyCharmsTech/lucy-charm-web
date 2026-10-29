import { ContactForm } from '@/components/contact/ContactForm';
import Link from 'next/link';
import { BROKERAGE, formatOffice } from '@/content/siteContent';

export const metadata = {
  title: 'Contact | Lucy Charms Realty',
  description: 'Send a message to the Lucy Charms Realty team.',
};

export default async function ContactPage({ searchParams }: { searchParams?: Promise<{ from?: string }> }) {
  const fromSeller = (await searchParams)?.from === 'sell';
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">Contact us</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Tell us what you need and the right person will get back to you.
      </p>
      {fromSeller && <div className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        <p>Mention the home or Seller Plan request in your message so the team can find it.</p>
        <Link href="/sell" className="font-semibold text-primarycolor-text underline underline-offset-4">Back to Seller Explorer</Link>
      </div>}
      <div className="mt-8">
        <ContactForm initialTopic={fromSeller ? 'Selling/Home Value' : undefined} />
      </div>

      <section className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {BROKERAGE.publicName}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Email us at{' '}
          <a
            href={`mailto:${BROKERAGE.email}`}
            className="underline hover:no-underline"
          >
            {BROKERAGE.email}
          </a>
          .
        </p>

        <h3 className="mt-6 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Offices
        </h3>
        <ul className="mt-2 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          {BROKERAGE.offices.map((office) => (
            <li key={office.city}>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {office.city}
              </span>
              {' — '}
              {formatOffice(office)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
