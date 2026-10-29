import { afterOnboardingDestination, rememberSellerReturn } from '@/lib/sellerReturn';

beforeEach(() => sessionStorage.clear());

test('seller sign-in survives required onboarding and is consumed once', () => {
  rememberSellerReturn();
  expect(afterOnboardingDestination()).toBe('/sell');
  expect(afterOnboardingDestination()).toBe('/');
});

test('unexpected stored paths cannot redirect onboarding elsewhere', () => {
  sessionStorage.setItem('lucy-seller-return-after-onboarding', '//untrusted.example');
  expect(afterOnboardingDestination()).toBe('/');
});
