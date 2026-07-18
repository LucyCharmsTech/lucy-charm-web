'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  listClientDocuments,
  upsertClientDocument,
  type ClientDocumentItem,
  type ClientDocumentStatus,
} from '@/lib/clientPortalStorage';

export default function ClientDocumentsSection() {
  const [items, setItems] = useState<ClientDocumentItem[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItems(listClientDocuments());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function updateStatus(id: string, status: ClientDocumentStatus) {
    const current = items.find((entry) => entry.id === id);
    if (!current) return;
    const next = upsertClientDocument({
      ...current,
      status,
      updated_at: new Date().toISOString(),
    });
    setItems(next);
  }

  function updateNotes(id: string, notes: string) {
    const current = items.find((entry) => entry.id === id);
    if (!current) return;
    const next = upsertClientDocument({
      ...current,
      notes,
      updated_at: new Date().toISOString(),
    });
    setItems(next);
  }

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Documents</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Keep your transaction document checklist up to date.
      </p>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-zinc-200/80 p-3 dark:border-zinc-700/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant={item.status === 'needed' ? 'default' : 'outline'} onClick={() => updateStatus(item.id, 'needed')}>
                  Needed
                </Button>
                <Button type="button" size="sm" variant={item.status === 'uploaded' ? 'default' : 'outline'} onClick={() => updateStatus(item.id, 'uploaded')}>
                  Uploaded
                </Button>
                <Button type="button" size="sm" variant={item.status === 'verified' ? 'default' : 'outline'} onClick={() => updateStatus(item.id, 'verified')}>
                  Verified
                </Button>
              </div>
            </div>
            <Input
              value={item.notes}
              onChange={(event) => updateNotes(item.id, event.target.value)}
              placeholder="Notes (document location, pending items, etc.)"
              className="mt-2 h-9"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
