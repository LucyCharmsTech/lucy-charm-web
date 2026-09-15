/**
 * Route a staff account that has not enrolled to the screen that fixes it.
 *
 * Control 1.13 / C6 blocks privileged access until MFA is set up. Server-side
 * that is a 403 on every authenticated route, which is correct and, on its
 * own, unusable: the person sees a generic "not permitted" on whatever page
 * they opened, with nothing telling them what to do or where to go.
 *
 * So the API tags that one 403 with `code: "mfa_enrolment_required"` and this
 * turns it into a redirect. Two different 403s that look identical lead to
 * completely different screens — "set this up" and "this isn't yours" — and
 * only the server can tell them apart.
 */

import type { AxiosError, AxiosInstance } from 'axios';
import { MFA_ENROLMENT_REQUIRED_CODE } from '@/types/api';

export const MFA_ENROLMENT_PATH = '/security';

type ForbiddenBody = {
  detail?: { code?: string } | string;
};

export function isMfaEnrolmentRequired(error: unknown): boolean {
  const response = (error as AxiosError<ForbiddenBody>)?.response;
  if (response?.status !== 403) return false;
  const detail = response.data?.detail;
  return (
    typeof detail === 'object' &&
    detail !== null &&
    detail.code === MFA_ENROLMENT_REQUIRED_CODE
  );
}

/**
 * How the redirect is performed. Injectable because `window.location` is
 * read-only in jsdom, so a test cannot observe the navigation otherwise, and
 * the behaviour worth pinning here is precisely what happens around it.
 */
export type EnrolmentNavigator = {
  currentPath: () => string;
  go: (path: string) => void;
};

const browserNavigator: EnrolmentNavigator = {
  currentPath: () => window.location.pathname,
  go: (path) => window.location.assign(path),
};

export function attachMfaEnrolmentInterceptor(
  api: AxiosInstance,
  navigator: EnrolmentNavigator = browserNavigator,
): void {
  api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        typeof window !== 'undefined' &&
        isMfaEnrolmentRequired(error) &&
        // Already there — redirecting again would reload the page under the
        // user mid-setup, and the setup screen's own calls are the ones most
        // likely to hit this.
        !navigator.currentPath().startsWith(MFA_ENROLMENT_PATH)
      ) {
        navigator.go(MFA_ENROLMENT_PATH);

        // Deliberately never settles, and this reverses an earlier decision.
        //
        // It used to reject here so the caller was not left waiting. What that
        // actually produced was a red error box: `window.location.assign` is
        // asynchronous, so the rejection reached the page's catch, the page set
        // an error, React painted it, and only then did the browser navigate.
        // An administrator signing in without MFA enrolled saw a failure flash
        // up before landing on the setup screen, which is what the client
        // reported.
        //
        // Sixteen pages under /admin and /agent load on mount and render an
        // error box on rejection, so fixing it in each catch would have missed
        // the seventeenth. Hanging here keeps whatever the page shows while
        // loading, which is the honest state: the request did not fail, it is
        // being replaced by a navigation that is already under way. The pending
        // promise dies with the document.
        return new Promise(() => {});
      }
      return Promise.reject(error);
    },
  );
}
