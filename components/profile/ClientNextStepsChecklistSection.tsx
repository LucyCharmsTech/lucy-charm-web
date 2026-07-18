'use client';

import { useEffect, useMemo, useState } from 'react';

import { listNextSteps, setNextStepDone, type NextStepItem } from '@/lib/clientPortalStorage';

export default function ClientNextStepsChecklistSection() {
  const [items, setItems] = useState<NextStepItem[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItems(listNextSteps());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const completed = useMemo(() => items.filter((item) => item.done).length, [items]);

  function toggle(id: string, done: boolean) {
    setItems(setNextStepDone(id, done));
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Next steps checklist</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Stay on track with your transaction progress.
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-primarycolor">
        {completed}/{items.length} completed
      </p>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(event) => toggle(item.id, event.target.checked)}
                className="size-4 accent-primarycolor"
              />
              <span className={item.done ? 'line-through opacity-70' : ''}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
