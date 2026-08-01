type NamedUser = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

/** Prefer stored profile name; fall back to email when no name is set. */
export function formatUserDisplayName(user: NamedUser | null | undefined): string {
  if (!user) return '';
  const parts = [user.first_name, user.last_name]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(' ');
  return user.email?.trim() ?? '';
}

/** Short label for compact UI (navbar button, avatar alt text). */
export function formatUserShortLabel(user: NamedUser | null | undefined): string {
  if (!user) return '';
  const first = user.first_name?.trim();
  if (first) return first;
  return user.email?.trim() ?? '';
}

/** Initials for avatar badges. */
export function formatUserInitials(user: NamedUser | null | undefined): string {
  if (!user) return '';
  const firstInitial = user.first_name?.trim().charAt(0) ?? '';
  const lastInitial = user.last_name?.trim().charAt(0) ?? '';
  const combined = `${firstInitial}${lastInitial}`.toUpperCase();
  if (combined) return combined;
  return user.email?.charAt(0).toUpperCase() ?? '';
}
