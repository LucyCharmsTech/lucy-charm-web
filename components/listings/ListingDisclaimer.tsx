/**
 * The feed's terms-of-use notice, the brokerage credit, and the board marks.
 *
 * Boards require the notice to accompany the data wherever it is displayed, so
 * it belongs on every page that shows a feed listing — not only the detail
 * page, which is where it used to live alone.
 *
 * Deliberately low-contrast but not hidden: it is fine print, and fine print
 * that cannot be read does not discharge the obligation.
 */
import Image from 'next/image';

import { BOARD_MARKS, BOARD_NAME } from '@/lib/boardMarks';

type ListingDisclaimerProps = {
  disclaimer: string | null | undefined;
  brokerage?: string | null;
  /** When the listing data itself last changed, ISO-8601. */
  updatedAt?: string | null;
  /**
   * `results` is the compact form for a grid of listings, where the notice
   * covers the page rather than one property and there is no single brokerage
   * to credit.
   */
  variant?: 'detail' | 'results';
  className?: string;
};

export function ListingDisclaimer({
  disclaimer,
  brokerage,
  updatedAt,
  variant = 'detail',
  className = '',
}: ListingDisclaimerProps) {
  if (!disclaimer && !brokerage && variant === 'detail') {
    return null;
  }

  const marks = BOARD_MARKS.filter((mark) => Boolean(mark.src));

  return (
    <aside
      className={`mt-8 border-t border-zinc-200 pt-4 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 ${className}`}
      aria-label="Listing data disclaimer"
    >
      {marks.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-4">
          {marks.map((mark) => (
            // `unoptimized` on purpose: Next would otherwise re-encode and
            // resize the file, and a board trademark has to be reproduced as
            // supplied. Width is nominal — the style below drives the real size
            // while preserving aspect ratio.
            <Image
              key={mark.src}
              src={mark.src}
              alt={mark.alt}
              width={mark.height * 4}
              height={mark.height}
              unoptimized
              style={{ height: mark.height, width: 'auto' }}
              className="shrink-0"
            />
          ))}
        </div>
      )}

      {brokerage ? (
        <p className="mb-1">
          Listing courtesy of{' '}
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">{brokerage}</span>.{' '}
          {/*
            The copyright year is completed here rather than stored with the
            listing: a year frozen into the database is wrong from the next
            January, and re-mapping every record to correct it would be absurd.
          */}
          &copy; {new Date().getFullYear()} {BOARD_NAME}. All rights reserved.
        </p>
      ) : null}

      {disclaimer ? <p>{disclaimer}</p> : null}

      {variant === 'results' && !disclaimer ? (
        <p>
          IDX information is provided exclusively for consumers&rsquo; personal,
          non-commercial use and may not be used for any purpose other than to identify
          prospective properties consumers may be interested in purchasing. Listing
          information is deemed reliable but is not guaranteed accurate.
        </p>
      ) : null}

      {updatedAt ? <ListingFreshness updatedAt={updatedAt} /> : null}
    </aside>
  );
}

/**
 * When the listing information itself last changed.
 *
 * Six feed timestamps are tracked per listing and, until now, none of them
 * reached the page. A shopper comparing properties has no way to tell a record
 * refreshed an hour ago from one that has not moved in a month.
 */
function ListingFreshness({ updatedAt }: { updatedAt: string }) {
  const then = new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return null;

  return (
    <p className="mt-2">
      Listing information last updated{' '}
      <time dateTime={updatedAt} title={then.toLocaleString()}>
        {relativeLabel(then)}
      </time>
      .
    </p>
  );
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Longhand rather than `lib/relativeTime`'s compact "3h ago" form — that one is
 * tuned for a dense notification list, and this is a sentence.
 */
function relativeLabel(then: Date): string {
  const elapsed = Date.now() - then.getTime();
  if (elapsed < 0) return 'just now';
  if (elapsed < HOUR) {
    const minutes = Math.max(1, Math.floor(elapsed / MINUTE));
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (elapsed < 30 * DAY) {
    const days = Math.floor(elapsed / DAY);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return `on ${then.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`;
}
