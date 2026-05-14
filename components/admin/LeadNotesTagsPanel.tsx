'use client';

import { useCallback, useEffect, useState } from 'react';
import { TagIcon, StickyNoteIcon, Trash2Icon } from 'lucide-react';
import {
  createLeadNote,
  createLeadTag,
  deleteLeadNote,
  deleteLeadTag,
  fetchLeadNotes,
  fetchLeadTags,
} from '@/services/superadminService';
import type { LeadInternalNoteRead, LeadTagRead } from '@/types/api';

function extractErrorMessage(e: unknown): string {
  return (
    (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
    'Something went wrong.'
  );
}

export default function LeadNotesTagsPanel({ leadId }: { leadId: string }) {
  const [notes, setNotes] = useState<LeadInternalNoteRead[] | null>(null);
  const [tags, setTags] = useState<LeadTagRead[] | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [n, t] = await Promise.all([fetchLeadNotes(leadId), fetchLeadTags(leadId)]);
    setNotes(n.filter((x) => !x.deleted_at));
    setTags(t.filter((x) => !x.deleted_at));
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    load().catch((e: unknown) => {
      if (!cancelled) setError(extractErrorMessage(e));
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onAddNote(e: React.FormEvent) {
    e.preventDefault();
    const body = noteBody.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createLeadNote(leadId, body);
      setNoteBody('');
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAddTag(e: React.FormEvent) {
    e.preventDefault();
    const label = tagInput.trim();
    if (!label || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createLeadTag(leadId, label);
      setTagInput('');
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveNote(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLeadNote(leadId, id);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveTag(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLeadTag(leadId, id);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (notes === null || tags === null) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading notes and tags…</p>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      <section aria-labelledby="tags-heading" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="mb-4 flex items-center gap-2">
          <TagIcon className="size-5 text-primarycolor" aria-hidden="true" />
          <h2 id="tags-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Lead tags
          </h2>
        </div>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Tags are normalised to lowercase. Duplicates are rejected.
        </p>
        <form onSubmit={onAddTag} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="new-tag" className="sr-only">
              New tag label
            </label>
            <input
              id="new-tag"
              type="text"
              value={tagInput}
              onChange={(ev) => setTagInput(ev.target.value)}
              maxLength={64}
              placeholder="e.g. first-time-buyer"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-primarycolor/30 placeholder:text-zinc-400 focus:border-primarycolor focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !tagInput.trim()}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primarycolor px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            Add tag
          </button>
        </form>
        {tags.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">No tags yet.</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2" role="list">
            {tags.map((t) => (
              <li key={t.id}>
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 py-1 pl-3 pr-1 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {t.tag_label}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemoveTag(t.id)}
                    className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:bg-zinc-600 dark:hover:text-zinc-50"
                    aria-label={`Remove tag ${t.tag_label}`}
                  >
                    <Trash2Icon className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notes-heading" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="mb-4 flex items-center gap-2">
          <StickyNoteIcon className="size-5 text-primarycolor" aria-hidden="true" />
          <h2 id="notes-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Internal notes
          </h2>
        </div>
        <form onSubmit={onAddNote} className="space-y-2">
          <label htmlFor="new-note" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            Add a note (visible only to superadmin staff)
          </label>
          <textarea
            id="new-note"
            value={noteBody}
            onChange={(ev) => setNoteBody(ev.target.value)}
            rows={4}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-primarycolor/30 placeholder:text-zinc-400 focus:border-primarycolor focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            placeholder="Context for the team…"
          />
          <button
            type="submit"
            disabled={busy || !noteBody.trim()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-primarycolor px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            Save note
          </button>
        </form>
        {notes.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">No notes yet.</p>
        ) : (
          <ul className="mt-6 space-y-4" role="list">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{n.body}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemoveNote(n.id)}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-red-100 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor dark:hover:bg-red-950/50 dark:hover:text-red-300"
                    aria-label="Delete note"
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
