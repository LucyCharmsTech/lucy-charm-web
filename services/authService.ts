/**
 * Auth service — wraps the /auth endpoints.
 */

import api from '@/lib/axios';
import { requestTokenRefresh } from '@/lib/tokenRefresh';
import type {
  AuthToken,
  SignInResult,
  AccountRecoveryRequestBody,
  EmailCodeRequestBody,
  EmailCodeRequestResponse,
  EmailCodeVerifyBody,
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
): Promise<SignInResult> {
  const res = await api.post<SignInResult>('/auth/magic-link/verify', payload);
  return res.data;
}

export async function requestAccountRecovery(
  payload: AccountRecoveryRequestBody,
): Promise<MagicLinkRequestResponse> {
  const res = await api.post<MagicLinkRequestResponse>('/auth/account-recovery/request', payload);
  return res.data;
}

export async function verifyAccountRecovery(
  payload: MagicLinkVerifyBody,
): Promise<SignInResult> {
  const res = await api.post<SignInResult>('/auth/account-recovery/verify', payload);
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
  // Bare client — avoids the shared Axios 401 interceptor recursing on itself.
  return requestTokenRefresh(refreshToken);
}

// ---------------------------------------------------------------------------
// Google OAuth (ID token flow)
// ---------------------------------------------------------------------------

/**
 * Exchange a Google credential (ID token) for a Lucy Charms token pair.
 * The `idToken` is the `credential` field from Google Identity Services'
 * CredentialResponse (``google.accounts.id.initialize`` callback).
 */
export async function googleLogin(idToken: string): Promise<SignInResult> {
  const res = await api.post<SignInResult>('/auth/google', { id_token: idToken });
  return res.data;
}

// ── Email one-time code ──────────────────────────────────────────────────────

export async function requestEmailCode(
  payload: EmailCodeRequestBody,
): Promise<EmailCodeRequestResponse> {
  const res = await api.post<EmailCodeRequestResponse>(
    '/auth/email-code/request',
    payload,
  );
  return res.data;
}

export async function verifyEmailCode(
  payload: EmailCodeVerifyBody,
): Promise<SignInResult> {
  const res = await api.post<SignInResult>('/auth/email-code/verify', payload);
  return res.data;
}
