'use client';

import Link from 'next/link';
import AccountRecoveryForm from '@/components/auth/AccountRecoveryForm';

export default function AccountRecoveryPage() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primarycolor/10">
            <span className="text-xl font-extrabold text-primarycolor-text">L</span>
          </div>
          <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
            Recover your account
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            We can restore a deactivated account or a recently soft-deleted account using the email on file.
          </p>
        </div>

        <AccountRecoveryForm />

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/login" className="font-semibold text-primarycolor-text hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
