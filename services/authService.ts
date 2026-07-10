/**
 * Auth service — wraps the /auth endpoints.
 */

import api from '@/lib/axios';
import type {
  AuthToken,
  MagicLinkRequestBody,
  MagicLinkRequestResponse,
  MagicLinkVerifyBody,
} from '@/types/api';

// ---------------------------------------------------------------------------
// Magic link (email-only passwordless auth)
// ---------------------------------------------------------------------------

export async function requestMagicLink(
  payload: MagicLinkRequestBody,
): Promise<MagicLinkRequestResponse> {
  const res = await api.post<MagicLinkRequestResponse>('/auth/magic-link/request', payload);
  return res.data;
}

export async function verifyMagicLink(
  payload: MagicLinkVerifyBody,
): Promise<AuthToken> {
  const res = await api.post<AuthToken>('/auth/magic-link/verify', payload);
  return res.data;
}

// ---------------------------------------------------------------------------
// Logout (requires access token in header + refresh_token in body)
// ---------------------------------------------------------------------------

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refresh_token: refreshToken });
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

export async function refreshAccessToken(
  refreshToken: string,
): Promise<AuthToken> {
  const res = await api.post<AuthToken>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Google OAuth (ID token flow)
// ---------------------------------------------------------------------------

/**
 * Exchange a Google credential (ID token) for a Lucy Charms token pair.
 * The `idToken` is the `credential` field from Google Identity Services'
 * CredentialResponse (``google.accounts.id.initialize`` callback).
 */
export async function googleLogin(idToken: string): Promise<AuthToken> {
  const res = await api.post<AuthToken>('/auth/google', { id_token: idToken });
  return res.data;
}
