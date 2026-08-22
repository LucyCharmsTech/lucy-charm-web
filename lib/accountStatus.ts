import type { InactiveAccountDetails } from '@/types/api';

export function getInactiveAccountDetails(err: unknown): InactiveAccountDetails | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (!detail || typeof detail !== 'object' || !('code' in detail)) return null;
  const value = detail as Partial<InactiveAccountDetails>;
  if (
    value.code !== 'ACCOUNT_INACTIVE' ||
    (value.status !== 'deleted' && value.status !== 'deactivated') ||
    typeof value.recoverable !== 'boolean' ||
    typeof value.message !== 'string'
  ) {
    return null;
  }
  return value as InactiveAccountDetails;
}

export function getAccountStatusPath(
  details: InactiveAccountDetails,
  email?: string,
): string {
  const params = new URLSearchParams({
    status: details.status,
    recoverable: details.recoverable ? '1' : '0',
  });
  if (email) params.set('email', email);
  return `/account-status?${params.toString()}`;
}
