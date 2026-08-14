/**
 * The card is where the API's sharp edges meet the client: a `requested` row
 * has null file fields and must render anyway; the rejection reason the client
 * was promised must be visible; an approved document must not offer an upload;
 * and the rejected file stays reachable through history. See
 * .docs/document-centre.md.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import ClientDocumentCard from '@/components/documents/ClientDocumentCard';
import { fetchDocumentHistory } from '@/services/documentService';
import type { AppDocument } from '@/types/api';

jest.mock('@/services/documentService', () => ({
  ...jest.requireActual('@/services/documentService'),
  fetchDocumentHistory: jest.fn(),
  downloadDocumentFile: jest.fn(),
  mintPreviewUrl: jest.fn(),
  uploadDocument: jest.fn(),
  uploadDocumentRevision: jest.fn(),
}));

function doc(overrides: Partial<AppDocument> = {}): AppDocument {
  return {
    id: 'd1',
    resource_type: 'showing_request',
    resource_id: 's1',
    category: 'identity',
    description: null,
    original_filename: 'passport.pdf',
    content_type: 'application/pdf',
    size_bytes: 2048,
    status: 'uploaded',
    version: 1,
    supersedes_document_id: null,
    superseded_by_document_id: null,
    expires_at: null,
    due_date: null,
    reviewed_at: null,
    client_reason: null,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
    ...overrides,
  };
}

describe('a requested row — every file field is null', () => {
  const requested = doc({
    status: 'requested',
    original_filename: null,
    content_type: null,
    size_bytes: null,
    due_date: '2099-01-01T00:00:00Z',
  });

  it('renders without crashing, using the category as its title', () => {
    render(<ClientDocumentCard document={requested} />);
    expect(screen.getByText('ID document')).toBeTruthy();
    expect(screen.getByText('Not uploaded yet.')).toBeTruthy();
  });

  it('offers Upload but no Preview/Download — there is no file yet', () => {
    render(<ClientDocumentCard document={requested} />);
    expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
  });

  it('shows the preferred date as advisory copy', () => {
    render(<ClientDocumentCard document={requested} />);
    expect(screen.getByText(/Preferred by/)).toBeTruthy();
  });
});

describe('a rejected document — the client was promised the reason', () => {
  const rejected = doc({ status: 'rejected', client_reason: 'The photo is illegible.' });

  it('shows the reason and offers a replacement upload', () => {
    render(<ClientDocumentCard document={rejected} />);
    expect(screen.getByText('The photo is illegible.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload a new copy' })).toBeTruthy();
  });
});

describe('an approved document — no upload until staff act again', () => {
  it('hides the upload button on accepted', () => {
    render(<ClientDocumentCard document={doc({ status: 'accepted' })} />);
    expect(screen.queryByRole('button', { name: /Upload/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
  });

  it('offers upload again once the document has expired', () => {
    render(<ClientDocumentCard document={doc({ status: 'expired' })} />);
    expect(screen.getByRole('button', { name: 'Upload a new copy' })).toBeTruthy();
  });
});

describe('history — the rejected version stays reachable', () => {
  const withHistory = doc({ status: 'uploaded', version: 2, supersedes_document_id: 'd0' });

  it('toggles between "Show history" and "Close history" and loads the chain', async () => {
    (fetchDocumentHistory as jest.Mock).mockResolvedValue({
      versions: [
        doc({ id: 'd0', status: 'superseded', client_reason: 'Blurry.', version: 1 }),
        withHistory,
      ],
      audit: [],
    });

    render(<ClientDocumentCard document={withHistory} />);
    const toggle = screen.getByRole('button', { name: 'Show history' });
    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Close history' })).toBeTruthy();
    expect(await screen.findByText('Blurry.')).toBeTruthy();
    expect(fetchDocumentHistory).toHaveBeenCalledWith('d1');

    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(screen.getByRole('button', { name: 'Show history' })).toBeTruthy();
  });

  it('offers no history toggle on a version-1 document with no successor', () => {
    render(<ClientDocumentCard document={doc()} />);
    expect(screen.queryByRole('button', { name: 'Show history' })).toBeNull();
  });
});

describe('expiry date display', () => {
  it('shows "Valid until" when the document carries its own expiry', () => {
    render(<ClientDocumentCard document={doc({ expires_at: '2030-06-15T23:59:59Z' })} />);
    expect(screen.getByText(/Valid until/)).toBeTruthy();
  });
});
