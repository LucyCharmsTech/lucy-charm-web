'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AccountRecoveryForm from '@/components/auth/AccountRecoveryForm';

function AccountStatusContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const recoverable = searchParams.get('recoverable') === '1';
  const email = searchParams.get('email') ?? '';
  const isDeleted = status === 'deleted';

  const title = isDeleted
    ? recoverable
      ? 'Your account has been deleted'
      : 'Your account can no longer be recovered'
    : 'Your account has been deactivated';
  const description = isDeleted
    ? recoverable
      ? 'You can recover your account within the recovery window. We will send a secure link to the email address on file.'
      : 'This account was deleted more than the recovery window ago. Please contact support if you need help with your data.'
    : 'You can recover your account by verifying the email address associated with it.';

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#fef6f9] px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-primarycolor/10">
            <span className="text-xl font-extrabold text-primarycolor">L</span>
          </div>
          <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>

        {(!isDeleted || recoverable) && <AccountRecoveryForm initialEmail={email} />}

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/login" className="font-semibold text-primarycolor hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AccountStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-80px)] bg-[#fef6f9] dark:bg-zinc-950" />}>
      <AccountStatusContent />
    </Suspense>
  );
}
