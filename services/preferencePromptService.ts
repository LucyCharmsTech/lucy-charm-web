/**
 * Progressive preference prompts — control 6.9.
 *
 * *"Ask **one** optional useful question at a natural moment; **never repeat
 * known information**; explain the immediate benefit."*
 *
 * All three rules are enforced server-side, so this file has **no question
 * list and no ordering**. It asks what to ask, and reports the answer. A
 * client-side catalogue would drift from what the account already knows, which
 * is exactly the failure 6.9 names.
 */

import api from '@/lib/axios';
import type { PreferencePrompt } from '@/types/api';

/** The one question worth asking now, or `null` when there is nothing. */
export async function fetchNextPreferencePrompt(): Promise<PreferencePrompt | null> {
  const res = await api.get<PreferencePrompt | null>('/users/me/preference-prompt');
  return res.data ?? null;
}

/** Answer one; returns the next question, or `null`. */
export async function answerPreferencePrompt(
  key: string,
  value: unknown,
): Promise<PreferencePrompt | null> {
  const res = await api.post<PreferencePrompt | null>('/users/me/preference-prompt', {
    key,
    value,
  });
  return res.data ?? null;
}

/** Decline one, permanently. Control 6.18: "do not nag after dismissal." */
export async function dismissPreferencePrompt(
  key: string,
): Promise<PreferencePrompt | null> {
  const res = await api.delete<PreferencePrompt | null>(
    `/users/me/preference-prompt/${key}`,
  );
  return res.data ?? null;
}

/**
 * How to render an answer control for a prompt.
 *
 * Keyed on the server's `field`, which is stable, rather than on the question
 * text, which Hamed may reword. An unrecognised field falls back to free text
 * so a prompt added server-side still works before the front end knows it.
 */
export function inputKindFor(field: string): 'number' | 'boolean' | 'text' {
  if (['budget_max', 'budget_min', 'min_bedrooms', 'min_bathrooms'].includes(field)) {
    return 'number';
  }
  if (field === 'parking_required') return 'boolean';
  return 'text';
}
