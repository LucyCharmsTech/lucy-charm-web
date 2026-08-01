'use client';

import Link from 'next/link';
import { BedDoubleIcon, BathIcon, RulerIcon } from 'lucide-react';

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
      className="mt-1 grid grid-cols-1 gap-2"
    >
      {cards.map((card) => {
        const location = card.display_address || `${card.city}, ${card.state}`;
        const specs = [
          card.beds != null
            ? { label: `${card.beds} bed${card.beds !== 1 ? 's' : ''}`, Icon: BedDoubleIcon }
            : null,
          card.baths != null
            ? { label: `${card.baths} bath${card.baths !== 1 ? 's' : ''}`, Icon: BathIcon }
            : null,
          card.sqft != null
            ? { label: `${card.sqft.toLocaleString()} sqft`, Icon: RulerIcon }
            : null,
        ].filter(Boolean) as Array<{
          label: string;
          Icon: typeof BedDoubleIcon;
        }>;

        const ariaLabel = [
          card.title,
          location,
          formatPrice(card.price, card.currency),
          specs.map((s) => s.label).join(', '),
          card.property_type ?? '',
        ]
          .filter(Boolean)
          .join(' — ');

        return (
          <Link
            key={card.listing_id}
            href={`/listings/${card.listing_id}`}
            aria-label={ariaLabel}
            className="group block overflow-hidden rounded-xl border border-zinc-200/80 bg-white transition hover:border-primarycolor/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-700 dark:bg-zinc-900/70"
          >
            <div className="flex gap-3 p-2.5">
              <div
                className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800"
                aria-hidden="true"
              >
                {card.primary_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.primary_image_url}
                    alt=""
                    className="size-full object-cover transition group-hover:scale-[1.03]"
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

              <div className="min-w-0 flex-1" aria-hidden="true">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                  {card.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {location}
                </p>
                <p className="mt-1.5 text-sm font-bold text-primarycolor">
                  {formatPrice(card.price, card.currency)}
                </p>
                {specs.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                    {specs.map(({ label, Icon }) => (
                      <li
                        key={label}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800"
                      >
                        <Icon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
