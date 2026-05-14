'use client';

import { useEffect, useRef } from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type ChatSummaryModalProps = {
  open: boolean;
  /** e.g. "Jane Doe" for heading and aria labelling */
  clientDisplayName: string;
  summaryText: string;
  onClose: () => void;
};

/**
 * Accessible full-text view for a truncated chat summary (native dialog + backdrop).
 */
export default function ChatSummaryModal({
  open,
  clientDisplayName,
  summaryText,
  onClose,
}: ChatSummaryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="chat-summary-modal-title"
      aria-describedby="chat-summary-modal-body"
      className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 [&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="flex max-h-[min(85vh,40rem)] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Chat summary
            </p>
            <h2 id="chat-summary-modal-title" className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {clientDisplayName}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="shrink-0 rounded-full"
            aria-label="Close summary"
            onClick={() => dialogRef.current?.close()}
          >
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </header>
        <div
          id="chat-summary-modal-body"
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200"
        >
          <p className="whitespace-pre-wrap break-words">{summaryText}</p>
        </div>
      </div>
    </dialog>
  );
}
