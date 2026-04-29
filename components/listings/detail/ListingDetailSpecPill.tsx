import React from 'react';

type ListingDetailSpecPillProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

export default function ListingDetailSpecPill({
  icon,
  label,
  value,
}: ListingDetailSpecPillProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-zinc-100/90 px-3 py-2.5 dark:bg-zinc-800/50">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}
