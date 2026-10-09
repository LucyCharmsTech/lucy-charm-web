import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AgentWorkView from '@/components/agent/AgentWorkView';
import AdminWorkPage from '@/app/admin/work/page';
import DocumentDetailPage from '@/app/documents/[id]/page';
import { HomeValueReviewerAttachments } from '@/components/homeValue/HomeValueReviewerAttachments';
import { fetchMyWorkPage } from '@/services/workItemService';
import { fetchAgentsAdmin } from '@/services/superadminService';
import { fetchDocument, fetchDocuments, reviewDocument } from '@/services/documentService';
import type { StaffDocument } from '@/types/api';

jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'doc-1' }) }));
jest.mock('@/services/workItemService', () => ({
  fetchMyWorkPage: jest.fn(), fetchWorkItemHistoryPage: jest.fn(), updateWorkItem: jest.fn(),
}));
jest.mock('@/services/superadminService', () => ({ fetchAgentsAdmin: jest.fn() }));
jest.mock('@/services/documentService', () => ({
  ...jest.requireActual('@/services/documentService'),
  fetchDocument: jest.fn(), fetchDocuments: jest.fn(), reviewDocument: jest.fn(), downloadDocumentFile: jest.fn(),
}));
jest.mock('@/components/documents/DocumentHistoryList', () => function MockDocumentHistoryList() { return <div>Document history</div>; });
jest.mock('@/components/documents/DocumentPreviewDialog', () => function MockDocumentPreviewDialog({ onReady, onPreviewError }: { onReady?: () => void; onPreviewError?: () => void }) {
  return <div>Document preview<button onClick={onReady}>Preview ready</button><button onClick={onPreviewError}>Preview failed</button></div>;
});
jest.mock('@/components/documents/ClientDocumentCard', () => function MockClientDocumentCard() { return <div>Client document</div>; });

const work = {
  id: 'work-1', source_type: 'document', source_id: 'doc-1', queue: 'documents',
  title: 'Document ready for review', priority: 'normal' as const, status: 'open' as const,
  owner_user_id: 'agent-1', due_at: null, first_meaningful_action_at: null,
  follow_up_at: null, is_overdue: false, created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};
const staffDocument: StaffDocument = {
  id: 'doc-1', resource_type: 'home_value_request', resource_id: 'request-1',
  category: 'property_photo', description: null, original_filename: 'front.png',
  content_type: 'image/png', size_bytes: 123, status: 'uploaded', version: 1,
  supersedes_document_id: null, superseded_by_document_id: null, expires_at: null,
  due_date: null, reviewed_at: null, client_reason: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  owner_user_id: 'homeowner-1', uploaded_by_user_id: 'homeowner-1',
  visibility: 'client_visible', checksum_sha256: null, scan_status: 'clean',
  review_note: null, reviewed_by_user_id: null, retention_expires_at: null,
  purged_at: null, deleted_at: null, storage_key: null,
};

beforeEach(() => {
  sessionStorage.clear();
  (fetchMyWorkPage as jest.Mock).mockResolvedValue({ page: 1, page_size: 25, total: 1, items: [work] });
  (fetchAgentsAdmin as jest.Mock).mockResolvedValue([]);
  (fetchDocument as jest.Mock).mockResolvedValue(staffDocument);
  (fetchDocuments as jest.Mock).mockResolvedValue([staffDocument]);
  (reviewDocument as jest.Mock).mockResolvedValue({ ...staffDocument, status: 'accepted' });
});

it('opens the exact document from Agent My Work', async () => {
  render(<AgentWorkView />);
  expect((await screen.findByRole('link', { name: 'Open context' })).getAttribute('href')).toBe('/documents/doc-1');
});

it('opens the exact document from Admin Daily Work', async () => {
  render(<AdminWorkPage />);
  expect((await screen.findByRole('link', { name: 'Open context' })).getAttribute('href')).toBe('/documents/doc-1');
});

it('shows an authorized staff document and submits its real review action', async () => {
  render(<DocumentDetailPage />);
  expect(await screen.findByText('Review document')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Submit review' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  expect((screen.getByRole('button', { name: 'Submit review' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Preview ready' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));
  await waitFor(() => expect(reviewDocument).toHaveBeenCalledWith('doc-1', {
    outcome: 'accepted', client_reason: null, review_note: null,
  }));
});

it('a failed preview cannot unlock review, but a successful retry can', async () => {
  render(<DocumentDetailPage />);
  await screen.findByText('Review document');
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview failed' }));
  expect((screen.getByRole('button', { name: 'Submit review' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Preview ready' }));
  expect((screen.getByRole('button', { name: 'Submit review' }) as HTMLButtonElement).disabled).toBe(false);
});

it('opens the same review surface from the Home Value reviewer attachments', async () => {
  render(<HomeValueReviewerAttachments requestId="request-1" />);
  expect((await screen.findByRole('link', { name: 'Open review' })).getAttribute('href')).toBe('/documents/doc-1');
  expect(fetchDocuments).toHaveBeenCalledWith('home_value_request', 'request-1');
});

it('does not expose staff review controls for a client document response', async () => {
  const clientDocument: Record<string, unknown> = { ...staffDocument };
  for (const key of [
    'owner_user_id', 'uploaded_by_user_id', 'visibility', 'checksum_sha256',
    'scan_status', 'review_note', 'reviewed_by_user_id', 'retention_expires_at',
    'purged_at', 'deleted_at', 'storage_key',
  ]) delete clientDocument[key];
  (fetchDocument as jest.Mock).mockResolvedValue(clientDocument);
  render(<DocumentDetailPage />);
  expect(await screen.findByText('Client document')).toBeTruthy();
  expect(screen.queryByText('Review document')).toBeNull();
});
