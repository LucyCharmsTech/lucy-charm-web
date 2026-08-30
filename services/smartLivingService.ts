/**
 * Smart Living Benefits API calls.
 *
 * Two things in here are easy to get subtly wrong, and both are the kind of
 * wrong that looks fine in testing and costs money in production.
 *
 * **The idempotency key is per user *intent*, not per HTTP attempt.** A buyer
 * taps "Confirm" once; that is one intent. If the request times out and we
 * retry, the retry must carry the *same* key, or the server sees a new request
 * and reserves the money twice. Generating a key inside the request function —
 * the obvious place — defeats the entire mechanism, so `withIdempotencyKey`
 * below makes the key an explicit argument the caller has to hold onto.
 *
 * **No money is parsed or computed here.** The buyer's typed amount goes to
 * the server as the string they typed. The server's `money.py` is the only
 * parser and `benefit_engine.py` the only calculator; a second implementation
 * on the client would eventually disagree about a rounding edge, and the
 * disagreement would surface as a buyer seeing one number in the picker and a
 * different one on their plan.
 */

import api from '@/lib/axios';
import { getOrCreateAnonymousSessionToken } from '@/lib/anonymousSession';
import { ANONYMOUS_SESSION_HEADER } from '@/types/api';
import type {
  SmartLivingIntakeCandidate,
  SmartLivingPlan,
  SmartLivingPlanWriteRequest,
  SmartLivingPublicConfig,
} from '@/types/api';

const PLAN_STORAGE_KEY = 'lucy-smart-living-plan-id';

/** Matches the API's `require_idempotency_key` header alias. */
const IDEMPOTENCY_HEADER = 'Idempotency-Key';

function planHeaders(): Record<string, string> {
  const token = getOrCreateAnonymousSessionToken();
  return token ? { [ANONYMOUS_SESSION_HEADER]: token } : {};
}

// ---------------------------------------------------------------------------
// Plan id persistence
// ---------------------------------------------------------------------------
//
// The id, and only the id. The plan itself is a server row from the first
// answer — unlike Property Checkup, which keeps signed-out state entirely in
// localStorage. That difference is deliberate: a Smart Living plan has to be
// *claimed* exactly once at sign-in, and there is nothing to claim if the only
// copy lives in the browser.

export function getStoredSmartLivingPlanId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PLAN_STORAGE_KEY);
}

export function storeSmartLivingPlanId(planId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PLAN_STORAGE_KEY, planId);
  }
}

/** Called after a successful claim at sign-in: the plan is the account's now,
 *  and a stale anonymous pointer would send the next visit down the anonymous
 *  path for a plan that no longer answers to it. */
export function clearStoredSmartLivingPlanId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PLAN_STORAGE_KEY);
  }
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * Mint one key for one user intent.
 *
 * Call this **once**, when the buyer commits to something, and pass the result
 * to every retry of that same action. Do not call it inside a retry loop.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Header bundle for a money- or state-moving request.
 *
 * Exported so the components that will need it in Phases 3–5 (item confirm,
 * quote accept, benefit choice) cannot reinvent it. The API returns 400 when
 * the header is missing on such a route and 409 when a key is reused with a
 * different payload — never the original result, because handing back a stale
 * success for a request that never ran is worse than an error.
 */
export function withIdempotencyKey(key: string): Record<string, string> {
  return { ...planHeaders(), [IDEMPOTENCY_HEADER]: key };
}

// ---------------------------------------------------------------------------
// Public discovery
// ---------------------------------------------------------------------------

/**
 * The landing page and intake picker payload. No auth of any kind.
 *
 * `serviceArea` narrows the catalogue to what is fulfillable where the buyer
 * is buying. Omitted, the server returns what is fulfillable somewhere, and
 * the copy must not promise local availability.
 */
export async function fetchSmartLivingPublicConfig(
  serviceArea?: string,
): Promise<SmartLivingPublicConfig> {
  const response = await api.get<SmartLivingPublicConfig>(
    '/smart_living/public-config',
    serviceArea ? { params: { service_area: serviceArea } } : undefined,
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Natural-language intake
// ---------------------------------------------------------------------------

/**
 * Turn one sentence into an unconfirmed four-field candidate.
 *
 * Reads nothing and writes nothing — no plan is created, no answer is saved.
 * It needs no plan id and no session token because there is no plan to own
 * yet; a buyer types "Around $750K in Vaughan next spring, probably a condo"
 * before they have answered anything.
 *
 * **Do not send `purchase_amount_text` to a plan without showing it to the
 * buyer first.** `requires_amount_confirmation` says so explicitly, and
 * `prefill` deliberately excludes the amount so the correct path is also the
 * shorter one. The parse is a guess; the other three fields land in visible
 * fields a buyer corrects at a glance, and a wrong amount does not.
 */
export async function parseSmartLivingIntakeMessage(
  message: string,
): Promise<SmartLivingIntakeCandidate> {
  const response = await api.post<SmartLivingIntakeCandidate>(
    '/smart_living/intake/parse',
    { message },
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/**
 * Create from intake. Every field is optional — the flow is resumable, so a
 * buyer who answers one question and closes the tab still has a real plan to
 * come back to.
 */
export async function createSmartLivingPlan(
  payload: SmartLivingPlanWriteRequest,
): Promise<SmartLivingPlan> {
  const response = await api.post<SmartLivingPlan>(
    '/smart_living/plans/',
    payload,
    { headers: planHeaders() },
  );
  storeSmartLivingPlanId(response.data.id);
  return response.data;
}

export async function fetchSmartLivingPlan(
  planId: string,
): Promise<SmartLivingPlan> {
  const response = await api.get<SmartLivingPlan>(
    `/smart_living/plans/${planId}`,
    { headers: planHeaders() },
  );
  return response.data;
}

/**
 * Patch the allow-listed intake fields.
 *
 * Send only what changed. The server distinguishes an absent field from an
 * explicit `null` — omitting `home_type` leaves it alone, sending `null`
 * clears it — and it only recalculates when a *basis* input moved, so editing
 * the timeline will not restamp "Last updated".
 *
 * One asymmetry worth knowing: sending `purchase_range_key` **and**
 * `purchase_amount` together is a 422, because picking a band and typing a
 * figure are contradictory instructions and guessing would show the buyer a
 * number they did not choose. Sending only `purchase_amount` is fine and moves
 * the plan to the custom band — typing a figure *is* choosing "enter my own".
 */
export async function updateSmartLivingPlan(
  planId: string,
  payload: SmartLivingPlanWriteRequest,
): Promise<SmartLivingPlan> {
  const response = await api.patch<SmartLivingPlan>(
    `/smart_living/plans/${planId}`,
    payload,
    { headers: planHeaders() },
  );
  return response.data;
}

/** The signed-in buyer's plan. 404 before any intake — an expected state, not
 *  an error worth surfacing as one. */
export async function fetchMySmartLivingPlan(): Promise<SmartLivingPlan> {
  const response = await api.get<SmartLivingPlan>('/smart_living/plans/me');
  return response.data;
}
