/**
 * Where to send a user immediately after login / register,
 * based on their server-side role (`GET /users/me`).
 */

import type { UserRole } from '@/types/api';

export function getPostLoginPath(
  role: UserRole | undefined,
  redirectParam: string | null | undefined,
  onboardingCompleted?: boolean,
): string {
  const effective: UserRole = role ?? 'client';
  if (effective === 'agent') {
    // `/agent/onboarding` is only for an invited agent completing activation.
    // A stale login redirect to it must not override the active agent dashboard.
    if (
      redirectParam &&
      redirectParam.startsWith('/agent') &&
      !redirectParam.startsWith('/agent/onboarding') &&
      !redirectParam.startsWith('//')
    ) {
      return redirectParam;
    }
    return '/agent';
  }
  if (effective === 'client' && onboardingCompleted === false) {
    return '/onboarding';
  }
  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    // Only honour same-origin style paths; role-specific dashboards still win for internal roles
    if (effective === 'superadmin' && redirectParam.startsWith('/admin')) return redirectParam;
    if (
      effective === 'client' &&
      !redirectParam.startsWith('/agent') &&
      !redirectParam.startsWith('/admin')
    ) {
      return redirectParam;
    }
  }
  switch (effective) {
    case 'superadmin':
      return '/admin';
    default:
      return '/';
  }
}
