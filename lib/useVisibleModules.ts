'use client';

import { useEffect, useState } from 'react';
import { fetchVisibleModules, type JourneyType } from '@/services/journeyService';

/**
 * Which portal modules to render — controls 6.4 and 6.19.
 *
 * The server decides. It separates **not switched on** (a feature flag, for
 * something incomplete or unlaunched) from **not relevant to you** (a buyer
 * has no use for a seller's listing activity), and returns only what passes
 * both.
 *
 * ### What happens when the request fails
 *
 * This is the decision that matters, and neither obvious answer is right.
 *
 * - **Show everything** on failure, and a network blip can reveal a module that is switched off precisely because it is not finished.
 * - **Show nothing** on failure, and a network blip empties somebody's portal. Their saved homes appear to have vanished.
 *
 * So it does neither. On failure it falls back to the modules that are
 * **always on** — the ones with no feature flag behind them. A blip can then
 * never expose an unlaunched feature, and can never make an established
 * account look empty. Relevance filtering is cosmetic and defaults to
 * showing; the flag is a safety boundary and is honoured even when we cannot
 * ask.
 *
 * The fallback list is duplicated from the server deliberately. Reading it
 * from the very response that just failed is not an option, and a fallback
 * that silently drifts from the server's list is worse than one that is
 * visibly written down here.
 */

/**
 * Modules with no feature flag on the server, so they are on for everyone the
 * relevance rules allow. Mirrors the unflagged entries of `PORTAL_MODULES`.
 */
const ALWAYS_ON: readonly string[] = [
  'saved_homes',
  'saved_searches',
  'showings',
  'documents',
  'home_value',
];

export type VisibleModules = {
  /** False until the server has answered, so a card can hold rather than flash. */
  ready: boolean;
  isVisible: (moduleKey: string) => boolean;
};

export function useVisibleModules(type: JourneyType = 'buyer'): VisibleModules {
  const [modules, setModules] = useState<readonly string[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchVisibleModules(type)
      .then((keys) => {
        if (active) setModules(keys);
      })
      .catch(() => {
        // See the note above: fall back to the unflagged modules, never to
        // everything and never to nothing.
        if (active) setModules(ALWAYS_ON);
      });
    return () => {
      active = false;
    };
  }, [type]);

  return {
    ready: modules !== null,
    // Before the answer arrives, treat the always-on set as visible. A portal
    // that renders empty for a moment and then fills in reads as broken, and
    // these are the modules that will almost certainly be in the answer.
    isVisible: (key) => (modules ?? ALWAYS_ON).includes(key),
  };
}
