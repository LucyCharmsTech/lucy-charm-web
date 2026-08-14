/**
 * The documentService helpers encode product decisions that a refactor could
 * quietly undo: the client-side mirror of the server's upload rules, the
 * error-copy rules (404 never says "permission", scan blocks get friendly
 * copy, 422 details are shown verbatim), the advisory-only due date, and the
 * deliberately narrower upload CTA. See .docs/document-centre.md.
 */

import {
  ACCEPTS_UPLOAD,
  DOCUMENT_MAX_BYTES,
  DocumentError,
  documentErrorMessage,
  formatBytes,
  isDocumentOverdue,
  isHistoryDocument,
  isStaffDocument,
  preflightDocumentFile,
  SHOWS_UPLOAD_CTA,
  sortDocumentsForClient,
} from '@/services/documentService';
import type { AppDocument, DocumentStatus } from '@/types/api';

function doc(overrides: Partial<AppDocument> = {}): AppDocument {
  return {
    id: 'd1',
    resource_type: 'showing_request',
    resource_id: 's1',
    category: 'identity',
    description: null,
    original_filename: 'passport.pdf',
    content_type: 'application/pdf',
    size_bytes: 1234,
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

function file(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('preflightDocumentFile — mirrors the server, server stays authority', () => {
  it('accepts each allowed type with a matching extension', () => {
    expect(preflightDocumentFile(file('id.pdf', 'application/pdf', 1024))).toBeNull();
    expect(preflightDocumentFile(file('id.jpg', 'image/jpeg', 1024))).toBeNull();
    expect(preflightDocumentFile(file('id.jpeg', 'image/jpeg', 1024))).toBeNull();
    expect(preflightDocumentFile(file('id.png', 'image/png', 1024))).toBeNull();
    expect(preflightDocumentFile(file('id.webp', 'image/webp', 1024))).toBeNull();
  });

  it('refuses an empty file', () => {
    expect(preflightDocumentFile(file('id.pdf', 'application/pdf', 0))).toMatch(/empty/i);
  });

  it('refuses a file over the 10 MB cap, naming both sizes', () => {
    const problem = preflightDocumentFile(
      file('id.pdf', 'application/pdf', DOCUMENT_MAX_BYTES + 1),
    );
    expect(problem).toMatch(/10 MB/);
  });

  it('accepts a file exactly at the cap', () => {
    expect(
      preflightDocumentFile(file('id.pdf', 'application/pdf', DOCUMENT_MAX_BYTES)),
    ).toBeNull();
  });

  it('refuses GIF — the listing-image allowlist must not leak into documents', () => {
    expect(preflightDocumentFile(file('id.gif', 'image/gif', 1024))).toMatch(
      /PDF, JPEG, PNG, or WebP/,
    );
  });

  it('refuses an extension that contradicts the declared type', () => {
    expect(preflightDocumentFile(file('id.png', 'application/pdf', 1024))).toMatch(/\.png/);
  });
});

describe('documentErrorMessage — copy rules', () => {
  it('renders 404 as "not available", never mentioning permission', () => {
    const message = documentErrorMessage(
      new DocumentError(404, 'document 123 not found.', 'not_found'),
    );
    expect(message).toBe("This document isn't available.");
    expect(message.toLowerCase()).not.toContain('permission');
  });

  it('gives a scan-blocked 403 friendly copy instead of the raw detail', () => {
    const message = documentErrorMessage(
      new DocumentError(403, 'Refused: file failed the malware scan.', 'forbidden'),
    );
    expect(message).toMatch(/security scan/i);
  });

  it('passes a non-scan 403 detail through untouched', () => {
    const message = documentErrorMessage(
      new DocumentError(403, 'This action is staff-only.', 'forbidden'),
    );
    expect(message).toBe('This action is staff-only.');
  });

  it('surfaces validation details verbatim — they are written for the end user', () => {
    const detail =
      'File contents do not match the declared type (image/png). The file appears to be application/pdf.';
    expect(
      documentErrorMessage(new DocumentError(422, detail, 'invalid_file')),
    ).toBe(detail);
  });

  it('explains a retention purge (410)', () => {
    expect(
      documentErrorMessage(new DocumentError(410, 'gone', 'gone')),
    ).toMatch(/retention policy/i);
  });
});

describe('isDocumentOverdue — due_date is advisory', () => {
  it('is overdue only while still requested with a past due date', () => {
    expect(
      isDocumentOverdue(doc({ status: 'requested', due_date: '2020-01-01T00:00:00Z' })),
    ).toBe(true);
  });

  it('never flags an uploaded document, whatever the date says', () => {
    expect(
      isDocumentOverdue(doc({ status: 'uploaded', due_date: '2020-01-01T00:00:00Z' })),
    ).toBe(false);
  });

  it('never flags a request without a due date', () => {
    expect(isDocumentOverdue(doc({ status: 'requested', due_date: null }))).toBe(false);
  });
});

describe('upload affordance lists', () => {
  it('the UI CTA is exactly the API list minus accepted', () => {
    expect(ACCEPTS_UPLOAD).toContain('accepted');
    expect(SHOWS_UPLOAD_CTA).not.toContain('accepted');
    expect([...SHOWS_UPLOAD_CTA].sort()).toEqual(
      ACCEPTS_UPLOAD.filter((status) => status !== 'accepted').sort(),
    );
  });

  it('superseded is history: no upload anywhere, excluded from main lists', () => {
    expect(ACCEPTS_UPLOAD).not.toContain('superseded' as DocumentStatus);
    expect(SHOWS_UPLOAD_CTA).not.toContain('superseded' as DocumentStatus);
    expect(isHistoryDocument(doc({ status: 'superseded' }))).toBe(true);
    expect(isHistoryDocument(doc({ status: 'rejected' }))).toBe(false);
  });
});

describe('isStaffDocument — probe the shape, not the role', () => {
  it('detects the staff shape by its staff-only key', () => {
    expect(isStaffDocument(doc())).toBe(false);
    expect(
      isStaffDocument({ ...doc(), review_note: null } as AppDocument),
    ).toBe(true);
  });
});

describe('sortDocumentsForClient', () => {
  it('puts documents needing the client first, newest first within a group', () => {
    const approvedNew = doc({ id: 'a', status: 'accepted', created_at: '2026-08-03T00:00:00Z' });
    const rejectedOld = doc({ id: 'b', status: 'rejected', created_at: '2026-08-01T00:00:00Z' });
    const requestedNew = doc({ id: 'c', status: 'requested', created_at: '2026-08-02T00:00:00Z' });
    const sorted = sortDocumentsForClient([approvedNew, rejectedOld, requestedNew]);
    expect(sorted.map((d) => d.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('formatBytes', () => {
  it('picks a sensible unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(10 * 1024)).toBe('10 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});
