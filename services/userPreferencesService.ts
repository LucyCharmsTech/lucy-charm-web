import { normalizeUserPropertyPreferences } from '@/lib/userPreferences';
import { fetchCurrentUserOnboarding } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';

export async function fetchStoredUserPreferences() {
  const accessToken = useAuthStore.getState().accessToken;
  if (!accessToken) return null;

  const onboarding = await fetchCurrentUserOnboarding();
  if (!onboarding.responses) return null;
  return normalizeUserPropertyPreferences(onboarding.responses);
}
