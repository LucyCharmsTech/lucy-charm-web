import React from 'react';

import { ArrowRight, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';

type Stat = {
  value: string;
  label: string;
};

const DEFAULT_STATS: Stat[] = [
  { value: '20+', label: 'Active Listings' },
  { value: 'CA', label: 'Market Coverage' },
  { value: 'AI', label: 'Powered Search' },
  { value: '24/7', label: 'AI Agent Support' },
];

export default function AiPoweredSection({
  stats = DEFAULT_STATS,
}: {
  stats?: Stat[];
}) {
  return (
    <section className="w-full">
      {/* Pink panel */}
      <div className="bg-[#fde7f3] dark:bg-[#2a0c1d]">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 py-14 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* Left */}
            <div className="max-w-xl">
              <span className="inline-flex items-center rounded-full bg-primarycolor/15 px-3 py-1 text-xs font-semibold text-primarycolor">
                AI-powered
              </span>

              <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                Smart home buying,
                <br />
                <span className="text-primarycolor">supercharged by AI</span>
              </h2>

              <p className="mt-4 text-sm sm:text-base leading-relaxed text-zinc-700 dark:text-zinc-200">
                The best real estate. Lucy helps you get in the market’s own
                dream. Ask Lucy anything — pricing, neighbourhoods, mortgage
                estimates.
              </p>

              <form action="/chat" method="get" className="mt-6">
                <InputGroup className="h-12 rounded-full border-primarycolor/35 bg-white/85 backdrop-blur supports-backdrop-filter:bg-white/75 dark:bg-zinc-950/35 dark:border-primarycolor/25">
                  <InputGroupInput
                    name="q"
                    aria-label="Ask Lucy a question"
                    placeholder="Find 3-bed condos in Toronto Beach under $1.5M…"
                    className="h-12 px-5 text-sm sm:text-base"
                  />
                  <div className="pr-1.5">
                    <Button
                      type="submit"
                      className="h-10 rounded-full px-6 font-semibold bg-primarycolor text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor"
                    >
                      Submit
                    </Button>
                  </div>
                </InputGroup>
              </form>
            </div>

            {/* Right: chat mock */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-sm rounded-2xl border border-zinc-200/70 bg-white shadow-lg dark:border-zinc-800/70 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex size-6 items-center justify-center rounded-full bg-primarycolor text-xs font-bold text-white"
                      aria-hidden="true"
                    >
                      L
                    </span>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Ask Lucy
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:hover:text-zinc-200"
                    aria-label="Close preview"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-3 px-4 py-4">
                  <div className="max-w-[90%] rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
                    Find 3-bedroom condos in Toronto Beach under $1.5M
                  </div>

                  {[
                    { addr: '231 Collins Ave', price: '$1,450,000' },
                    { addr: '88 Ocean Drive', price: '$1,395,000' },
                    { addr: '712 Jefferson Ave', price: '$1,245,000' },
                  ].map((row) => (
                    <div
                      key={row.addr}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-white px-3 py-2 dark:border-zinc-800/70 dark:bg-zinc-950/20"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                          {row.addr}
                        </div>
                        <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                          {row.price}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-full bg-primarycolor px-3 py-1 text-[11px] font-semibold text-white hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
                      >
                        Submit
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-200/70 px-4 py-3 dark:border-zinc-800/70">
                  <InputGroup className="h-10 rounded-full border-zinc-200/80 bg-white dark:border-zinc-800/70 dark:bg-zinc-950/10">
                    <InputGroupInput
                      aria-label="Type a message"
                      placeholder="Ask about condos in Toronto…"
                      className="h-10 px-4 text-sm"
                    />
                    <InputGroupAddon align="inline-end" className="pr-2">
                      <Button
                        type="button"
                        size="icon-xs"
                        className="rounded-full bg-primarycolor text-white hover:bg-primarycolor/90"
                        aria-label="Send"
                      >
                        <Send className="size-3.5" aria-hidden="true" />
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="bg-white dark:bg-background">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 py-10">
          <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
            {stats.slice(0, 4).map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-extrabold text-primarycolor">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <a
              href="/chat"
              className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2"
            >
              Try Lucy now <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
