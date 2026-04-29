import BlimpIllustration from '@/components/BlimpIllustration';
import AiPoweredSection from '@/components/AiPoweredSection';
import CitySearchSection from '@/components/CitySearchSection';
import FeaturedListingsSection from '@/components/FeaturedListingsSection';
import Footer from '@/components/Footer';
import Link from 'next/link';

export default function Home() {
  const featuredListings = [
    {
      id: '1',
      statusLabel: 'Active',
      imageSrc: 'https://picsum.photos/seed/lucy-clarence/900/700',
      imageAlt: 'Living room interior with natural light',
      address: '88 Clarence Street',
      bedsText: '2 beds',
      bathsText: '1 baths',
      priceText: '$629,000',
      detailsHref: '/listings/1',
    },
    {
      id: '2',
      statusLabel: 'Active',
      imageSrc: 'https://picsum.photos/seed/lucy-churchill/900/700',
      imageAlt: 'Detached home exterior',
      address: '462 Churchill Avenue North',
      bedsText: '4 beds',
      bathsText: '3.5 baths',
      priceText: '$1,750,000',
      detailsHref: '/listings/2',
    },
    {
      id: '3',
      statusLabel: 'Active',
      imageSrc: 'https://picsum.photos/seed/lucy-tuscany/900/700',
      imageAlt: 'Modern home with a pool',
      address: '140 Tuscany Ravine Road NW',
      bedsText: '4 beds',
      bathsText: '3.5 baths',
      priceText: '$995,000',
      detailsHref: '/listings/3',
    },
    {
      id: '4',
      statusLabel: 'Active',
      imageSrc: 'https://picsum.photos/seed/lucy-1320/900/700',
      imageAlt: 'Bright kitchen interior',
      address: '1320 1st Street SW',
      bedsText: '2 beds',
      bathsText: '2 baths',
      priceText: '$525,000',
      detailsHref: '/listings/4',
    },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Background */}
          <div
            className="absolute inset-0 bg-[radial-gradient(1200px_500px_at_20%_30%,rgba(255,1,192,0.18),transparent_55%),radial-gradient(900px_400px_at_75%_40%,rgba(236,72,153,0.14),transparent_60%),linear-gradient(to_bottom,rgba(255,255,255,0.92),rgba(255,255,255,0.92))] dark:bg-[radial-gradient(1200px_500px_at_20%_30%,rgba(255,1,192,0.22),transparent_55%),radial-gradient(900px_400px_at_75%_40%,rgba(236,72,153,0.18),transparent_60%),linear-gradient(to_bottom,rgba(9,9,11,0.82),rgba(9,9,11,0.82))]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 opacity-[0.18] [background:linear-gradient(to_right,rgba(0,0,0,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.10)_1px,transparent_1px)] bg-size-[32px_32px] dark:opacity-[0.12]"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-6xl px-6 sm:px-10 py-14 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="text-left">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Real estate{' '}
                  <span className="text-primarycolor">without the</span>
                  <br />
                  pressure.
                </h1>
                <p className="mt-4 max-w-xl text-base sm:text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
                  AI-first support, human backup when it matters.
                </p>

                <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <Link
                    href="/chat"
                    className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primarycolor bg-[linear-gradient(135deg,#ff01c0_0%,#e91e8c_55%,#9d174d_110%)] hover:brightness-105 active:brightness-95"
                  >
                    Ask the AI
                  </Link>
                  <Link
                    href="/sell"
                    className="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50 border border-zinc-200/90 dark:border-zinc-700/80 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-sm transition hover:bg-white/90 dark:hover:bg-zinc-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primarycolor"
                  >
                    Request Home Value
                  </Link>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end">
                <BlimpIllustration />
              </div>
            </div>
          </div>
        </section>
        <CitySearchSection />
        <FeaturedListingsSection listings={[...featuredListings]} />
        <AiPoweredSection />
      </main>

      <Footer />
    </div>
  );
}
