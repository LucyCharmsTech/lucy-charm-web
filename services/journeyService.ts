/**
 * The client journey — controls 6.1, 6.2, 6.3.
 *
 * Control 6.2: *"Use **one server-controlled mapping** of stage/role/conditions
 * to visible modules, primary action, completion trigger and next stage. **Do
 * not hard-code competing rules in screens.**"*
 *
 * So this file has **no stage list and no labels**. Both come from the server,
 * which reads them from `app/api/journeys/stages.py` — transcribed from the
 * client's own tables at MVP 1–6 pages 12–13. B5: *"do not invent a second set
 * of labels."*
 */

import api from '@/lib/axios';
import type { Journey, JourneyStage } from '@/types/api';

export type JourneyType = 'buyer' | 'seller';

export async function fetchMyJourneys(): Promise<Journey[]> {
  const res = await api.get<Journey[]>('/journeys/mine');
  return res.data;
}

/** Returns the journey, starting it at its first stage if there is none yet. */
export async function fetchMyJourney(type: JourneyType): Promise<Journey> {
  const res = await api.get<Journey>(`/journeys/mine/${type}`);
  return res.data;
}

/** The whole mapping, so a progress display reads it rather than restating it. */
export async function fetchStageMap(type: JourneyType): Promise<JourneyStage[]> {
  const res = await api.get<JourneyStage[]>(`/journeys/stage-map/${type}`);
  return res.data;
}

/**
 * Where the primary action should take someone.
 *
 * The action's *words* come from the server; only the destination is a
 * front-end concern, because only the front end knows its own routes. Keyed on
 * the stage code, which is stable — never on the label, which Hamed may reword.
 */
export const STAGE_DESTINATIONS: Record<string, string> = {
  // Buyer
  exploring: '/listings',
  search_and_preferences: '/listings',
  saved_shortlisted: '/profile#saved-homes',
  showing_open_house: '/profile#showings',
  offer_negotiation: '/profile#showings',
  accepted_conditions: '/documents',
  closing_move_in: '/documents',
  post_closing: '/profile',
  // Seller
  details_in_progress: '/sell',
  plan_ready: '/seller-portal',
  professional_review_requested: '/seller-portal',
  professional_follow_up: '/seller-portal',
  converted_preparation: '/seller-portal',
  active_listing: '/seller-portal',
  offers: '/seller-portal',
  closing: '/seller-portal',
  closed_post_closing: '/seller-portal',
};

export function destinationFor(journey: Journey): string {
  // `/sell` for a seller at Exploring, `/listings` for a buyer — the two share
  // the `exploring` code, so the type decides.
  if (journey.stage === 'exploring') {
    return journey.journey_type === 'seller' ? '/sell' : '/listings';
  }
  return STAGE_DESTINATIONS[journey.stage] ?? '/profile';
}

/**
 * Which portal modules this person should see — controls 6.4 and 6.19.
 *
 * The server resolves two different reasons a module might be absent — **not
 * switched on** (6.19's flag) and **not relevant to you** (6.4) — so a screen
 * cannot confuse them. It returns only the keys that pass both.
 */
export async function fetchVisibleModules(type: JourneyType): Promise<string[]> {
  const res = await api.get<string[]>(`/journeys/mine/${type}/modules`);
  return res.data;
}
