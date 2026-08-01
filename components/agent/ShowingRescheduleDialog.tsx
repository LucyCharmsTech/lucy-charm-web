'use client';

type ShowingRescheduleDialogProps = {
  open: boolean;
  value: string;
  busy?: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function ShowingRescheduleDialog({
  open,
  value,
  busy = false,
  onChange,
  onCancel,
  onSave,
}: ShowingRescheduleDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <h2 id="reschedule-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Reschedule showing
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose the new confirmed date and time. The buyer is emailed and sees the updated
          time in their profile.
        </p>
        <label
          className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-200"
          htmlFor="reschedule-at"
        >
          New date and time
        </label>
        <input
          id="reschedule-at"
          type="datetime-local"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!value || busy}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save new time
          </button>
        </div>
      </div>
    </div>
  );
}
