'use client';

import { useRef, useState } from 'react';
import { FileUpIcon } from 'lucide-react';

import ShowingIdentityAwaitingMessage from '@/components/profile/ShowingIdentityAwaitingMessage';
import { uploadShowingIdentityDocument } from '@/services/showingService';
import type { ShowingRequest, ShowingVerificationDocument } from '@/types/api';

type ShowingIdentityUploadButtonProps = {
  request: ShowingRequest;
  onUploaded?: (document: ShowingVerificationDocument) => void;
  onError?: (message: string) => void;
  className?: string;
};

/** Show upload only when verification was requested, not verified, and no active file yet. */
export function canUploadShowingIdentity(request: ShowingRequest): boolean {
  if (!request.id_verification_requested && request.id_verification_status === 'not_requested') {
    return false;
  }
  if (request.id_verification_status === 'verified') return false;
  if (request.identity_document_uploaded) return false;
  return true;
}

export function isShowingIdentityAwaitingReview(request: ShowingRequest): boolean {
  return (
    request.identity_document_uploaded &&
    request.id_verification_status !== 'verified'
  );
}

export default function ShowingIdentityUploadButton({
  request,
  onUploaded,
  onError,
  className = '',
}: ShowingIdentityUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (isShowingIdentityAwaitingReview(request)) {
    return <ShowingIdentityAwaitingMessage className={className} />;
  }

  if (!canUploadShowingIdentity(request)) return null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const document = await uploadShowingIdentityDocument(request.id, file);
      onUploaded?.(document);
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Upload failed. Use a PDF, JPEG, or PNG under 10 MB.';
      onError?.(String(detail));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={`showing-id-upload-${request.id}`}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        className="sr-only"
        disabled={busy}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        aria-controls={`showing-id-upload-${request.id}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          inputRef.current?.click();
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primarycolor px-3 text-xs font-semibold text-white transition hover:bg-primarycolor/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primarycolor disabled:opacity-50"
      >
        <FileUpIcon className="size-3.5" aria-hidden="true" />
        {busy ? 'Uploading…' : 'Upload ID photo'}
      </button>
    </div>
  );
}
