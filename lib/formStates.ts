/**
 * The five states every form must have — control 2.9.
 *
 *     "Validation, loading, success, duplicate and recoverable error states,
 *      preserving what was typed across a failure."
 *
 * Written once, for the same reason `PortalCard` defines the nine card states
 * once: five states re-implemented at sixteen call sites become five slightly
 * different vocabularies, and the two that carry real consequences —
 * **duplicate** and **preserving what was typed** — are the two most often
 * dropped.
 *
 * ### Why duplicate is its own state
 *
 * It is the only one of the five that is **not an error and not a success**.
 * Told "something went wrong", a person submits again and makes a second
 * duplicate. Told "we already have this", they stop. Same HTTP call, opposite
 * outcomes.
 *
 * It is also the state a form is most likely to get wrong by omission: a 409
 * falls through to the generic error branch, the message reads "could not
 * send", and nothing looks broken to whoever wrote it.
 *
 * ### Why "preserving what was typed" is a rule, not a nicety
 *
 * Control 2.10 calls the alternative **silent lead loss**. A person who has
 * written a paragraph about their property and sees it vanish on a 503 does
 * not retype it — they leave. So no state transition here clears input, and
 * there is a test asserting it.
 */

export const FORM_STATES = [
  'idle',
  'validating',
  'submitting',
  'success',
  'duplicate',
  'error',
] as const;

export type FormState = (typeof FORM_STATES)[number];

type ErrorLike = {
  response?: {
    status?: number;
    data?: { detail?: unknown };
  };
};

/**
 * Is this the server saying "we already have this"?
 *
 * 409 is the signal. Not a message match: wording changes, gets translated and
 * gets edited by whoever is tidying copy that week, and a state that depends
 * on a sentence staying the same will quietly stop working.
 */
export function isDuplicate(error: unknown): boolean {
  return (error as ErrorLike)?.response?.status === 409;
}

/**
 * Is retrying the same submission worth the person's time?
 *
 * The distinction matters because the two call for opposite words. A 503 means
 * "try again in a moment" — the input is fine and the server is not. A 422
 * means "this will fail identically forever until you change something", and
 * inviting a retry there wastes their time and teaches them the button does
 * not work.
 *
 * 429 counts as recoverable: it is explicitly a *later* problem.
 */
export function isRecoverable(error: unknown): boolean {
  const status = (error as ErrorLike)?.response?.status;
  // No response at all — a dropped connection, a timeout, an offline device.
  // Always worth retrying, and the most common failure on a phone.
  if (status === undefined) return true;
  if (status === 429) return true;
  return status >= 500;
}

/**
 * The server's own explanation, if it gave one.
 *
 * Preferred over a generic message because the server usually knows something
 * the browser does not — "that email is already in use", "this showing is no
 * longer available". Swallowing it and printing "Could not save changes"
 * leaves the person with no idea what to change.
 *
 * Falls back rather than returning an empty string: a blank error area is
 * indistinguishable from success.
 */
export function serverMessage(error: unknown, fallback: string): string {
  const detail = (error as ErrorLike)?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  // Some endpoints return `{detail: {code, message}}` — the MFA enrolment
  // gate and the inactive-account response both do.
  if (
    detail &&
    typeof detail === 'object' &&
    'message' in detail &&
    typeof (detail as { message: unknown }).message === 'string'
  ) {
    return (detail as { message: string }).message;
  }
  return fallback;
}
