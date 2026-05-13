import React from 'react';

import { SearchIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';

const CITIES = [
  'Toronto',
  'Vancouver',
  'Ottawa',
  'Calgary',
  'Montreal',
  'Edmonton',
] as const;

export default function CitySearchSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 sm:px-10 pb-14 sm:pb-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          Find your dream home in Canada.
        </h2>
        <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-300">
          Browse active listings across all major cities.
        </p>

        <form action="/listings" method="get" className="mt-7 sm:mt-9">
          <div className="mx-auto w-full max-w-2xl">
            <InputGroup className="h-12 rounded-full border-primarycolor/30 bg-white/80 backdrop-blur supports-backdrop-filter:bg-white/70 dark:bg-zinc-950/35 dark:border-primarycolor/25">
              <InputGroupAddon className="pl-4" align="inline-start">
                <SearchIcon
                  className="size-4 text-primarycolor"
                  aria-hidden="true"
                />
              </InputGroupAddon>
              <InputGroupInput
                name="city"
                aria-label="Search by city"
                placeholder="Search by city — Toronto, Ottawa, Vancouver…"
                className="h-12 px-3 text-base"
                autoComplete="address-level2"
              />
              <div className="pr-1.5">
                <Button
                  type="submit"
                  className="h-10 rounded-full px-7 font-semibold bg-primarycolor text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor"
                >
                  Search
                </Button>
              </div>
            </InputGroup>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {CITIES.map((city) => (
            <a
              key={city}
              href={`/listings?city=${encodeURIComponent(city)}`}
              className="inline-flex items-center justify-center rounded-full border border-primarycolor/35 bg-white/70 px-4 py-2 text-sm font-semibold text-primarycolor transition hover:bg-white/95 hover:border-primarycolor/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:bg-zinc-950/25 dark:hover:bg-zinc-950/45"
            >
              {city}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
