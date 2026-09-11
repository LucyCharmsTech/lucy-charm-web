import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IdentityDocumentUpload } from '@/components/showings/IdentityDocumentUpload';
import { IdentityDocumentReview } from '@/components/showings/IdentityDocumentReview';
import {
  fetchIdentityDocuments,
  openIdentityDocument,
  reviewIdentityDocument,
  uploadIdentityDocument,
  validateIdFile,
} from '@/services/identityDocumentService';
import type { ShowingIdentityDocument } from '@/types/api';

/**
 * Showing identity documents — client upload and staff review.
 *
 * Our 1 September report: *"The system can accept, store and review a client's
 * identity document for a showing. There is no screen for a client to upload
 * one or for staff to review it."*
 *
 * Both surfaces existed as buttons pointing at the wrong thing: the client's
 * "Manage ID documents" went to `#documents` (the general document centre) and
 * staff's "Review documents" opened that same centre, which has no ID review.
 */

jest.mock('@/services/identityDocumentService', () => {
  const actual = jest.requireActual('@/services/identityDocumentService');
  return {
    ...actual,
    fetchIdentityDocuments: jest.fn(),
    uploadIdentityDocument: jest.fn(),
    reviewIdentityDocument: jest.fn(),
    openIdentityDocument: jest.fn(),
  };
});

const mockFetch = fetchIdentityDocuments as jest.MockedFunction<typeof fetchIdentityDocuments>;
const mockUpload = uploadIdentityDocument as jest.MockedFunction<typeof uploadIdentityDocument>;
const mockReview = reviewIdentityDocument as jest.MockedFunction<typeof reviewIdentityDocument>;
const mockOpen = openIdentityDocument as jest.MockedFunction<typeof openIdentityDocument>;

const SHOWING = 'showing-1';

function doc(over: Partial<ShowingIdentityDocument> = {}): ShowingIdentityDocument {
  return {
    id: 'd1',
    showing_request_id: SHOWING,
    original_filename: 'licence.pdf',
    content_type: 'application/pdf',
    size_bytes: 240_000,
    status: 'uploaded',
    reviewed_at: null,
    review_note: null,
    viewed_at: null,
    created_at: '2026-09-05T10:00:00Z',
    ...over,
  };
}

function file(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue([]);
  mockUpload.mockResolvedValue(doc());
  mockReview.mockImplementation(async (_s, _d, payload) =>
    doc({ status: payload.status, reviewed_at: '2026-09-05T11:00:00Z' }),
  );
  mockOpen.mockResolvedValue(undefined);
});

// ── Client upload ────────────────────────────────────────────────────────────

test('renders nothing at all unless the brokerage actually asked', () => {
  // An unprompted request for someone's ID should never appear on its own.
  const { container } = render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested={false}
      verificationStatus="not_requested"
    />,
  );

  expect(container.innerHTML).toBe('');
  expect(mockFetch).not.toHaveBeenCalled();
});

test('offers an upload when verification was requested', async () => {
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="not_requested"
    />,
  );

  await waitFor(() => expect(screen.getByText('Identity verification')).toBeTruthy());
  expect(screen.getByLabelText('Choose a document')).toBeTruthy();
  expect(screen.getByText(/PDF, JPEG or PNG, up to 10 MB/)).toBeTruthy();
});

test('uploads an accepted file', async () => {
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="not_requested"
    />,
  );
  await waitFor(() => expect(screen.getByLabelText('Choose a document')).toBeTruthy());

  fireEvent.change(screen.getByLabelText('Choose a document'), {
    target: { files: [file('licence.pdf', 'application/pdf', 240_000)] },
  });

  await waitFor(() => expect(mockUpload).toHaveBeenCalled());
  expect(mockUpload.mock.calls[0][0]).toBe(SHOWING);
});

test('a wrong file type is refused before it is sent', async () => {
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="not_requested"
    />,
  );
  await waitFor(() => expect(screen.getByLabelText('Choose a document')).toBeTruthy());

  fireEvent.change(screen.getByLabelText('Choose a document'), {
    target: { files: [file('sheet.xlsx', 'application/vnd.ms-excel', 1000)] },
  });

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('PDF, JPEG or PNG');
  expect(mockUpload).not.toHaveBeenCalled();
});

test('an oversized file is refused before it is sent', async () => {
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="not_requested"
    />,
  );
  await waitFor(() => expect(screen.getByLabelText('Choose a document')).toBeTruthy());

  fireEvent.change(screen.getByLabelText('Choose a document'), {
    target: { files: [file('big.pdf', 'application/pdf', 11 * 1024 * 1024)] },
  });

  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByRole('alert').textContent).toContain('larger than 10 MB');
  expect(mockUpload).not.toHaveBeenCalled();
});

test('an uploaded document shows as awaiting review, with no second upload', async () => {
  mockFetch.mockResolvedValue([doc()]);
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="pending"
    />,
  );

  await waitFor(() => expect(screen.getByText(/waiting for review/)).toBeTruthy());
  expect(screen.queryByLabelText('Choose a document')).toBeNull();
});

test('once verified the client is told nothing more is needed', async () => {
  mockFetch.mockResolvedValue([doc({ status: 'verified' })]);
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="verified"
    />,
  );

  await waitFor(() => expect(screen.getByText(/Nothing more is needed/)).toBeTruthy());
});

test('a rejected document invites another, and says so', async () => {
  mockFetch.mockResolvedValue([doc({ status: 'rejected' })]);
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="pending"
    />,
  );

  await waitFor(() => expect(screen.getByText(/was not accepted/)).toBeTruthy());
  expect(screen.getByLabelText('Choose a document')).toBeTruthy();
});

test('the client is told the document is private and that access is recorded', async () => {
  render(
    <IdentityDocumentUpload
      showingRequestId={SHOWING}
      verificationRequested
      verificationStatus="not_requested"
    />,
  );

  await waitFor(() => expect(screen.getByText(/Stored privately/)).toBeTruthy());
  expect(screen.getByText(/Every time it is opened is recorded/)).toBeTruthy();
});

// ── Staff review ─────────────────────────────────────────────────────────────

test('review lists the document without rendering it', async () => {
  // No thumbnail, no preview — an ID is never sitting on a staff screen.
  mockFetch.mockResolvedValue([doc()]);
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);

  await waitFor(() => expect(screen.getByText('licence.pdf')).toBeTruthy());
  expect(document.querySelector('img')).toBeNull();
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('button', { name: /Open/ })).toBeTruthy();
});

test('opening a document goes through the audited route', async () => {
  mockFetch.mockResolvedValue([doc()]);
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);
  await waitFor(() => expect(screen.getByText('licence.pdf')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: /Open/ }));

  await waitFor(() => expect(mockOpen).toHaveBeenCalledWith(SHOWING, 'd1'));
});

test('a previously opened document shows when it was opened', async () => {
  // So a reviewer knows the look is on the record.
  mockFetch.mockResolvedValue([doc({ viewed_at: '2026-09-05T12:00:00Z' })]);
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);

  await waitFor(() => expect(screen.getByText(/opened/)).toBeTruthy());
});

test('a document can be verified', async () => {
  mockFetch.mockResolvedValue([doc()]);
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);
  await waitFor(() => expect(screen.getByText('licence.pdf')).toBeTruthy());

  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

  await waitFor(() =>
    expect(mockReview).toHaveBeenCalledWith(SHOWING, 'd1', {
      status: 'verified',
      review_note: null,
    }),
  );
});

test('a rejection can carry a note explaining why', async () => {
  mockFetch.mockResolvedValue([doc()]);
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);
  await waitFor(() => expect(screen.getByText('licence.pdf')).toBeTruthy());

  fireEvent.change(screen.getByLabelText('Note (optional)'), {
    target: { value: 'Name does not match the request' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

  await waitFor(() =>
    expect(mockReview).toHaveBeenCalledWith(SHOWING, 'd1', {
      status: 'rejected',
      review_note: 'Name does not match the request',
    }),
  );
});

test('an already-reviewed document offers no decision buttons', async () => {
  mockFetch.mockResolvedValue([
    doc({ status: 'verified', reviewed_at: '2026-09-05T11:00:00Z' }),
  ]);
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);

  await waitFor(() => expect(screen.getByText('licence.pdf')).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
});

test('no ID uploaded says so plainly', async () => {
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);

  await waitFor(() => expect(screen.getByText('No ID uploaded yet.')).toBeTruthy());
});

test('a failed review load does not leave the panel hanging', async () => {
  mockFetch.mockRejectedValue(new Error('network'));
  render(<IdentityDocumentReview showingRequestId={SHOWING} />);

  await waitFor(() => expect(screen.getByText('No ID uploaded yet.')).toBeTruthy());
});

// ── The shared validator ─────────────────────────────────────────────────────

test('the validator mirrors the server exactly', () => {
  expect(validateIdFile(file('a.pdf', 'application/pdf', 100))).toBeNull();
  expect(validateIdFile(file('a.jpg', 'image/jpeg', 100))).toBeNull();
  expect(validateIdFile(file('a.png', 'image/png', 100))).toBeNull();
  expect(validateIdFile(file('a.gif', 'image/gif', 100))).toBe('type');
  expect(validateIdFile(file('a.pdf', 'application/pdf', 0))).toBe('empty');
  expect(validateIdFile(file('a.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toBe('size');
});
