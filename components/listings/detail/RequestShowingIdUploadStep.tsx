'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircleIcon } from 'lucide-react';

import ShowingIdentityUploadButton from '@/components/profile/ShowingIdentityUploadButton';
import { Button } from '@/components/ui/button';
import type { ShowingRequest } from '@/types/api';

type RequestShowingIdUploadStepProps = {
  request: ShowingRequest;
  isAuthenticated: boolean;
  onClose: () => void;
};

export default function RequestShowingIdUploadStep({
  request,
  isAuthenticated,
  onClose,
}: RequestShowingIdUploadStepProps) {
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wantsId = request.id_verification_requested;

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircleIcon className="size-12 text-emerald-500" aria-hidden="true" />
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Request sent!</h3>
      <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-300">
        Your showing request has been submitted. The agent will be in touch to confirm a date and
        time.
      </p>

      {wantsId && (
        <div className="mt-1 w-full max-w-sm rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-left dark:border-zinc-700 dark:bg-zinc-900/60">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Upload your ID</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            You opted into ID verification. Upload a PDF, JPEG, or PNG (max 10 MB) so your agent can
            review it.
          </p>

          {!isAuthenticated ? (
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
              Sign in, then upload from your profile under Showing schedule or Verification
              documents.
            </p>
          ) : uploaded ? (
            <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
              ID uploaded. Your agent will review it shortly.
            </p>
          ) : (
            <ShowingIdentityUploadButton
              className="mt-3"
              request={request}
              onUploaded={() => {
                setError(null);
                setUploaded(true);
              }}
              onError={(message) => setError(message)}
            />
          )}

          {error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          {isAuthenticated && !uploaded && (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              You can also upload later from{' '}
              <Link href="/profile" className="font-semibold text-primarycolor underline-offset-2 hover:underline">
                your profile
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <Button type="button" variant="outline" onClick={onClose} className="mt-2 rounded-full">
        {wantsId && isAuthenticated && !uploaded ? 'Skip for now' : 'Close'}
      </Button>
    </div>
  );
}
