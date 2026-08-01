/**
 * Current user profile — wraps GET /users/me (requires Bearer token).
 */

import api from '@/lib/axios';
import type {
  UserDataRequestType,
  UserMe,
  UserOnboardingRead,
  UserOnboardingSubmitRequest,
  UserPrivacyPreferences,
} from '@/types/api';

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

export async function fetchPrivacyPreferences(): Promise<UserPrivacyPreferences> {
  const res = await api.get<UserPrivacyPreferences>('/users/me/privacy');
  return res.data;
}

export async function updatePrivacyPreferences(
  payload: Partial<UserPrivacyPreferences>,
): Promise<UserPrivacyPreferences> {
  const res = await api.patch<UserPrivacyPreferences>('/users/me/privacy', payload);
  return res.data;
}

export async function exportCurrentUserData(): Promise<Record<string, unknown>> {
  const res = await api.get<Record<string, unknown>>('/users/me/export');
  return res.data;
}

export async function submitDataRequest(payload: {
  request_type: UserDataRequestType;
  notes?: string;
}): Promise<{ detail: string; request_type: string; submitted_at: string }> {
  const res = await api.post<{ detail: string; request_type: string; submitted_at: string }>(
    '/users/me/data-request',
    payload,
  );
  return res.data;
}

export async function deactivateCurrentAccount(): Promise<{ detail: string; deactivated_at: string }> {
  const res = await api.post<{ detail: string; deactivated_at: string }>('/users/me/deactivate');
  return res.data;
}

export async function deleteCurrentAccount(): Promise<{ detail: string; deleted_at: string }> {
  const res = await api.delete<{ detail: string; deleted_at: string }>('/users/me');
  return res.data;
}
