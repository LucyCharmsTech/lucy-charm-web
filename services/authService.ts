/**
 * Auth service — wraps the /auth endpoints.
 *
 * LOGIN uses OAuth2PasswordRequestForm, which means the body must be
 * application/x-www-form-urlencoded with fields `username` and `password`
 * (FastAPI maps `username` → email internally).
 */

import api from '@/lib/axios';
import type {
  AuthToken,
  SignupRequest,
  SignupResponse,
} from '@/types/api';

// ---------------------------------------------------------------------------
// Login (form-data, NOT JSON)
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<AuthToken> {
  const body = new URLSearchParams();
  body.set('username', email); // FastAPI OAuth2PasswordRequestForm uses `username`
  body.set('password', password);

  const res = await api.post<AuthToken>('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Register (JSON)
// ---------------------------------------------------------------------------

export async function register(
  payload: SignupRequest,
): Promise<SignupResponse> {
  const res = await api.post<SignupResponse>('/auth/signup', payload);
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
