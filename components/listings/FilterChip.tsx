import React from 'react';

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

export default function FilterChip({
  active,
  onClick,
  children,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 ${
        active
          ? 'border-primarycolor bg-primarycolor text-white'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-primarycolor/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}
