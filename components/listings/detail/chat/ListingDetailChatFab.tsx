'use client';

import { MessageCircleIcon, XIcon } from 'lucide-react';

type ListingDetailChatFabProps = {
  open: boolean;
  onToggle: () => void;
};

export default function ListingDetailChatFab({ open, onToggle }: ListingDetailChatFabProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Close Lucy chat' : 'Ask Lucy about this listing'}
      aria-expanded={open}
      className="relative flex size-14 items-center justify-center rounded-full bg-primarycolor text-white shadow-lg ring-2 ring-white transition hover:bg-primarycolor/90 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor focus-visible:ring-offset-2 dark:ring-zinc-950"
    >
      {open ? (
        <XIcon className="size-5" aria-hidden="true" />
      ) : (
        <MessageCircleIcon className="size-5" aria-hidden="true" />
      )}

      {!open && (
        <span
          className="absolute inset-0 rounded-full ring-2 ring-primarycolor/50 animate-ping"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
