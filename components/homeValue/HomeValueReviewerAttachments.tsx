'use client';

import { useEffect, useState } from 'react';

import { downloadDocumentFile, fetchDocuments, formatBytes, isStaffDocument } from '@/services/documentService';
import type { AppDocument } from '@/types/api';

/** Staff-only attachment list. Access remains behind the document service. */
export function HomeValueReviewerAttachments({ requestId }: { requestId: string }) {
  const [items, setItems] = useState<AppDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDocuments('home_value_request', requestId)
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => { if (active) setError('Attachments are unavailable.'); });
    return () => { active = false; };
  }, [requestId]);

  return (
    <section className="mt-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h4 className="text-sm font-semibold">Property attachments</h4>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Review only material you are authorized to use. Attachments are not sent to AI or published automatically.
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-400">{error}</p>}
      {items?.length === 0 && <p className="mt-2 text-xs text-zinc-500">No attachments.</p>}
      {items && items.length > 0 && <ul className="mt-2 space-y-2 text-xs">
        {items.map((document) => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-zinc-50 p-2 dark:bg-zinc-900">
          <span>
            {document.original_filename ?? document.category}
            {document.size_bytes ? ` · ${formatBytes(document.size_bytes)}` : ''}
            {isStaffDocument(document) ? ` · ${document.scan_status}` : ''}
          </span>
          <button type="button" className="font-semibold text-primarycolor-text" onClick={() => void downloadDocumentFile(document.id).catch(() => setError('This attachment cannot be downloaded yet.'))}>Download</button>
        </li>)}
      </ul>}
    </section>
  );
}
