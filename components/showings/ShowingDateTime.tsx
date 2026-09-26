import { CalendarIcon } from 'lucide-react';
import { formatShowingDateTimeParts } from '@/lib/showingPresentation';

export default function ShowingDateTime({ value }: { value: string }) {
  const { date, time, timezone } = formatShowingDateTimeParts(value);

  return (
    <time dateTime={value} className="flex items-start gap-1.5 text-zinc-700 dark:text-zinc-300">
      <CalendarIcon className="mt-0.5 size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
      <span className="min-w-0 leading-5">
        <span className="block font-medium">{date}</span>
        <span className="block">{time}</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{timezone}</span>
      </span>
    </time>
  );
}
