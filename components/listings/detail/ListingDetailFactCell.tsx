import React from 'react';

type ListingDetailFactCellProps = {
  label: string;
  value: string;
};

export default function ListingDetailFactCell({
  label,
  value,
}: ListingDetailFactCellProps) {
  return (
    <div className="rounded-xl bg-zinc-100/80 px-3 py-3 dark:bg-zinc-800/40">
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}
