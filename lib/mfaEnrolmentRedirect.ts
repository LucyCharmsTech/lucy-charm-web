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

export function attachMfaEnrolmentInterceptor(api: AxiosInstance): void {
  api.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (
        typeof window !== 'undefined' &&
        isMfaEnrolmentRequired(error) &&
        // Already there — redirecting again would reload the page under the
        // user mid-setup, and the setup screen's own calls are the ones most
        // likely to hit this.
        !window.location.pathname.startsWith(MFA_ENROLMENT_PATH)
      ) {
        window.location.assign(MFA_ENROLMENT_PATH);
      }
      // Rejected either way. Swallowing it would leave the calling component
      // waiting on a promise that never settles, showing a spinner behind the
      // navigation.
      return Promise.reject(error);
    },
  );
}
