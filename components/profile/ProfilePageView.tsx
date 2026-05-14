'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import ProfileAccountForm from '@/components/profile/ProfileAccountForm';
import SavedListingsSection from '@/components/saved/SavedListingsSection';
import { Button } from '@/components/ui/button';
import { fetchCurrentUser } from '@/services/userService';
import { useAuthStore } from '@/stores/authStore';
import type { UserMe } from '@/types/api';
import { userMeToAuthUser } from '@/types/api';

export default function ProfilePageView() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [me, setMe] = useState<UserMe | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const savedAnchorRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    if (!accessToken) return;
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const data = await fetchCurrentUser();
      setMe(data);
      updateUser(userMeToAuthUser(data));
    } catch {
      setProfileError('Could not load your profile.');
    } finally {
      setLoadingProfile(false);
    }
  }, [accessToken, updateUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#saved-homes') return;
    const t = window.setTimeout(() => {
      savedAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => window.clearTimeout(t);
  }, [loadingProfile, accessToken]);

  const handleProfileUpdated = useCallback(
    (updated: UserMe) => {
      setMe(updated);
      updateUser(userMeToAuthUser(updated));
    },
    [updateUser],
  );

  return (
    <div className="min-h-screen bg-[#fef6f9] dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <Link
            href="/listings"
            className="text-sm font-semibold text-primarycolor hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor"
          >
            ← Back to listings
          </Link>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Profile
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your account and review homes you have saved.
          </p>
        </div>

        {!accessToken && (
          <div className="mb-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1 ring-zinc-900/5 dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:ring-white/10">
            <div className="border-b border-zinc-100 bg-linear-to-r from-primarycolor/8 via-[#fef6f9]/60 to-transparent px-5 py-4 dark:border-zinc-800 dark:from-primarycolor/15 dark:via-zinc-900/80 dark:to-transparent">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primarycolor/10 text-base font-extrabold text-primarycolor">
                  L
                </span>
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Sign in for the full profile</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Edit your name and email on file. You can still save homes on this device without
                    an account — they appear in <span className="font-medium text-zinc-800 dark:text-zinc-200">Saved homes</span>{' '}
                    below.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
              <Button
                asChild
                size="sm"
                className="rounded-xl bg-primarycolor font-semibold text-white hover:bg-primarycolor/90 focus-visible:ring-primarycolor"
              >
                <Link href="/login?redirect=%2Fprofile">Sign in</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-xl border-primarycolor/25 font-semibold">
                <Link href="/register">Create an account</Link>
              </Button>
            </div>
          </div>
        )}

        {accessToken && (
          <section
            className="mb-10 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
            aria-labelledby="account-heading"
          >
            <h2 id="account-heading" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Account details
            </h2>
            {loadingProfile && (
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading profile…</p>
            )}
            {profileError && !loadingProfile && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
                {profileError}
              </p>
            )}
            {!loadingProfile && me && !profileError && (
              <div className="mt-6">
                <ProfileAccountForm
                  key={me.updated_at}
                  email={me.email}
                  initialFirstName={me.first_name}
                  initialLastName={me.last_name}
                  onUpdated={handleProfileUpdated}
                />
              </div>
            )}
          </section>
        )}

        <section
          id="saved-homes"
          ref={savedAnchorRef}
          className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40"
          aria-labelledby="saved-homes-heading"
        >
          <span id="saved-homes-heading" className="sr-only">
            Saved homes
          </span>
          <SavedListingsSection />
        </section>
      </div>
    </div>
  );
}
