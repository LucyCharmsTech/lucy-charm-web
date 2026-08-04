'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` styles the confirm action red and focuses Cancel first. */
  tone?: 'default' | 'danger';
  /** Disables both actions while an in-flight request settles. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safest action on open, then hand focus back to whatever opened the
  // dialog, so a keyboard user is not dropped at the top of the document on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
    return () => previouslyFocused?.focus();
  }, [open, tone]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      // Without a trap, Tab walks straight out into the page behind the overlay.
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    // Portalled to <body> because `fixed` is not viewport-relative inside a
    // `backdrop-blur` ancestor (NavBar's sticky header) — it would centre itself in
    // the header and clip. `data-modal-root` lets dropdowns that own a dialog tell
    // "click inside my portalled modal" apart from "click outside me".
    <div
      data-modal-root="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      // Backdrop only — a mousedown that started on the card itself must not cancel.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xl dark:border-zinc-800/80 dark:bg-zinc-900"
      >
        <div className="flex items-start gap-3">
          {tone === 'danger' && (
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
              <TriangleAlertIcon className="size-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
              >
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-zinc-900',
              tone === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600 dark:bg-red-500 dark:hover:bg-red-600 dark:focus-visible:ring-red-400'
                : 'bg-primarycolor hover:bg-primarycolor/90 focus-visible:ring-primarycolor',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
