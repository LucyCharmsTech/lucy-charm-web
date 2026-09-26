/**
 * A verified invitation may be diverted to the MFA-only security screen before
 * it can hydrate `/users/me`. Keep just the one safe, internal destination so
 * completing the required setup resumes the invitation flow.
 */
const RETURN_PATH_KEY = 'lucy-mfa-enrolment-return-path';
const AGENT_ONBOARDING_PATH = '/agent/onboarding';

export function rememberAgentOnboardingAfterMfa(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(RETURN_PATH_KEY, AGENT_ONBOARDING_PATH);
  }
}

export function consumeMfaEnrolmentReturnPath(): string | null {
  if (typeof window === 'undefined') return null;
  const path = window.sessionStorage.getItem(RETURN_PATH_KEY);
  window.sessionStorage.removeItem(RETURN_PATH_KEY);
  return path === AGENT_ONBOARDING_PATH ? path : null;
}

export function clearMfaEnrolmentReturnPath(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
  }
}
