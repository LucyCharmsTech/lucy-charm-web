import {
  clearMfaEnrolmentReturnPath,
  consumeMfaEnrolmentReturnPath,
  rememberAgentOnboardingAfterMfa,
} from '@/lib/mfaEnrolmentReturnPath';

beforeEach(() => sessionStorage.clear());

test('only the fixed agent onboarding path is retained and consumed once', () => {
  rememberAgentOnboardingAfterMfa();

  expect(consumeMfaEnrolmentReturnPath()).toBe('/agent/onboarding');
  expect(consumeMfaEnrolmentReturnPath()).toBeNull();
});

test('an unexpected stored value is discarded instead of being used as a redirect', () => {
  sessionStorage.setItem('lucy-mfa-enrolment-return-path', 'https://example.test');

  expect(consumeMfaEnrolmentReturnPath()).toBeNull();
  clearMfaEnrolmentReturnPath();
});
