'use client';

import Link from 'next/link';
import { useState } from 'react';

import { BathIcon, BedDoubleIcon, MapPinIcon, RulerIcon } from 'lucide-react';

import SaveListingButton from '@/components/listings/SaveListingButton';
import { fetchListingMedia } from '@/services/listingsService';

const MEDIA_BATCH_SIZE = 5;

function ListingCardImage({
  src,
  alt,
  className,
  listingId,
}: {
  src: string;
  alt: string;
  className: string;
  listingId?: string | null;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [fallbackUrls, setFallbackUrls] = useState<string[] | null>(null);
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loadingFallback, setLoadingFallback] = useState(false);

  const handleImageError = async () => {
    if (fallbackUrls) {
      const nextIndex = fallbackIndex + 1;
      if (nextIndex < fallbackUrls.length) {
        setFallbackIndex(nextIndex);
        setCurrentSrc(fallbackUrls[nextIndex]);
      } else {
        setFailed(true);
      }
      return;
    }

    if (!listingId || loadingFallback || !/^[0-9a-f-]{36}$/i.test(listingId)) {
      setFailed(true);
      return;
    }

    setLoadingFallback(true);
    try {
      const media = await fetchListingMedia(listingId);
      const urls = Array.from(
        new Set(
          media
            .filter(
              (item) =>
                (!item.media_type || item.media_type.startsWith('image/')) &&
                item.media_url,
            )
            .sort((a, b) => a.display_order - b.display_order)
            .filter((_, index) => index % MEDIA_BATCH_SIZE === 0)
            .map((item) => item.media_url)
            .filter((url) => url !== currentSrc),
        ),
      );
      setFallbackUrls(urls);
      if (urls.length) {
        setFallbackIndex(0);
        setCurrentSrc(urls[0]);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoadingFallback(false);
    }
  };

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 ${className}`}
        role="img"
        aria-label={`${alt} image unavailable`}
      >
        Image unavailable
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading="lazy"
      onError={() => {
        void handleImageError();
      }}
      className={className}
    />
  );
}

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
  /** Second full-width CTA under View Details (e.g. portal client insights). */
  insightsHref?: string;
  insightsLabel?: string;
  view?: 'grid' | 'list';
  /** Listing UUID — when set, shows save / unsave (works signed-in or anonymously). */
  saveListingId?: string | null;
  /** Notified after a successful save or unsave from the card. */
  onSaveChange?: (next: { saved: boolean; listingId: string }) => void;
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
  insightsHref,
  insightsLabel,
  view = 'grid',
  saveListingId,
  onSaveChange,
}: ListingCardProps) {
  if (view === 'list') {
    return (
      <article className="group flex overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-950/30">
        <div className="relative w-40 sm:w-52 shrink-0">
          <ListingCardImage
            src={imageSrc}
            alt={imageAlt}
            listingId={saveListingId}
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
        <div className="flex flex-col items-stretch justify-center gap-2 pr-4">
          {saveListingId ? (
            <SaveListingButton
              listingId={saveListingId}
              variant="inline"
              className="w-full"
              onChange={onSaveChange}
            />
          ) : null}
          <Link
            href={detailsHref}
            className="inline-flex h-9 items-center justify-center rounded-full border border-primarycolor/35 bg-white px-4 text-xs font-semibold text-primarycolor transition hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:bg-zinc-950/10"
          >
            View Details
          </Link>
          {insightsHref && insightsLabel ? (
            <Link
              href={insightsHref}
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-950/10 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
            >
              {insightsLabel}
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-950/30">
      <div className="relative">
        <ListingCardImage
          src={imageSrc}
          alt={imageAlt}
          listingId={saveListingId}
          className="h-52 w-full object-cover"
        />
        <div className="absolute left-3 top-3 z-[1] flex flex-wrap gap-1.5">
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

        <div className="mt-3 flex flex-col gap-2">
          {saveListingId ? (
            <SaveListingButton
              listingId={saveListingId}
              variant="inline"
              className="w-full"
              onChange={onSaveChange}
            />
          ) : null}
          <Link
            href={detailsHref}
            className="inline-flex h-9 w-full items-center justify-center rounded-full border border-primarycolor/35 bg-white px-4 text-sm font-semibold text-primarycolor transition hover:border-primarycolor/55 hover:bg-primarycolor/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:bg-zinc-950/10"
          >
            View Details
          </Link>
          {insightsHref && insightsLabel ? (
            <Link
              href={insightsHref}
              className="inline-flex h-9 w-full items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-950/10 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
            >
              {insightsLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
