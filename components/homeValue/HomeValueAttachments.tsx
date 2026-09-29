'use client';

import { useEffect, useState } from 'react';

import ClientDocumentCard from '@/components/documents/ClientDocumentCard';
import DocumentUploadButton from '@/components/documents/DocumentUploadButton';
import { deleteDocument, fetchDocuments } from '@/services/documentService';
import type { AppDocument } from '@/types/api';

/** Optional property material attached to an existing Home Value request. */
export function HomeValueAttachments({ requestId }: { requestId: string }) {
  const [documents, setDocuments] = useState<AppDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    fetchDocuments('home_value_request', requestId)
      .then(setDocuments)
      .catch(() => setError('Attachments could not be loaded.'));
  };

  useEffect(() => { reload(); }, [requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Optional property photos and documents
      </h4>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Add photos or supporting property documents if they help the reviewer.
        Do not upload identification or financial documents here.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <DocumentUploadButton
          target={{ kind: 'new', resourceType: 'home_value_request', resourceId: requestId, category: 'property_photo' }}
          label="Add property photo"
          onUploaded={reload}
          onError={setError}
        />
        <DocumentUploadButton
          target={{ kind: 'new', resourceType: 'home_value_request', resourceId: requestId, category: 'supporting_property_document' }}
          label="Add supporting document"
          onUploaded={reload}
          onError={setError}
        />
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">{error}</p>}
      {documents && documents.length > 0 && (
        <div className="mt-3 space-y-2">
          {documents.map((document) => (
            <div key={document.id}>
              <ClientDocumentCard
                document={document}
                onChanged={reload}
                onError={(message) => setError(message)}
              />
              <button
                type="button"
                className="mt-1 text-xs font-medium text-red-700 dark:text-red-400"
                onClick={() => void deleteDocument(document.id)
                  .then(reload)
                  .catch(() => setError('This attachment cannot be removed.'))}
              >
                Remove attachment
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
