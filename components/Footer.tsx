import React from 'react';
import Link from 'next/link';
import { BROKERAGE, formatOffice } from '@/content/siteContent';

/**
 * Site footer.
 *
 * Two jobs, and the second is the one that constrains the design: it is the
 * site's navigation of last resort, and it is where the brokerage's required
 * disclosure lives — legal name, RECO brokerage and branch registration, and
 * the office addresses. Every one of those is client-supplied and approved, so
 * a redesign may move them but must never drop one.
 *
 * Column groups are data rather than markup so the columns stay the same shape
 * as each other, and so a page added to the site is one line here.
 *
 * `/resources` is deliberately absent: the client asked (10 September 2026) for
 * the section to stay hidden until they supply the guides. Add it here in the
 * same change that publishes them.
 */

type FooterColumn = {
  heading: string;
  links: { label: string; href: string }[];
};

const COLUMNS: FooterColumn[] = [
  {
    heading: 'Explore',
    links: [
      { label: 'Buy a home', href: '/listings' },
      { label: 'Sell your home', href: '/sell' },
      { label: 'Home valuation', href: '/home-value' },
      { label: 'Ask Lucy', href: '/chat' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Privacy policy', href: '/privacy' },
    ],
  },
];

const Footer = () => {
  return (
    <footer className="mt-auto w-full border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {/* ── Brand ── */}
          <div className="lg:pr-8">
            <Link
              href="/"
              className="inline-flex flex-col leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
            >
              <span className="text-lg font-extrabold tracking-tight text-primarycolor-text">
                Lucycharms
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Realty. Brokerage
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Search homes, ask questions and work with a {BROKERAGE.publicName}{' '}
              representative.
            </p>
          </div>

          {/* ── Link columns ── */}
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-labelledby={`footer-${column.heading}`}>
              <h2
                id={`footer-${column.heading}`}
                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400"
              >
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-700 transition hover:text-primarycolor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* ── Offices and email ── */}
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Contact
            </h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={`mailto:${BROKERAGE.email}`}
                  className="text-sm text-zinc-700 transition hover:text-primarycolor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:text-zinc-300"
                >
                  {BROKERAGE.email}
                </a>
              </li>
              {BROKERAGE.offices.map((office) => (
                <li
                  key={office.city}
                  className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
                >
                  <span className="block font-medium text-zinc-700 dark:text-zinc-300">
                    {office.city}
                  </span>
                  {formatOffice(office)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Disclosure bar ── */}
        <div className="mt-12 flex flex-col gap-2 border-t border-zinc-200 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:text-zinc-400">
          <p>
            © {new Date().getFullYear()} {BROKERAGE.publicName} · the registered
            brokerage name of {BROKERAGE.legalName}
          </p>
          <p>
            RECO brokerage #{BROKERAGE.reco.brokerage} · branch #
            {BROKERAGE.reco.branch}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
