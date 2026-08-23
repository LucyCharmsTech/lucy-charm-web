/**
 * The one thing that has to happen the moment a session starts.
 *
 * Both sign-in paths — magic link and Google — call `setAuth` and then redirect.
 * Anything that needs to run in between belongs here rather than being copied
 * into both, which is how the anonymous-saves claim went missing in the first
 * place.
 *
 * Deliberately never throws: a failed claim must not block a successful login.
 * The saves are not lost — the token stays in localStorage and the next sign-in
 * claims them.
 */
import { claimAnonymousSaves } from '@/services/savedListingsService';

export async function completeSignIn(): Promise<void> {
  try {
    await claimAnonymousSaves();
  } catch {
    // Non-fatal by design. See above.
  }
}
