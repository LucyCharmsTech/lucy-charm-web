'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NOT_SURE } from '@/types/homeValue';

/**
 * An optional property fact that can also be answered **"Not sure"**.
 *
 * Hamed: *"Provide 'Not sure' for uncertain property facts."*
 *
 * The checkbox is not a nicety. Without it, a seller who genuinely does not
 * know how many parking spots the unit has has two options: leave it blank, or
 * guess. Blank is indistinguishable from "skipped the question", and a guess
 * puts a wrong fact in front of the reviewer with the same confidence as a
 * right one. "Not sure" is a third answer that is more useful than either — it
 * tells the reviewer to check the title.
 *
 * Ticking it **disables and clears** the input rather than leaving a value
 * behind, so the submitted answer is unambiguous. A field that said both
 * "3" and "not sure" would have to be resolved by whoever reads it.
 */

type NotSureFieldProps = {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
};

export function NotSureField({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputMode = 'text',
}: NotSureFieldProps) {
  const isNotSure = value === NOT_SURE;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode={inputMode}
        value={isNotSure ? '' : (value ?? '')}
        onChange={(event) => onChange(event.target.value || undefined)}
        placeholder={isNotSure ? 'Not sure' : placeholder}
        disabled={isNotSure}
        className="h-11 rounded-xl"
      />
      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={isNotSure}
          onChange={(event) => onChange(event.target.checked ? NOT_SURE : undefined)}
          className="size-4 rounded border-zinc-300 text-primarycolor-text focus:ring-primarycolor"
          aria-label={`Not sure about ${label.toLowerCase()}`}
        />
        <span>Not sure</span>
      </label>
    </div>
  );
}
