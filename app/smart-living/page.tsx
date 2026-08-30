'use client';

/**
 * The Smart Living Benefits landing page.
 *
 * **No sign-in wall, and no auth guard of any kind.** Spec A1 is explicit, and
 * the way that stays true is by there being nothing here to guard with: no
 * `useAuthStore` gate, no redirect, no "sign in to continue". A signed-out
 * visitor lands, reads, taps once, and is in the intake.
 *
 * The one piece of routing logic is the seller redirect, and it points *at*
 * something rather than away: a visitor who arrived here meaning to sell is
 * offered `/sell` as a next step, never a dead end telling them they are in
 * the wrong place.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

import IntakeFlow from '@/components/smart-living/IntakeFlow';
import { track } from '@/lib/analytics';

/**
 * Categories are hard-coded copy, not data.
 *
 * This is deliberate and temporary. `public-config` returns `categories: []`
 * with `catalogue_available: false` until Phase 4 promotes a real catalogue
 * behind a fulfilment-path gate, and §9 forbids showing a public category with
 * no path to fulfil it. So these describe *what Smart Living is for* in general
 * terms — they are illustrative copy, and none of them claims local
 * availability or a price. When the catalogue arrives, this array is replaced
 * by the API's response, and the claim becomes specific because it can be.
 */
const ILLUSTRATIVE_CATEGORIES = [
  { title: 'Comfort', body: 'Heating, cooling and air quality for the way you actually live.' },
  { title: 'Water', body: 'Filtration, softening and water heating, matched to your home.' },
  { title: 'Security', body: 'Locks, cameras and monitoring, set up properly the first time.' },
  { title: 'Essentials', body: 'The unglamorous things a new home always seems to need.' },
];

export default function SmartLivingPage() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    track('smart_living_page_viewed');
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {started ? (
          <IntakeFlow />
        ) : (
          <>
            <section>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primarycolor">
                Smart Living Benefits
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                Buy with us, and put part of it back into your home.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
                When you buy through Lucy Charms, a share of our remuneration
                comes back to you as home services — or as cash, if you would
                rather. Answer four questions and see what yours could be worth.
              </p>

              <button
                type="button"
                onClick={() => {
                  track('smart_living_cta_clicked');
                  setStarted(true);
                }}
                className="mt-8 inline-flex w-full justify-center rounded-full bg-primarycolor px-6 py-3.5 text-sm font-semibold text-white hover:bg-primarycolor/90 sm:w-auto"
              >
                Build My Smart Living Preview
              </button>
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                No account needed. Takes about a minute.
              </p>
            </section>

            <section className="mt-12">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                What it can go towards
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {ILLUSTRATIVE_CATEGORIES.map((category) => (
                  <div
                    key={category.title}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <h3 className="text-sm font-bold text-primarycolor">
                      {category.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {category.body}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                Examples of the kinds of things Smart Living covers. What is
                available depends on where you buy, and we will confirm that
                with you before anything is booked.
              </p>
            </section>

            {/* A seller who landed here is redirected towards something, never
                told they are in the wrong place. */}
            <section className="mt-12 rounded-2xl border border-primarycolor/20 bg-primarycolor/5 p-5">
              <p className="text-sm text-zinc-700 dark:text-zinc-200">
                Selling rather than buying?{' '}
                <Link
                  href="/sell"
                  onClick={() => track('smart_living_seller_redirect')}
                  className="font-semibold text-primarycolor hover:underline"
                >
                  Start with a home value snapshot
                </Link>{' '}
                — Smart Living Benefits are for buyers.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
