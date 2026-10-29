const RETURN_KEY = 'lucy-seller-return-after-onboarding';

export function rememberSellerReturn(): void {
  try {
    sessionStorage.setItem(RETURN_KEY, '/sell');
  } catch {
    // The ordinary /login?redirect=/sell path still works without storage.
  }
}

export function afterOnboardingDestination(): string {
  try {
    if (sessionStorage.getItem(RETURN_KEY) === '/sell') {
      sessionStorage.removeItem(RETURN_KEY);
      return '/sell';
    }
  } catch {
    // Never trust or require browser storage for an authorization decision.
  }
  return '/';
}
