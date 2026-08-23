/**
 * Credits the brokerage that listed the property.
 *
 * Board rules require the listing brokerage to be identified wherever the
 * listing itself is shown, which includes search results and not only the
 * detail page. Rendering the name unlabelled is not enough: it has to be
 * legible as whose listing it is, so the "Listed by" prefix is part of the
 * obligation rather than decoration.
 *
 * Renders nothing when there is no brokerage. A placeholder in this slot would
 * be worse than an absence -- it reads as attribution while crediting no one.
 */
type ListingAttributionProps = {
  brokerage: string | null | undefined;
  /** `card` is the compact one-line form used in listing grids. */
  variant?: 'card' | 'detail';
  className?: string;
};

export function ListingAttribution({
  brokerage,
  variant = 'card',
  className = '',
}: ListingAttributionProps) {
  if (!brokerage) {
    return null;
  }

  if (variant === 'card') {
    return (
      <p
        className={`truncate text-[11px] leading-tight text-zinc-500 dark:text-zinc-400 ${className}`}
        title={`Listed by ${brokerage}`}
      >
        Listed by {brokerage}
      </p>
    );
  }

  return (
    <p className={`text-sm text-zinc-600 dark:text-zinc-400 ${className}`}>
      <span className="text-zinc-500 dark:text-zinc-500">Listed by </span>
      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{brokerage}</span>
    </p>
  );
}
