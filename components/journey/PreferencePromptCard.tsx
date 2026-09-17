'use client';

import { useEffect, useState } from 'react';
import { SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  answerPreferencePrompt,
  dismissPreferencePrompt,
  fetchNextPreferencePrompt,
  inputKindFor,
} from '@/services/preferencePromptService';
import type { PreferencePrompt } from '@/types/api';

/**
 * One optional question, asked once — control 6.9 (ADD).
 *
 * *"Ask **one** optional useful question at a natural moment; **never repeat
 * known information**; explain the immediate benefit."*
 *
 * Four things keep this from becoming a second onboarding wizard:
 *
 * **One question, never a list.** The server returns exactly one, and this
 * renders exactly one.
 *
 * **The benefit is always shown**, because 6.9 asks for it and the API makes
 * it a required field rather than something a screen may skip.
 *
 * **"Not now" is always there**, and it means never again — control 6.18: *"do
 * not nag after dismissal."* The decline is stored on the account, so it holds
 * on the next device too.
 *
 * **Nothing renders when there is nothing to ask.** For an established account
 * that is the normal state, so an empty response is ordinary rather than an
 * error.
 *
 * The question list lives on the server. A copy here would drift from what the
 * account already knows, which is the failure 6.9 names.
 */
export function PreferencePromptCard() {
  const [prompt, setPrompt] = useState<PreferencePrompt | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchNextPreferencePrompt()
      .then((next) => {
        if (active) setPrompt(next);
      })
      .catch(() => {
        // A prompt that cannot load is not worth telling anyone about — it is
        // optional by definition. Silence beats an error for a nicety.
        if (active) setPrompt(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!prompt) return null;

  const kind = inputKindFor(prompt.field);

  function moveOn(next: PreferencePrompt | null) {
    setPrompt(next);
    setValue('');
    setError(null);
  }

  async function submit(answer: unknown) {
    if (!prompt) return;
    setBusy(true);
    setError(null);
    try {
      moveOn(await answerPreferencePrompt(prompt.key, answer));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not save that. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    if (!prompt) return;
    setBusy(true);
    try {
      moveOn(await dismissPreferencePrompt(prompt.key));
    } catch {
      // Declining is a nicety too; hide the card rather than argue about it.
      moveOn(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800/80 dark:bg-zinc-900/40"
      aria-label="A quick question"
    >
      <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        <SparklesIcon className="size-3.5" aria-hidden="true" />
        One quick question
      </p>

      <h3 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {prompt.question}
      </h3>
      {/* 6.9: "explain the immediate benefit." */}
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {prompt.benefit}
      </p>

      {kind === 'boolean' ? (
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void submit(true)}
            className="h-9 rounded-full bg-primarycolor px-4 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90"
          >
            Yes
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void submit(false)}
            className="h-9 rounded-full border border-zinc-200 bg-transparent px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            No
          </Button>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!value.trim()) return;
            void submit(kind === 'number' ? Number(value) : value.trim());
          }}
        >
          <Input
            aria-label={prompt.question}
            type={kind === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={busy}
            className="h-9 max-w-[12rem] rounded-lg"
          />
          <Button
            type="submit"
            disabled={busy || !value.trim()}
            className="h-9 rounded-full bg-primarycolor px-4 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90 disabled:opacity-60"
          >
            Save
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Always available, and it means never again. */}
      <button
        type="button"
        onClick={() => void dismiss()}
        disabled={busy}
        className="mt-3 text-xs text-zinc-500 underline-offset-2 hover:underline disabled:opacity-60 dark:text-zinc-400"
      >
        Not now
      </button>
    </section>
  );
}
