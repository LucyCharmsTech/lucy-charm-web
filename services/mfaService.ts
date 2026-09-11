/**
 * Two-step verification — control 1.13 / C6.
 *
 * Wraps `/auth/mfa/*`. Split from `authService` because these are a different
 * job: `authService` is how anyone signs in, this is how a staff account is
 * protected, and the two have different readers.
 */

import api from '@/lib/axios';
import type {
  AuthToken,
  MfaRecoveryCodesResponse,
  MfaSetupResponse,
  MfaStatus,
} from '@/types/api';

// ── Enrolment ────────────────────────────────────────────────────────────────

/** Whether MFA is on, required, or locked. Safe to poll; carries no secret. */
export async function fetchMfaStatus(): Promise<MfaStatus> {
  const res = await api.get<MfaStatus>('/auth/mfa/status');
  return res.data;
}

/**
 * A fresh secret and `otpauth://` URI.
 *
 * Nothing is stored server-side until `enableMfa` succeeds, so abandoning the
 * screen at this point leaves the account exactly as it was rather than locked
 * behind a factor nobody scanned.
 */
export async function startMfaSetup(): Promise<MfaSetupResponse> {
  const res = await api.post<MfaSetupResponse>('/auth/mfa/setup');
  return res.data;
}

/**
 * Confirm the first code and turn MFA on.
 *
 * Returns the recovery codes — this response is the only moment they exist in
 * readable form anywhere, so the caller must show them before navigating away.
 */
export async function enableMfa(
  secret: string,
  otp: string,
): Promise<MfaRecoveryCodesResponse> {
  const res = await api.post<MfaRecoveryCodesResponse>('/auth/mfa/enable', {
    secret,
    otp,
  });
  return res.data;
}

// ── Sign-in challenge ────────────────────────────────────────────────────────

/** Exchange the challenge and a code from the authenticator app for a session. */
export async function verifyMfa(
  mfaChallengeToken: string,
  otp: string,
): Promise<AuthToken> {
  const res = await api.post<AuthToken>('/auth/mfa/verify', {
    mfa_challenge_token: mfaChallengeToken,
    otp,
  });
  return res.data;
}

/** The way in when the authenticator app is gone. Each code works once. */
export async function verifyMfaRecoveryCode(
  mfaChallengeToken: string,
  recoveryCode: string,
): Promise<AuthToken> {
  const res = await api.post<AuthToken>('/auth/mfa/verify-recovery', {
    mfa_challenge_token: mfaChallengeToken,
    recovery_code: recoveryCode,
  });
  return res.data;
}

// ── Recovery and revocation ──────────────────────────────────────────────────

/**
 * Issue a fresh set, invalidating the old one.
 *
 * Needs a live code, not merely a session: otherwise anyone with a borrowed
 * session could print themselves a permanent set of bypass credentials.
 */
export async function regenerateRecoveryCodes(
  otp: string,
): Promise<MfaRecoveryCodesResponse> {
  const res = await api.post<MfaRecoveryCodesResponse>(
    '/auth/mfa/recovery-codes',
    { otp },
  );
  return res.data;
}

/**
 * Turn MFA off on your own account. Signs every other session out.
 *
 * For a staff account this does **not** restore unrestricted access — the next
 * request lands back on the enrolment screen. It is for changing authenticator
 * app, not for opting out.
 */
export async function disableMfa(otp: string): Promise<void> {
  await api.post('/auth/mfa/disable', { otp });
}

/**
 * Superadmin: clear a colleague's MFA so they can enrol again.
 *
 * This exists so that "my phone was replaced and I lost my codes" has an
 * answer other than someone handing over their own credentials — which is the
 * practice C6's "never share privileged accounts" forbids.
 */
export async function resetMfaForUser(userId: string): Promise<void> {
  await api.post(`/auth/mfa/reset/${userId}`);
}
