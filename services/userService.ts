/**
 * Current user profile — wraps GET /users/me (requires Bearer token).
 */

import api from '@/lib/axios';
import type { UserMe, UserOnboardingRead, UserOnboardingSubmitRequest } from '@/types/api';

export async function fetchCurrentUser(): Promise<UserMe> {
  const res = await api.get<UserMe>('/users/me');
  return res.data;
}

export type UserProfilePatch = {
  first_name?: string;
  last_name?: string;
};

/** PATCH /users/me — requires Bearer token. */
export async function updateCurrentUser(payload: UserProfilePatch): Promise<UserMe> {
  const res = await api.patch<UserMe>('/users/me', payload);
  return res.data;
}

/** GET /users/me/onboarding — requires Bearer token. */
export async function fetchCurrentUserOnboarding(): Promise<UserOnboardingRead> {
  const res = await api.get<UserOnboardingRead>('/users/me/onboarding');
  return res.data;
}

/** PUT /users/me/onboarding — write-once onboarding profile. */
export async function submitCurrentUserOnboarding(
  payload: UserOnboardingSubmitRequest,
): Promise<UserOnboardingRead> {
  const res = await api.put<UserOnboardingRead>('/users/me/onboarding', payload);
  return res.data;
}
