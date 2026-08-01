'use client';

import { ClockIcon } from 'lucide-react';

type ShowingIdentityAwaitingMessageProps = {
  className?: string;
};

export default function ShowingIdentityAwaitingMessage({
  className = '',
}: ShowingIdentityAwaitingMessageProps) {
  return (
    <p
      className={`inline-flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300 ${className}`}
      role="status"
    >
      <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
      ID uploaded — awaiting agent verification
    </p>
  );
}
