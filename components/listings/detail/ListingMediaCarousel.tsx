"use client";

import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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

// The IDX feed returns five near-identical variants for each photo position.
const MEDIA_BATCH_SIZE = 5;

export default function ListingMediaCarousel({
  primaryImage,
  imageAlt,
  media,
}: ListingMediaCarouselProps) {
  const images = useMemo<CarouselImage[]>(() => {
    const candidates = [
      { url: primaryImage, alt: imageAlt },
      ...media
        .filter((item) => !item.media_type || item.media_type.startsWith("image/"))
        .filter((_, index) => index % MEDIA_BATCH_SIZE === 0)
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
      <div className="flex aspect-16/10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-zinc-100 text-sm text-zinc-500 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900 dark:text-zinc-400">
        Listing images are unavailable
      </div>
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
        <Image
          key={availableImages[safeIndex].url}
          src={availableImages[safeIndex].url}
          alt={availableImages[safeIndex].alt}
          onError={() => handleImageError(availableImages[safeIndex].url)}
          fill
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
