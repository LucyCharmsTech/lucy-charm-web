import { ImageOffIcon } from 'lucide-react';

/**
 * Stands in where a listing has no photograph.
 *
 * This slot used to hold a real photo of an unrelated property, pulled from a
 * stock-photo service. Beside a genuine address that reads as a picture of the
 * home, which it is not — and it made every image-less card depend on a third
 * party being reachable.
 *
 * Some listings legitimately have no photograph: a handful carry only PDFs, and
 * the board sends feature sheets and floor plans for those. Saying so is the
 * honest answer.
 */
type ListingPhotoPlaceholderProps = {
  /** Sizing and shape come from the caller, which knows the slot. */
  className?: string;
  /** What the listing is, so the label is not the same on every card. */
  label?: string;
  compact?: boolean;
};

export function ListingPhotoPlaceholder({
  className = '',
  label = 'No photo available',
  compact = false,
}: ListingPhotoPlaceholderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 bg-zinc-100 text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-400 ${className}`}
      role="img"
      aria-label={label}
    >
      <ImageOffIcon
        className={compact ? 'size-5' : 'size-7'}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <span
        className={`px-3 text-center font-medium ${compact ? 'text-[10px]' : 'text-xs'}`}
      >
        {label}
      </span>
    </div>
  );
}
