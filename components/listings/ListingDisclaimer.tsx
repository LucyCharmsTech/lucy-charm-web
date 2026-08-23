/**
 * The feed's terms-of-use notice.
 *
 * Stored on every listing the feed supplies and, until now, rendered nowhere.
 * Boards require the notice to accompany the data wherever it is displayed, so
 * it belongs on the page rather than in the database.
 *
 * Deliberately low-contrast but not hidden: it is fine print, and fine print
 * that cannot be read does not discharge the obligation.
 */
type ListingDisclaimerProps = {
  disclaimer: string | null | undefined;
  brokerage?: string | null;
  className?: string;
};

export function ListingDisclaimer({
  disclaimer,
  brokerage,
  className = '',
}: ListingDisclaimerProps) {
  if (!disclaimer && !brokerage) {
    return null;
  }

  return (
    <aside
      className={`mt-8 border-t border-zinc-200 pt-4 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700 dark:text-zinc-400 ${className}`}
      aria-label="Listing data disclaimer"
    >
      {brokerage ? (
        <p className="mb-1">
          Listing courtesy of{' '}
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">{brokerage}</span>.{' '}
          {/*
            The copyright year is completed here rather than stored with the
            listing: a year frozen into the database is wrong from the next
            January, and re-mapping every record to correct it would be absurd.
          */}
          &copy; {new Date().getFullYear()} TRREB. All rights reserved.
        </p>
      ) : null}
      {disclaimer ? <p>{disclaimer}</p> : null}
    </aside>
  );
}
