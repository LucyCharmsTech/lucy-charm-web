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
  if (effective === 'client' && onboardingCompleted === false) {
    return '/onboarding';
  }
  if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    // Only honour same-origin style paths; role-specific dashboards still win for internal roles
    if (effective === 'agent' && redirectParam.startsWith('/agent')) return redirectParam;
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
    case 'agent':
      return '/agent';
    case 'superadmin':
      return '/admin';
    default:
      return '/';
  }
}
