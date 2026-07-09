'use client';

import Link from 'next/link';

import type { ChatPlaceCard } from '@/types/api';

type ChatPlaceCardsProps = {
  cards: ChatPlaceCard[];
};

function formatPrice(price: number, currency: string): string {
  const currencyCode = currency && currency.length <= 4 ? currency : 'CAD';
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price.toLocaleString()} ${currencyCode}`;
  }
}

export default function ChatPlaceCards({ cards }: ChatPlaceCardsProps) {
  if (!cards.length) return null;

  return (
    <section
      aria-label={`${cards.length} suggested listing${cards.length === 1 ? '' : 's'}`}
      className="mt-1 grid gap-2 sm:grid-cols-2"
    >
      {cards.map((card) => {
        const location = card.display_address || `${card.city}, ${card.state}`;
        const specs = [
          card.beds != null ? `${card.beds} bed${card.beds !== 1 ? 's' : ''}` : null,
          card.baths != null ? `${card.baths} bath${card.baths !== 1 ? 's' : ''}` : null,
          card.sqft != null ? `${card.sqft.toLocaleString()} sqft` : null,
        ]
          .filter(Boolean)
          .join(', ');

        const ariaLabel = [
          card.title,
          location,
          formatPrice(card.price, card.currency),
          specs,
          card.property_type ?? '',
        ]
          .filter(Boolean)
          .join(' — ');

        return (
          <Link
            key={card.listing_id}
            href={`/listings/${card.listing_id}`}
            aria-label={ariaLabel}
            className="group rounded-xl border border-zinc-200/80 bg-white p-2.5 transition hover:border-primarycolor/40 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900/70 dark:hover:bg-zinc-900"
          >
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              <div
                className="size-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
                aria-hidden="true"
              >
                {card.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.primary_image_url}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-zinc-400 dark:text-zinc-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1" aria-hidden="true">
                <p className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {card.title}
                </p>
                <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                  {location}
                </p>
                <p className="mt-1 text-xs font-semibold text-primarycolor">
                  {formatPrice(card.price, card.currency)}
                </p>
                {specs && (
                  <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                    {specs}
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
