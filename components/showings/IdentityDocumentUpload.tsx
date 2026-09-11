'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2Icon, FileTextIcon, LoaderIcon, UploadIcon } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/apiErrorMessage';
import {
  ACCEPTED_ID_EXTENSIONS,
  ID_UPLOAD_PROBLEM_MESSAGES,
  fetchIdentityDocuments,
  uploadIdentityDocument,
  validateIdFile,
} from '@/services/identityDocumentService';
import type { ShowingIdentityDocument } from '@/types/api';
import { PrivacyLink } from '@/components/common/PrivacyLink';

/**
 * Client upload of an identity document for a showing.
 *
 * Only rendered when the brokerage has actually asked
 * (`id_verification_requested`), because an unprompted request for someone's ID
 * is exactly the kind of thing that should never appear on its own.
 *
 * The buyer sees the *state* of their document — uploaded, verified, rejected —
 * and never the file back. There is no preview here: re-rendering an ID on a
 * page the client might have open in public adds risk and answers no question
 * they have.
 */

type IdentityDocumentUploadProps = {
  showingRequestId: string;
  /** From the showing. Nothing renders unless this is true. */
  verificationRequested: boolean;
  verificationStatus: string;
  onUploaded?: () => void;
};

const STATUS_COPY: Record<string, string> = {
  uploaded: 'Uploaded — waiting for review',
  verified: 'Verified',
  rejected: 'Not accepted — please upload another',
};

export function IdentityDocumentUpload({
  showingRequestId,
  verificationRequested,
  verificationStatus,
  onUploaded,
}: IdentityDocumentUploadProps) {
  const [documents, setDocuments] = useState<ShowingIdentityDocument[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!verificationRequested) return;
    let active = true;
    fetchIdentityDocuments(showingRequestId)
      .then((rows) => {
        if (active) setDocuments(rows);
      })
      .catch(() => {
        // A failed read must not block uploading — the buyer's task is to
        // send a document, not to read a list.
        if (active) setDocuments([]);
      });
    return () => {
      active = false;
    };
  }, [showingRequestId, verificationRequested, reloadKey]);

  if (!verificationRequested) return null;

  // The server allows one active document at a time; once verified there is
  // nothing left to do.
  const active = documents?.find((d) => d.status !== 'rejected') ?? null;
  const isVerified = verificationStatus === 'verified' || active?.status === 'verified';

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    const problem = validateIdFile(file);
    if (problem) {
      setError(ID_UPLOAD_PROBLEM_MESSAGES[problem]);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      await uploadIdentityDocument(showingRequestId, file);
      setReloadKey((k) => k + 1);
      onUploaded?.();
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, 'Could not upload that document. Please try again.'),
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section
      className="mt-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
      aria-label="Identity verification"
    >
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Identity verification
      </h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        The brokerage has asked for photo ID before this showing. A PDF, JPEG or
        PNG, up to 10 MB.
      </p>

      {isVerified ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4" aria-hidden="true" />
          Your ID has been verified. Nothing more is needed.
        </p>
      ) : (
        <>
          {active && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              <FileTextIcon className="size-3.5" aria-hidden="true" />
              {active.original_filename} — {STATUS_COPY[active.status] ?? active.status}
            </p>
          )}

          {!active && (
            <div className="mt-3">
              <label
                htmlFor={`id-upload-${showingRequestId}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primarycolor px-4 py-2 text-sm font-semibold text-primarycolor-foreground hover:bg-primarycolor/90"
              >
                {uploading ? (
                  <>
                    <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <UploadIcon className="size-4" aria-hidden="true" />
                    Choose a document
                  </>
                )}
              </label>
              <input
                ref={inputRef}
                id={`id-upload-${showingRequestId}`}
                type="file"
                accept={ACCEPTED_ID_EXTENSIONS}
                onChange={(e) => void handleFile(e)}
                disabled={uploading}
                className="sr-only"
              />
            </div>
          )}

          {documents?.some((d) => d.status === 'rejected') && !active && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              A previous document was not accepted. Please upload another.
            </p>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        Stored privately and visible only to the representative handling this
        showing. Every time it is opened is recorded.
        <PrivacyLink />
      </p>
    </section>
  );
}
