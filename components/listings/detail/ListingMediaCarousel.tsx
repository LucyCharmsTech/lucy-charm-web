"use client";

import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { ListingPhotoPlaceholder } from '@/components/listings/ListingPhotoPlaceholder';
import { useMemo, useState } from "react";

import type { ApiListingMedia } from "@/types/api";

type ListingMediaCarouselProps = {
  primaryImage: string;
  imageAlt: string;
  media: ApiListingMedia[];
};

type CarouselImage = {
  url: string;
  alt: string;
};

export default function ListingMediaCarousel({
  primaryImage,
  imageAlt,
  media,
}: ListingMediaCarouselProps) {
  const images = useMemo<CarouselImage[]>(() => {
    const candidates = [
      { url: primaryImage, alt: imageAlt },
      // Every row here is already one distinct photo. AMPRE used to send five
      // near-identical size variants per position, which this component worked
      // around by keeping every fifth row; ingest now collapses them (migration
      // y7z8a9b0c1) and a unique index on (listing_id, lower(btrim(media_url)))
      // makes a duplicate impossible. The workaround outlived the problem and
      // was discarding four fifths of every gallery.
      ...media
        .filter((item) => !item.media_type || item.media_type.startsWith("image/"))
        .map((item, index) => ({
          url: item.media_url,
          alt: item.caption || `${imageAlt} photo ${index + 2}`,
        })),
    ];
    const seen = new Set<string>();
    return candidates.filter((image) => {
      if (!image.url || seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
  }, [imageAlt, media, primaryImage]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const availableImages = useMemo(
    () => images.filter((image) => !failedUrls.has(image.url)),
    [failedUrls, images],
  );
  const safeIndex = Math.min(
    activeIndex,
    Math.max(availableImages.length - 1, 0),
  );
  const hasMultiple = availableImages.length > 1;

  const handleImageError = (url: string) => {
    setFailedUrls((current) => {
      if (current.has(url)) return current;
      const next = new Set(current);
      next.add(url);
      return next;
    });
  };

  if (!availableImages.length) {
    return (
      <ListingPhotoPlaceholder className="aspect-16/10 rounded-2xl border border-zinc-200/80 shadow-sm dark:border-zinc-800/80" />
    );
  }

  const move = (direction: 1 | -1) => {
    setActiveIndex((current) =>
      (current + direction + availableImages.length) % availableImages.length,
    );
  };

  return (
    <div
      role="region"
      aria-label="Listing photo carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (!hasMultiple) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          move(1);
        }
      }}
      className="w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:border-zinc-800/80 dark:bg-zinc-900/40"
    >
      <div className="relative aspect-16/10 sm:aspect-21/9">
        {/*
          `unoptimized`: board photos are served straight from the feed's CDN
          rather than proxied through our own image optimiser. Two reasons, and
          both matter.

          Compliance: these URLs already carry the brokerage watermark, burned
          in by the board's own imgproxy — the `wm:`/`wmt:` segments encode
          "…Realty Inc., Brokerage". Re-encoding and downscaling that is an
          alteration of an attributed image, and at small widths it renders the
          attribution illegible.

          Reliability: the optimiser fetches the remote file server-side, so a
          slow or unreachable CDN became a 500 from our own origin for every
          photo on the page. Served directly, a failure is one broken image the
          browser reports to `onError`, which is what the fallback below is for.
        */}
        <Image
          key={availableImages[safeIndex].url}
          src={availableImages[safeIndex].url}
          alt={availableImages[safeIndex].alt}
          onError={() => handleImageError(availableImages[safeIndex].url)}
          fill
          unoptimized
          priority={safeIndex === 0}
          sizes="(min-width: 1024px) 66vw, 100vw"
          className="object-cover"
        />

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous listing photo"
              className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeftIcon className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next listing photo"
              className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronRightIcon className="size-5" aria-hidden="true" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {safeIndex + 1} / {availableImages.length}
            </span>
          </>
        )}
      </div>

      {hasMultiple && (
        <div
          className="listing-media-scrollbar flex w-full min-w-0 max-w-full flex-nowrap snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain p-3"
          aria-label="Listing photo thumbnails"
        >
          {availableImages.map((image, index) => (
            <button
              type="button"
              key={image.url}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show listing photo ${index + 1}`}
              aria-current={index === safeIndex}
              className={`relative size-16 shrink-0 snap-start overflow-hidden rounded-lg border-2 transition sm:size-20 ${
                index === safeIndex
                  ? "border-primarycolor"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={image.url}
                alt=""
                onError={() => handleImageError(image.url)}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
