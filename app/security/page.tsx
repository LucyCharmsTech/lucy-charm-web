import type { Metadata } from 'next';
import { MfaEnrolment } from '@/components/security/MfaEnrolment';

/**
 * Account security — control 1.13 / C6's *"missing enrolment screen"*.
 *
 * A top-level route rather than a tab inside the profile, because a staff
 * account that has not enrolled cannot load the profile: every other
 * authenticated endpoint answers 403 until MFA is done. Putting the way out
 * behind the wall would have been a lockout.
 */
export const metadata: Metadata = {
  title: 'Account security',
  description: 'Manage two-step verification for your Lucy Charms account.',
  // Nothing under here should be indexed — `robots.ts` disallows it too; this
  // is the belt to that braces.
  robots: { index: false, follow: false },
};

export default function SecurityPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Account security
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Two-step verification protects your account if someone gets hold of
        your email or your Google sign-in.
      </p>
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <MfaEnrolment />
      </div>
    </main>
  );
}
