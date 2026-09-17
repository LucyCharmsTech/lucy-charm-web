/**
 * Turn a fresh token pair into a usable signed-in session.
 *
 * This dance was already written twice — once in `EmailCodeAuthForm`, once in
 * `GoogleLoginButton` — and adding the MFA challenge would have made it four
 * copies. It is subtle enough to be worth having once:
 *
 *   1. `setAuth` with a **placeholder** user, because the Axios request
 *      interceptor reads the token out of the store, and `fetchCurrentUser`
 *      cannot send an Authorization header until it is there.
 *   2. Fetch the real account.
 *   3. `setAuth` again with it.
 *
 * Step 1 is the non-obvious one. Skipping it produces an anonymous
 * `GET /users/me` and a sign-in that silently fails at the last step.
 */

import { completeSignIn } from '@/lib/completeSignIn';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import {
  userMeToAuthUser,
  type AuthToken,
  type AuthUser,
  type UserMe,
} from '@/types/api';

type SetAuth = (
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
) => void;

export async function seatSession(
  tokens: AuthToken,
  setAuth: SetAuth,
): Promise<UserMe> {
  // Seat the credential only. `fetchCurrentUser` needs it on the request, but
  // there is no user to store yet and inventing one is worse than storing none.
  //
  // This used to write a placeholder — `role: 'client'`, empty email — before
  // the fetch. When the fetch failed, that placeholder stayed: a staff account
  // that has not enrolled in two-step verification gets 403 from every
  // authenticated route including this one, so it was left signed in as a
  // nameless client, and the sign-in form reported "that code is not valid"
  // for a code that had been perfectly valid.
  useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

  const me = await fetchCurrentUser();
  setAuth(tokens.access_token, tokens.refresh_token, userMeToAuthUser(me));

  // Claiming anonymous saves must not be able to fail a sign-in — see
  // `completeSignIn`, which swallows its own errors for that reason.
  await completeSignIn();
  return me;
}
