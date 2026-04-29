import Link from 'next/link';
import React from 'react';

import { BathIcon, BedDoubleIcon, MapPinIcon, RulerIcon } from 'lucide-react';

type ListingCardProps = {
  statusLabel?: string;
  typeLabel?: string;
  imageSrc: string;
  imageAlt: string;
  address: string;
  title?: string;
  bedsText: string;
  bathsText: string;
  sqftText?: string;
  locationText?: string;
  priceText: string;
  currency?: string;
  detailsHref: string;
  view?: 'grid' | 'list';
};

export default function ListingCard({
  statusLabel = 'Active',
  typeLabel,
  imageSrc,
  imageAlt,
  address,
  title,
  bedsText,
  bathsText,
  sqftText,
  locationText,
  priceText,
  currency = 'CAD',
  detailsHref,
  view = 'grid',
}: ListingCardProps) {
  if (view === 'list') {
    return (
      <article className="group flex overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-950/30">
        <div className="relative w-40 sm:w-52 shrink-0">
          <img
            src={imageSrc}
            alt={imageAlt}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold text-white">
            {statusLabel}
          </span>
          {typeLabel && (
            <span className="absolute left-2 top-8 inline-flex items-center rounded-full bg-primarycolor/90 px-2 py-0.5 text-[11px] font-semibold text-white">
              {typeLabel}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-between px-5 py-4">
          <div>
            <div className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {priceText}{' '}
              <span className="text-xs font-semibold text-zinc-400">
                {currency}
              </span>
            </div>
            {title && (
              <div className="mt-0.5 text-sm font-semibold text-primarycolor line-clamp-1">
                {title}
              </div>
            )}
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {address}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <BedDoubleIcon className="size-3.5" aria-hidden="true" />
              {bedsText}
            </span>
            <span className="flex items-center gap-1">
              <BathIcon className="size-3.5" aria-hidden="true" />
              {bathsText}
            </span>
            {sqftText && (
              <span className="flex items-center gap-1">
                <RulerIcon className="size-3.5" aria-hidden="true" />
                {sqftText}
              </span>
            )}
            {locationText && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="size-3.5" aria-hidden="true" />
                {locationText}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center pr-4">
          <Link
            href={detailsHref}
            className="inline-flex h-9 items-center justify-center rounded-full border border-primarycolor/35 bg-white px-4 text-xs font-semibold text-primarycolor transition hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:bg-zinc-950/10"
          >
            View Details
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-950/30">
      <div className="relative">
        <img
          src={imageSrc}
          alt={imageAlt}
          loading="lazy"
          className="h-52 w-full object-cover"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-emerald-600/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            {statusLabel}
          </span>
          {typeLabel && (
            <span className="inline-flex items-center rounded-full bg-primarycolor/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              {typeLabel}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {priceText}{' '}
          <span className="text-xs font-semibold text-zinc-400">
            {currency}
          </span>
        </div>
        {title && (
          <div className="mt-0.5 text-sm font-semibold text-primarycolor line-clamp-1">
            {title}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <BedDoubleIcon className="size-3.5" aria-hidden="true" />
            {bedsText}
          </span>
          <span className="flex items-center gap-1">
            <BathIcon className="size-3.5" aria-hidden="true" />
            {bathsText}
          </span>
          {sqftText && (
            <span className="flex items-center gap-1">
              <RulerIcon className="size-3.5" aria-hidden="true" />
              {sqftText}
            </span>
          )}
        </div>
        {locationText && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
            <MapPinIcon className="size-3.5" aria-hidden="true" />
            {locationText}
          </div>
        )}

        <div className="mt-3">
          <Link
            href={detailsHref}
            className="inline-flex h-9 w-full items-center justify-center rounded-full border border-primarycolor/35 bg-white px-4 text-sm font-semibold text-primarycolor transition hover:border-primarycolor/55 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:bg-zinc-950/10"
          >
            View Details
          </Link>
        </div>
      </div>
    </article>
  );
}
